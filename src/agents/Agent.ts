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
  /**
   * The maximum number of “reasoning” or “reflection” steps in the main loop.
   * If set to -1, there is no cap on steps (use with caution).
   */
  maxSteps?: number;

  /**
   * The maximum number of LLM calls allowed during a single agent.run() call.
   * If set to -1, there's no limit (use with caution).
   */
  usageLimit?: number;

  /**
   * Whether to enable multi-step reflection.
   * If false, the agent does a single pass (no loop).
   */
  useReflection?: boolean;

  /**
   * A time-to-live (in ms). If the agent runs longer than this, it stops.
   * -1 means no time limit.
   */
  timeToLive?: number;

  /**
   * If true, logs debug info and statuses. Otherwise, silent.
   */
  debug?: boolean;
}

/**
 * Lifecycle hooks for debugging or advanced usage.
 */
export interface AgentHooks {
  /**
   * Called when a planner produces a plan (in JSON or text).
   */
  onPlanGenerated?: (plan: string) => void;

  /**
   * Called right before a tool is used. Return false to cancel usage.
   */
  onToolCall?: (toolName: string, query: string) => Promise<boolean> | boolean;

  /**
   * Called if tool parameter validation fails.
   */
  onToolValidationError?: (toolName: string, errorMsg: string) => void;

  /**
   * Called after a tool successfully executes, with the tool’s result.
   */
  onToolResult?: (toolName: string, result: string) => void;

  /**
   * Called when a final answer is found and returned.
   */
  onFinalAnswer?: (answer: string) => void;

  /**
   * Called after each iteration (or step) to observe memory messages or agent state.
   */
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
  protected llmCallsUsed = 0;       // how many times we've called the LLM
  private startTime: number = 0;    // when run() started
  private stepCount: number = 0;    // how many reflection steps so far

  // Hooks
  protected hooks: AgentHooks;

  constructor(params: {
    name?: string;
    model: OpenAIChat;
    memory: Memory;
    tools?: Tool[];
    instructions?: string[];
    planner?: Planner;
    options?: AgentOptions;
    hooks?: AgentHooks;
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
    } = params;

    // Basic fields
    this.name = name ?? "UnnamedAgent";
    this.model = model;
    this.memory = memory;
    this.tools = tools;
    this.instructions = instructions;
    this.planner = planner;
    this.hooks = hooks ?? {};

    // Options
    this.maxSteps = options?.maxSteps ?? 15;
    this.usageLimit = options?.usageLimit ?? 15;
    this.timeToLive = options?.timeToLive ?? 60000;
    this.debug = options?.debug ?? false;
    this.logger = new DebugLogger(this.debug);

    // Reflection toggling
    if (tools.length > 0) {
      this.useReflection = true;
      if (options?.useReflection === false) {
        this.logger.warn(
          `[Agent] Tools were provided, forcing useReflection to true.`
        );
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
  }): Agent {
    return new Agent(params);
  }

  /**
   * The main entry point for the agent. 
   * If reflection is disabled, does a single pass. Otherwise, loops until a final answer is found.
   */
  public async run(query: string): Promise<string> {
    this.startTime = Date.now();
    this.stepCount = 0;

    this.logger.log(`[Agent:${this.name}] Starting run`, { query });

    // Initialize conversation with system prompt & user query
    await this.memory.addMessage({
      role: "system",
      content: this.buildSystemPrompt(),
    });
    await this.memory.addMessage({ role: "user", content: query });

    // If reflection is disabled, do a single pass
    if (!this.useReflection) {
      return await this.singlePass();
    }

    // If a planner is specified, we can do a plan-then-execute approach
    if (this.planner) {
      return await this.executePlannerFlow(query);
    }

    // Otherwise, do the default reflection loop
    while (true) {
      // Check usage/time limits
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

      // Gather the current context from memory
      const context = await this.memory.getContextForPrompt(query);

      // LLM call
      const llmOutput = await this.model.call(context);
      this.logger.log(`[Agent:${this.name}] LLM Output:`, { llmOutput });

      // Check for tool usage
      const toolRequest = ToolRequestParser.parse(llmOutput);
      if (toolRequest) {
        const result = await this.handleToolRequest(toolRequest);
        // Add the tool result to memory so the agent can see it next iteration
        await this.memory.addMessage({
          role: "assistant",
          content: `Tool result:\n${result}`,
        });
        // Continue the loop so the agent sees the new tool result in memory
        continue;
      }

      // Check for final answer
      if (llmOutput.startsWith("FINAL ANSWER:")) {
        const finalAns = llmOutput.replace("FINAL ANSWER:", "").trim();
        this.logger.log(`[Agent:${this.name}] Final answer found`, { finalAns });

        await this.memory.addMessage({
          role: "assistant",
          content: llmOutput,
        });

        if (this.hooks.onFinalAnswer) {
          await this.hooks.onFinalAnswer(finalAns);
        }
        return finalAns;
      }

      // If the output is neither a tool request nor a final answer,
      // treat it as an intermediate message (reasoning or partial answer).
      await this.memory.addMessage({ role: "assistant", content: llmOutput });

      // Optional: If you want to treat any leftover output as a final answer, you could:
      // return llmOutput;
      // But we choose to loop until we see a "FINAL ANSWER:" or a stop condition.
    }
  }

  /**
   * Single pass execution without multi-step reflection.
   */
  protected async singlePass(): Promise<string> {
    if (this.llmCallsUsed >= this.usageLimit && this.usageLimit !== -1) {
      return "Usage limit reached. No more LLM calls allowed.";
    }

    this.llmCallsUsed++;
    const singleResponse = await this.model.call(await this.memory.getContext());
    await this.memory.addMessage({ role: "assistant", content: singleResponse });

    if (this.hooks.onFinalAnswer) {
      this.hooks.onFinalAnswer(singleResponse);
    }
    return singleResponse;
  }

  /**
   * A simpler, plan-then-execute approach if a planner is provided.
   */
  private async executePlannerFlow(query: string): Promise<string> {
    if (!this.planner) {
      return "No planner specified.";
    }
    // Generate a plan
    const plan = await this.planner.generatePlan(query, this.tools, this.memory);

    if (this.hooks.onPlanGenerated) {
      this.hooks.onPlanGenerated(plan);
    }

    // Parse the plan
    const steps = this.parsePlan(plan);
    for (const step of steps) {
      const stepResponse = await this.executePlanStep(step, query);

      // Add step result to memory
      await this.memory.addMessage({ role: "assistant", content: stepResponse });

      // Check for final answer
      if (stepResponse.includes("FINAL ANSWER")) {
        return stepResponse.replace("FINAL ANSWER:", "").trim();
      }
    }

    return "Plan executed but no final answer was found.";
  }

  /**
   * Build the system prompt, enumerating tools and usage instructions, plus user instructions.
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

  /**
   * Parse the plan produced by a planner into an array of { action, details }.
   */
  protected parsePlan(plan: string): Array<{ action: string; details: string }> {
    try {
      return JSON.parse(plan);
    } catch (err) {
      return [{ action: "message", details: plan }];
    }
  }

  /**
   * Executes a single plan step. 
   * Example plan steps: { action: "tool", details: "SomeTool" }, { action: "message", details: "Hello" }, { action: "complete", details: "FINAL ANSWER" }
   */
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
        // Provide the entire query as input for now, or step.details as the query
        // Possibly parse sub-steps or arguments
        return await tool.run(query);
      }

