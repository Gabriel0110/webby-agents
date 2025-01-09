// src/Workflow.ts

import { OpenAIChat } from "./LLMs/OpenAIChat";
import { Memory, ConversationMessage, MemoryRole } from "./memory/Memory";

/**
 * A workflow step: calls the model or performs some transformation,
 * returning a single conversation message (role + content).
 */
export interface WorkflowStep {
  name?: string;
  run(messages: ConversationMessage[]): Promise<ConversationMessage>;
}

/**
 * A simple orchestrator that runs a sequence of steps.
 */
export class Workflow {
  private steps: WorkflowStep[];
  private memory: Memory;

  constructor(steps: WorkflowStep[], memory: Memory) {
    this.steps = steps;
    this.memory = memory;
  }

  // Run steps sequentially
  public async runSequential(input: string): Promise<string> {
    // 1) Add user message
    await this.memory.addMessage({ role: "user", content: input });

    let finalOutput = "";
    for (const step of this.steps) {
      // 2) Gather context
      const context = await this.memory.getContext();

      // 3) Step returns a conversation message (role + content)
      const stepResult = await step.run(context);
      await this.memory.addMessage(stepResult);

      finalOutput = stepResult.content;
    }
    return finalOutput;
  }

  // Run steps in parallel
  public async runParallel(input: string): Promise<string[]> {
    // 1) Add user message
    await this.memory.addMessage({ role: "user", content: input });
    const context = await this.memory.getContext();

    // 2) Run all steps concurrently
    const results = await Promise.all(this.steps.map((step) => step.run(context)));

    // 3) Add each result to memory
    for (const result of results) {
      await this.memory.addMessage(result);
    }

    // 4) Return an array of content
    return results.map((r) => r.content);
  }

  // Run steps conditionally based on the output of the previous step
  public async runConditional(input: string, conditionFn: (output: string) => boolean): Promise<string> {
    await this.memory.addMessage({ role: "user", content: input });

    let finalOutput = "";
    for (const step of this.steps) {
      const context = await this.memory.getContext();
      const stepResult = await step.run(context);
      await this.memory.addMessage(stepResult);

      if (!conditionFn(stepResult.content)) {
        // Exit if condition fails
        break;
      }
      finalOutput = stepResult.content;
    }

    return finalOutput;
  }
}

/**
 * Example step that just calls an LLM with the entire conversation as input.
 */
export class LLMCallStep implements WorkflowStep {
  private model: OpenAIChat;
  private systemPrompt: string;

  constructor(model: OpenAIChat, systemPrompt?: string) {
    this.model = model;
    this.systemPrompt = systemPrompt ?? "You are a helpful assistant.";
  }

  async run(messages: ConversationMessage[]): Promise<ConversationMessage> {
    // We treat messages as the conversation so far
    const enhancedMessages: ConversationMessage[] = [
      { role: "system", content: this.systemPrompt },
      ...messages,
    ];

    const response = await this.model.call(enhancedMessages);

    // Return a conversation message
    return { role: "assistant", content: response };
  }
}
