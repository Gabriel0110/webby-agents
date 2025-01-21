import { OpenAIChat } from "../LLMs/OpenAIChat";
import { Memory, MemoryRole } from "../memory/Memory";
import { ReflectionMemory } from "../memory/ReflectionMemory";
import { Tool } from "../tools/Tools";
import { Planner } from "../Planner";
import { ConversationMessage } from "../memory/Memory";
import { ToolRequestParser, ParsedToolRequest } from "../tools/ToolRequest";
import { DebugLogger } from "../utils/DebugLogger";

/**
 * Options to configure agent behavior and safety checks.
 */
export interface AgentOptions {
  maxSteps?: number;
  usageLimit?: number;
  useReflection?: boolean;
  timeToLive?: number;
  debug?: boolean;

  /**
   * If true, we will attempt to validate the final output with a validator LLM.
   */
  validateOutput?: boolean;
}

/**
 * Lifecycle hooks for debugging or advanced usage.
 */
export interface AgentHooks {
  onPlanGenerated?: (plan: string) => void;
  onToolCall?: (toolName: string, query: string) => Promise<boolean> | boolean;
  onToolValidationError?: (toolName: string, errorMsg: string) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onFinalAnswer?: (answer: string) => void;
  onStep?: (messages: ConversationMessage[]) => void;
}

/**
 * The main Agent class that can do multi-step reasoning, tool usage, etc.
 */
export class Agent {
  public name: string;
  protected model: OpenAIChat;
  protected memory: Memory;
  protected tools: Tool[];
  protected instructions: string[];
  protected logger: DebugLogger;

  // Optional planner
  protected planner?: Planner;

  // Options
  protected maxSteps: number;
  protected usageLimit: number;
  protected useReflection: boolean;
  protected timeToLive: number;
  protected debug: boolean;

  // Internal counters/timers
  protected llmCallsUsed = 0;
  private startTime: number = 0;
  private stepCount: number = 0;

  // Hooks
  protected hooks: AgentHooks;

  // The user’s or developer’s stated “task” for validation context
  protected task?: string;

  // If validateOutput === true, we optionally have a separate validation model
  protected validateOutput: boolean;
  protected validationModel?: OpenAIChat;

  constructor(params: {
    name?: string;
    model: OpenAIChat;
    memory: Memory;
    tools?: Tool[];
    instructions?: string[];

    planner?: Planner;
    options?: AgentOptions;
    hooks?: AgentHooks;

    task?: string;
    validationModel?: OpenAIChat;
  }) {
    const {
      name,
      model,
      memory,
      tools = [],
      instructions = [],
      planner,
      options,
      hooks,
      task,
      validationModel,
    } = params;

    this.name = name ?? "UnnamedAgent";
    this.model = model;
    this.memory = memory;
    this.tools = tools;
    this.instructions = instructions;
    this.planner = planner;
    this.hooks = hooks ?? {};

    this.task = task;
    this.validationModel = validationModel;

    // Options
    this.maxSteps = options?.maxSteps ?? 15;
    this.usageLimit = options?.usageLimit ?? 15;
    this.timeToLive = options?.timeToLive ?? 60000;
    this.debug = options?.debug ?? false;
    this.logger = new DebugLogger(this.debug);
    this.validateOutput = options?.validateOutput ?? false;

    // Reflection toggling
    if (tools.length > 0) {
      this.useReflection = true;
      if (options?.useReflection === false) {
        this.logger.warn(`[Agent] Tools were provided, forcing useReflection to true.`);
      }
    } else {
      this.useReflection = options?.useReflection ?? true;
    }
  }

  /**
   * A simpler "create" function for convenience.
   */
  public static create(params: {
    name?: string;
    model: OpenAIChat;
    memory: Memory;
    tools?: Tool[];
    instructions?: string[];
    planner?: Planner;
    options?: AgentOptions;
    hooks?: AgentHooks;
    task?: string;
    validationModel?: OpenAIChat;
  }): Agent {
    return new Agent(params);
  }