      case "message":
        // Could treat step.details as user or system text
        return await this.model.call([{ role: "user", content: step.details }]);

      case "complete":
        // If the plan says to complete with a final answer
        return `FINAL ANSWER: ${step.details}`;

      default:
        return `Unknown action: ${step.action}`;
    }
  }

  /**
   * Called whenever the LLM output contains a tool request. 
   * Validates, obtains user approval (if any), and runs the tool.
   */
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

      // Hook for user approval
      if (this.hooks.onToolCall) {
        const proceed = await this.hooks.onToolCall(tool.name, request.query);
        if (!proceed) {
          this.logger.log("Tool call cancelled by hook", { toolName: tool.name });
          return `Tool call to "${tool.name}" cancelled by user approval.`;
        }
      }

      // Run the tool
      const result = request.args
        ? await tool.run("", request.args)
        : await tool.run(request.query);

      this.logger.log("Tool execution result", { toolName: tool.name, result });

      // Optional post-result hook
      if (this.hooks.onToolResult) {
        await this.hooks.onToolResult(tool.name, result);
      }

      // Return the tool result to be integrated into memory
      return result;
    } catch (err) {
      const errorMsg = (err as Error).message;
      this.logger.error("Tool request failed", { error: errorMsg });
      return `Error processing tool request: ${errorMsg}`;
    }
  }

  /**
   * Checks if we have exceeded steps, usage limits, or time limit.
   */
  private shouldStop(elapsed: number): boolean {
    if (this.maxSteps !== -1 && this.stepCount >= this.maxSteps) return true;
    if (this.usageLimit !== -1 && this.llmCallsUsed >= this.usageLimit) return true;
    if (this.timeToLive !== -1 && elapsed >= this.timeToLive) return true;
    return false;
  }

  /**
   * Returns the reason we are stopping.
   */
  private getStoppingReason(elapsed: number): string {
    if (this.stepCount >= this.maxSteps) {
      return `Max steps (${this.maxSteps}) reached without final answer.`;
    }
    if (this.usageLimit !== -1 && this.llmCallsUsed >= this.usageLimit) {
      return `Usage limit (${this.usageLimit} calls) reached.`;
    }
    if (this.timeToLive !== -1 && elapsed >= this.timeToLive) {
      return `Time limit (${this.timeToLive}ms) reached after ${elapsed}ms.`;
    }
    return "Unknown stopping condition reached.";
  }

  /**
   * If we want to store chain-of-thought style reflections, we can call this method.
   * Only stored if memory is ReflectionMemory or a composite that includes reflection.
   */
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
}
