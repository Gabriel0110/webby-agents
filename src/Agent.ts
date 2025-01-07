// src/Agent.ts
import { OpenAIChat } from "./LLMs/OpenAIChat";
import { Memory } from "./memory/Memory";
import { Tool } from "./tools/Tools";

/**
 * Options to configure agent behavior and safety checks.
 */
export interface AgentOptions {
  /**
   * Max reflection/iteration steps. If set to -1, no step limit.
   */
  maxSteps?: number;
  
  /**
   * Total number of LLM calls allowed. Once reached, agent stops to avoid extra cost.
   */
  usageLimit?: number;

  /**
   * Enable or disable multi-step reasoning. 
   * If false, the agent will do only a single pass. 
   * If you have tools, we force this to true.
   */
  useReflection?: boolean;

  /**
   * Time-to-live in milliseconds. If -1, no time limit.
   * If the agent runs longer than this, it stops.
   */
  timeToLive?: number;
}

export class Agent {
  private model: OpenAIChat;
  private memory: Memory;
  private tools: Tool[];
  private instructions: string[];

  // Options
  private maxSteps: number;
  private usageLimit: number;
  private useReflection: boolean;
  private timeToLive: number;

  // Internal counters/timers
  private llmCallsUsed = 0;

  constructor(
    model: OpenAIChat,
    memory: Memory,            // e.g., SummarizingMemory or any other Memory class
    tools: Tool[] = [],
    instructions: string[] = [],
    options?: AgentOptions
  ) {
    this.model = model;
    this.memory = memory;
    this.tools = tools;
    this.instructions = instructions;

    // Default logic
    this.maxSteps = options?.maxSteps ?? 5;
    this.usageLimit = options?.usageLimit ?? 5;
    this.timeToLive = options?.timeToLive ?? 60_000;

    // If tools are present, reflection is required to use them
    if (tools.length > 0) {
      if (options?.useReflection === false) {
        console.warn(
          "[Agent] Tools are provided but useReflection = false. " +
          "Overriding to 'true' so that tool usage is possible."
        );
      }
      this.useReflection = true;
    } else {
      // If no tools, we respect whatever the user set
      this.useReflection = options?.useReflection ?? true;
    }
  }

  /**
   * The main entry point for the agent.
   * @param query The user query or instruction.
   * @returns The final answer from the agent.
   */
  public async run(query: string): Promise<string> {
    const startTime = Date.now();

    // 1) Initialize conversation with system + user messages
    await this.memory.addMessage({
      role: "system",
      content: this.buildSystemPrompt()
    });
    await this.memory.addMessage({
      role: "user",
      content: query
    });

    // 2) If reflection is turned off, do a single pass
    if (!this.useReflection) {
      // usage limit check
      if (this.llmCallsUsed >= this.usageLimit) {
        return "Usage limit reached. No more LLM calls allowed.";
      }
      this.llmCallsUsed++;
      const singleResponse = await this.model.call(await this.memory.getContext());
      await this.memory.addMessage({ role: "assistant", content: singleResponse });
      return singleResponse;
    }

    // 3) Multi-step reflection loop
    let stepCount = 0;
    while (true) {
      // Check maxSteps (unless -1)
      if (this.maxSteps !== -1 && stepCount >= this.maxSteps) {
        return "ERROR: Max steps reached without a final answer.";
      }

      // Check usageLimit
      if (this.llmCallsUsed >= this.usageLimit) {
        return "Usage limit reached. No more LLM calls allowed.";
      }

      // Check time-to-live
      const elapsed = Date.now() - startTime;
      if (this.timeToLive !== -1 && elapsed >= this.timeToLive) {
        return `Time-to-live limit reached after ${elapsed} ms. Stopping.`;
      }

      this.llmCallsUsed++;
      const llmOutput = await this.model.call(await this.memory.getContext());
      stepCount++;

      // Add the LLM's message to memory
      await this.memory.addMessage({ role: "assistant", content: llmOutput });

      // Check if LLM wants to use a tool
      const toolRequestMatch = llmOutput.match(/^TOOL REQUEST:\s*(.+)$/im);
      if (toolRequestMatch) {
        const toolRequest = toolRequestMatch[1];
        const toolResult = await this.handleToolRequest(toolRequest);
        await this.memory.addMessage({
          role: "assistant",
          content: `Tool result:\n${toolResult}`
        });
        continue; // loop again so LLM can see tool result
      }

      // Check if LLM gave a final answer
      const finalAnswerMatch = llmOutput.match(/^FINAL ANSWER:\s*(.+)$/ims);
      if (finalAnswerMatch) {
        const finalAnswer = finalAnswerMatch[1].trim();
        return finalAnswer;
      }

      // If no recognized pattern, treat entire response as final
      return llmOutput;
    }
  }

  private buildSystemPrompt(): string {
    let toolList = "";
    if (this.tools.length > 0) {
      toolList =
        "You have access to these tools:\n" +
        this.tools.map(t => `- ${t.name}: ${t.description}`).join("\n") +
        "\n";
    }

    const userInstructions = this.instructions.join("\n");

    return [
      "You are an AI agent.",
      toolList,
      "When you want to use a tool, output:\nTOOL REQUEST: <ToolName> <ToolQuery>",
      "When you have the final answer, output:\nFINAL ANSWER: <Your answer>",
      userInstructions
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Handle a request to call a tool, matching the name to an available tool.
   */
  private async handleToolRequest(requestString: string): Promise<string> {
    const parts = requestString.trim().split(/\s+/, 2);
    if (parts.length < 2) {
      return "Invalid tool request format. Expected: TOOL REQUEST: <ToolName> <Query>";
    }

    const toolName = parts[0];
    const toolQuery = requestString.replace(toolName, "").trim();

    // Find the matching tool
    const tool = this.tools.find(
      t => t.name.toLowerCase() === toolName.toLowerCase()
    );
    if (!tool) {
      return `Tool "${toolName}" not found.`;
    }

    try {
      const result = await tool.run(toolQuery);
      return result;
    } catch (err: any) {
      return `Error calling tool "${toolName}": ${err.message}`;
    }
  }
}
