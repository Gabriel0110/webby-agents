// src/Agent.ts

import { OpenAIChat } from "./LLMs/OpenAIChat";
import { Memory } from "./memory/Memory";
import { Tool } from "./tools/Tools";
import { Planner } from "./Planner";
import { ConversationMessage } from "./memory/Memory";
import { ToolRequestParser, ParsedToolRequest } from './tools/ToolRequest';
import { DebugLogger } from './utils/DebugLogger';

/**
 * Options to configure agent behavior and safety checks.
 */
export interface AgentOptions {
  maxSteps?: number;       // Max reflection steps (-1 for unlimited).
  usageLimit?: number;     // Max LLM calls
  useReflection?: boolean; // If no tools, can skip reflection
  timeToLive?: number;     // In ms, -1 to disable
  debug?: boolean;         // If true, logs more info
}

/**
 * Lifecycle hooks for debugging or advanced usage.
 */
export interface AgentHooks {
  onPlanGenerated?: (plan: string) => void;
  onToolCall?: (toolName: string, query: string) => Promise<boolean> | boolean;
  onToolValidationError?: (toolName: string, errorMsg: string) => void; // NEW
  onToolResult?: (toolName: string, result: string) => void;            // NEW
  onFinalAnswer?: (answer: string) => void;
  onStep?: (messages: ConversationMessage[]) => void;
}

/**
 * The main Agent class that can do multi-step reasoning, tool usage, etc.
 */
export class Agent {
  public name: string;                  // Agent name, optional
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

    this.name = name ?? "UnnamedAgent";
    this.model = model;
    this.memory = memory;
    this.tools = tools;
    this.instructions = instructions;
    this.planner = planner;
    this.hooks = hooks ?? {};

    // Options
    this.maxSteps = options?.maxSteps ?? 5;
    this.usageLimit = options?.usageLimit ?? 5;
    this.timeToLive = options?.timeToLive ?? 60000;
    this.debug = options?.debug ?? false;
    this.logger = new DebugLogger(this.debug);