  /**
   * The main entry point for the agent.
   */
  public async run(query: string): Promise<string> {
    this.startTime = Date.now();
    this.stepCount = 0;

    this.logger.log(`[Agent:${this.name}] Starting run`, { query });

    // Initialize conversation
    await this.memory.addMessage({
      role: "system",
      content: this.buildSystemPrompt(),
    });
    await this.memory.addMessage({ role: "user", content: query });

    // Single-pass if reflection is off
    if (!this.useReflection) {
      return await this.singlePass();
    }

    // If planner is specified
    if (this.planner) {
      return await this.executePlannerFlow(query);
    }

    // Default reflection loop
    while (true) {
      // Check usage/time
      const elapsed = Date.now() - this.startTime;
      this.logger.stats({
        llmCallsUsed: this.llmCallsUsed,
        llmCallsLimit: this.usageLimit,
        stepsUsed: this.stepCount,
        maxSteps: this.maxSteps,
        elapsedMs: elapsed,
        timeToLive: this.timeToLive,
      });

      if (this.shouldStop(elapsed)) {
        return this.getStoppingReason(elapsed);
      }

      this.llmCallsUsed++;
      this.stepCount++;

      const context = await this.memory.getContextForPrompt(query);
      const llmOutput = await this.model.call(context);
      this.logger.log(`[Agent:${this.name}] LLM Output:`, { llmOutput });

      // Tool usage?
      const toolRequest = ToolRequestParser.parse(llmOutput);
      if (toolRequest) {
        const result = await this.handleToolRequest(toolRequest);
        await this.memory.addMessage({ role: "assistant", content: `Tool result:\n${result}` });
        continue; // Next iteration
      }

      // Final answer check
      if (llmOutput.startsWith("FINAL ANSWER:")) {
        const finalAns = llmOutput.replace("FINAL ANSWER:", "").trim();
        this.logger.log(`[Agent:${this.name}] Final answer found`, { finalAns });

        // Add final answer to memory
        await this.memory.addMessage({ role: "assistant", content: llmOutput });

        // If validateOutput is true, attempt validation
        if (this.validateOutput && this.validationModel) {
          const validated = await this.validateFinalAnswer(finalAns);
          if (!validated) {
            this.logger.log(`[Agent:${this.name}] Validation failed. Continuing loop to refine...`);
            // We can either continue the loop or forcibly revise the answer
            // We'll continue the loop here:
            continue;
          }
        }

        if (this.hooks.onFinalAnswer) {
          await this.hooks.onFinalAnswer(finalAns);
        }
        return finalAns;
      }

      // Otherwise, treat as intermediate output
      await this.memory.addMessage({ role: "assistant", content: llmOutput });
    }
  }

  /**
   * Single pass execution without reflection
   */
  protected async singlePass(): Promise<string> {
    if (this.llmCallsUsed >= this.usageLimit && this.usageLimit !== -1) {
      return "Usage limit reached. No more LLM calls allowed.";
    }
    this.llmCallsUsed++;
    const singleResponse = await this.model.call(await this.memory.getContext());
    await this.memory.addMessage({ role: "assistant", content: singleResponse });

    // If final answer, optionally validate
    if (this.validateOutput && this.validationModel) {
      const validated = await this.validateFinalAnswer(singleResponse);
      if (!validated) {
        // If single-pass and fails validation, we just return it anyway, or we can override
        this.logger.log(`[Agent:${this.name}] Single pass validation failed. Returning anyway.`);
      }
    }

    if (this.hooks.onFinalAnswer) {
      this.hooks.onFinalAnswer(singleResponse);
    }
    return singleResponse;
  }

  /**
   * Plan-then-execute approach if a planner is provided
   */
  private async executePlannerFlow(query: string): Promise<string> {
    if (!this.planner) {
      return "No planner specified.";
    }
    const plan = await this.planner.generatePlan(query, this.tools, this.memory);
    if (this.hooks.onPlanGenerated) {
      this.hooks.onPlanGenerated(plan);
    }

    const steps = this.parsePlan(plan);
    for (const step of steps) {
      const stepResponse = await this.executePlanStep(step, query);
      await this.memory.addMessage({ role: "assistant", content: stepResponse });

      if (stepResponse.includes("FINAL ANSWER")) {
        // Extract the final answer string
        const finalAnswer = stepResponse.replace("FINAL ANSWER:", "").trim();

        // Validate if required
        if (this.validateOutput && this.validationModel) {
          const pass = await this.validateFinalAnswer(finalAnswer);
          if (!pass) {
            this.logger.log(
              `[Agent:${this.name}] Validation failed in planner flow. Possibly continue or refine?`
            );
            // Could do more refinement or just return
          }
        }

        return finalAnswer;
      }
    }

    return "Plan executed but no final answer was found.";
  }

  /**
   * Build the system prompt, enumerating tools etc.
   */
  protected buildSystemPrompt(): string {
    const toolLines = this.tools
      .map((t) => `- ${t.name}: ${t.description ?? "(no description)"}`)
      .join("\n");

    const lines: string[] = [];
    lines.push(`You are an intelligent AI agent named "${this.name}".`);

    if (toolLines) {
      lines.push(
        `You have access to these tools:\n${toolLines}\nUse them by responding with EXACT format:\nTOOL REQUEST: <ToolName> "<Query>"`
      );
    } else {
      lines.push(`You do not have any tools available.`);
    }

    lines.push(
      "When you have the final answer, format EXACTLY:\nFINAL ANSWER: <Your answer>",
      ...this.instructions
    );

    return lines.join("\n\n");
  }