    // Reflection logic
    if (tools.length > 0) {
      this.useReflection = true;
      if (options?.useReflection === false) {
        this.logger.warn(`Tools provided, overriding 'useReflection' to true.`);
      }
    } else {
      this.useReflection = options?.useReflection ?? true;
    }
  }

  /**
   * A simpler "create" function for convenience.
   */
  public static create(params: {
    model: OpenAIChat;
    memory: Memory;
    tools?: Tool[];
    instructions?: string[];
    planner?: Planner;
    options?: AgentOptions;
    hooks?: AgentHooks;
    name?: string;
  }): Agent {
    return new Agent(params);
  }

  /**
   * The main entry point for the agent.
   */
  public async run(query: string): Promise<string> {
    this.startTime = Date.now();
    this.stepCount = 0;
    
    this.logger.log(`Agent "${this.name}" starting run`, { query });

    try {
      // Initialize conversation
      await this.memory.addMessage({
        role: "system",
        content: this.buildSystemPrompt(),
      });
      await this.memory.addMessage({
        role: "user",
        content: query,
      });

      // Single pass if no reflection needed
      if (!this.useReflection) {
        return await this.singlePass();
      }

      // Handle planner if available
      if (this.planner) {
        return await this.executePlannerFlow(query);
      }

      // Main reflection loop
      while (true) {
        // Check limits and log stats
        const elapsed = Date.now() - this.startTime;
        this.logger.stats({
          llmCallsUsed: this.llmCallsUsed,
          llmCallsLimit: this.usageLimit,
          stepsUsed: this.stepCount,
          maxSteps: this.maxSteps,
          elapsedMs: elapsed,
          timeToLive: this.timeToLive
        });

        if (this.shouldStop(elapsed)) {
          return this.getStoppingReason(elapsed);
        }

        // Increment counters
        this.llmCallsUsed++;
        this.stepCount++;

        // Get LLM response
        const context = await this.memory.getContextForPrompt(query);
        const llmOutput = await this.model.call(context);
        
        this.logger.log('LLM Output received', { llmOutput });

        // Handle tool requests
        const toolRequest = ToolRequestParser.parse(llmOutput);
        if (toolRequest) {
          const result = await this.handleToolRequest(toolRequest);
          await this.memory.addMessage({
            role: 'assistant',
            content: `Tool result:\n${result}`
          });
          continue;
        }

        // Handle final answer
        if (llmOutput.startsWith('FINAL ANSWER:')) {
          const answer = llmOutput.replace('FINAL ANSWER:', '').trim();
          this.logger.log('Final answer found', { answer });
        
          // Add FINAL ANSWER to memory
          await this.memory.addMessage({ role: "assistant", content: llmOutput });
        
          if (this.hooks.onFinalAnswer) {
            await this.hooks.onFinalAnswer(answer);
          }
          return answer;
        }

        // Treat as final answer if no special format
        return llmOutput;
      }
    } catch (error) {
      this.logger.error('Agent run failed', error);
      throw error;
    }
  }

  /**
   * Execute the planner-based flow
   */
  private async executePlannerFlow(query: string): Promise<string> {
    const plan = await this.planner!.generatePlan(query, this.tools, this.memory);
    if (this.hooks.onPlanGenerated) {
      this.hooks.onPlanGenerated(plan);
    }

    const steps = this.parsePlan(plan);
    for (const step of steps) {
      const stepResponse = await this.executePlanStep(step, query);
      await this.memory.addMessage({ role: "assistant", content: stepResponse });

      if (stepResponse.includes("FINAL ANSWER")) {
        return stepResponse.replace("FINAL ANSWER:", "").trim();
      }
    }

    return "Plan executed but no final answer found.";
  }

  /**
   * Single pass execution without reflection
   */
  protected async singlePass(): Promise<string> {
    if (this.llmCallsUsed >= this.usageLimit) {
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
   * Build the system prompt
   */
  protected buildSystemPrompt(): string {
    const toolLines = this.tools
      .map((t) => `- ${t.name}: ${t.description ?? "(no description)"}`)
      .join("\n");
  
    return [
      `You are an intelligent AI agent named "${this.name}".`,
      toolLines.length
        ? `You have access to these tools:\n${toolLines}\n`
        : "",
      `When you want to use a tool, format your response EXACTLY:\nTOOL REQUEST: <ToolName> "<Query>"\nExample: TOOL REQUEST: MyCalculator "123+456"`,
      `If your response does not follow this format exactly, it will be ignored.`,
      "When providing a final answer, format EXACTLY:\nFINAL ANSWER: <Your answer>",
      `If no special format is recognized, your entire response is considered the final answer.`,
      ...this.instructions,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Handle tool requests
   */
  protected async handleToolRequest(request: ParsedToolRequest): Promise<string> {
    this.logger.log('Processing tool request', request);
  
    try {
      // 1) Basic validation
      ToolRequestParser.validateBasic(request, this.tools);
  
      // 2) Find the referenced tool
      const tool = this.tools.find(
        (t) => t.name.toLowerCase() === request.toolName.toLowerCase()
      )!;
  
      // 3) Parameter-level validation
      ToolRequestParser.validateParameters(tool, request);
  
      // 4) Hook for final user approval
      if (this.hooks.onToolCall) {
        const proceed = await this.hooks.onToolCall(tool.name, request.query);
        if (!proceed) {
          this.logger.log('Tool call cancelled by hook', { toolName: tool.name });
          return `Tool call to "${tool.name}" cancelled by hook.`;
        }
      }
  
      // 5) Run the tool
      let result: string;
      if (request.args) {
        // If we have structured args, pass them as second param
        result = await tool.run("", request.args);
      } else {
        // If we only have a simple query string
        result = await tool.run(request.query);
      }
  
      // 6) onToolResult hook
      if (this.hooks.onToolResult) {
        await this.hooks.onToolResult(tool.name, result);
      }
      return result;
  
    } catch (err) {
      // If it's a ToolError or some other error
      const errorMsg = (err as Error).message;
      this.logger.error('Tool request failed', { error: errorMsg });
      return `Error: ${errorMsg}`;
    }
  }

  /**
   * Parse plan into steps
   */
  private parsePlan(plan: string): Array<{ action: string; details: string }> {
    try {
      return JSON.parse(plan);
    } catch (err) {
      return [{ action: "message", details: plan }];
    }
  }

  /**
   * Execute a single plan step
   */
  private async executePlanStep(
    step: { action: string; details: string }, 
    query: string
  ): Promise<string> {
    switch (step.action) {
      case "tool":
        const tool = this.tools.find((t) => t.name === step.details);
        if (!tool) {
          return `Error: Tool "${step.details}" not found.`;
        }
        return await tool.run(query);

      case "message":
      default:
        return await this.model.call(await this.memory.getContext());
    }
  }

  /**
   * Check if the agent should stop processing
   */
  private shouldStop(elapsed: number): boolean {
    if (this.maxSteps !== -1 && this.stepCount >= this.maxSteps) return true;
    if (this.llmCallsUsed >= this.usageLimit) return true;
    if (this.timeToLive !== -1 && elapsed >= this.timeToLive) return true;
    return false;
  }

  /**
   * Get the reason for stopping
   */
  private getStoppingReason(elapsed: number): string {
    if (this.stepCount >= this.maxSteps) {
      return `Max steps (${this.maxSteps}) reached without final answer.`;
    }
    if (this.llmCallsUsed >= this.usageLimit) {
      return `Usage limit (${this.usageLimit} calls) reached.`;
    }
    if (elapsed >= this.timeToLive) {
      return `Time limit (${this.timeToLive}ms) reached after ${elapsed}ms.`;
    }
    return 'Unknown stopping condition reached.';
  }
}