  protected parsePlan(plan: string): Array<{ action: string; details: string }> {
    try {
      return JSON.parse(plan);
    } catch (err) {
      return [{ action: "message", details: plan }];
    }
  }

  protected async executePlanStep(
    step: { action: string; details: string },
    query: string
  ): Promise<string> {
    switch (step.action) {
      case "tool": {
        const tool = this.tools.find((t) => t.name === step.details);
        if (!tool) {
          return `Error: Tool "${step.details}" not found.`;
        }
        return await tool.run(query);
      }
      case "message":
        return await this.model.call([{ role: "user", content: step.details }]);
      case "complete":
        return `FINAL ANSWER: ${step.details}`;
      default:
        return `Unknown action: ${step.action}`;
    }
  }

  protected async handleToolRequest(request: ParsedToolRequest): Promise<string> {
    this.logger.log("Processing tool request", request);

    try {
      const validationError = ToolRequestParser.validateBasic(request, this.tools);
      if (validationError) {
        throw new Error(validationError);
      }

      const tool = this.tools.find(
        (t) => t.name.toLowerCase() === request.toolName.toLowerCase()
      );
      if (!tool) {
        throw new Error(`Tool "${request.toolName}" is not available.`);
      }

      ToolRequestParser.validateParameters(tool, request);

      if (this.hooks.onToolCall) {
        const proceed = await this.hooks.onToolCall(tool.name, request.query);
        if (!proceed) {
          this.logger.log("Tool call cancelled by hook", { toolName: tool.name });
          return `Tool call to "${tool.name}" cancelled by user approval.`;
        }
      }

      const result = request.args
        ? await tool.run("", request.args)
        : await tool.run(request.query);

      this.logger.log("Tool execution result", { toolName: tool.name, result });

      if (this.hooks.onToolResult) {
        await this.hooks.onToolResult(tool.name, result);
      }

      return result;
    } catch (err) {
      const errorMsg = (err as Error).message;
      this.logger.error("Tool request failed", { error: errorMsg });
      return `Error processing tool request: ${errorMsg}`;
    }
  }

  /**
   * Called each iteration to see if we should stop for usage/time reasons
   */
  private shouldStop(elapsed: number): boolean {
    if (this.maxSteps !== -1 && this.stepCount >= this.maxSteps) return true;
    if (this.usageLimit !== -1 && this.llmCallsUsed >= this.usageLimit) return true;
    if (this.timeToLive !== -1 && elapsed >= this.timeToLive) return true;
    return false;
  }

  private getStoppingReason(elapsed: number): string {
    if (this.stepCount >= this.maxSteps) {
      return `Max steps (${this.maxSteps}) reached without final answer.`;
    }
    if (this.usageLimit !== -1 && this.llmCallsUsed >= this.usageLimit) {
      return `Usage limit (${this.usageLimit} calls) reached.`;
    }
    if (elapsed >= this.timeToLive) {
      return `Time limit (${this.timeToLive}ms) reached after ${elapsed}ms.`;
    }
    return "Unknown stopping condition reached.";
  }

  protected async handleReflection(reflectionContent: string): Promise<void> {
    const reflectionMessage: ConversationMessage = {
      role: "reflection" as MemoryRole,
      content: reflectionContent,
    };

    if (this.memory instanceof ReflectionMemory) {
      await this.memory.addMessage(reflectionMessage);
    }

    this.logger.log(`Reflection stored: ${reflectionContent}`);
  }

  /**
   * Validate final answer if validateOutput===true and we have a validationModel.
   * If passes validation, returns true. If fails, returns false.
   */
  protected async validateFinalAnswer(finalAnswer: string): Promise<boolean> {
    if (!this.validationModel) {
      // No separate model, skip
      return true;
    }

    const systemPrompt = `
You are a validator that checks if an agent's final answer meets the user's task requirements.
If the final answer is correct and satisfies the task, respond with a JSON:
{"is_valid":true,"reason":"some short reason"}
If it fails or is incomplete, respond with:
{"is_valid":false,"reason":"some short reason"}

User's task (if any): ${this.task ?? "(none provided)"}

Agent's final answer to validate:
${finalAnswer}
    `;

    const validatorOutput = await this.validationModel.call([
      { role: "system", content: systemPrompt },
    ]);

    this.logger.log(`[Agent:${this.name}] Validator output:`, { validatorOutput });

    // Attempt to parse
    try {
      const parsed = JSON.parse(validatorOutput);
      if (parsed.is_valid === true) {
        this.logger.log(`[Agent:${this.name}] Validation PASSED: ${parsed.reason}`);
        return true;
      } else {
        this.logger.log(`[Agent:${this.name}] Validation FAILED: ${parsed.reason}`);
        return false;
      }
    } catch (error) {
      this.logger.warn(`[Agent:${this.name}] Could not parse validator output. Assuming fail.`, { validatorOutput });
      return false;
    }
  }
}
