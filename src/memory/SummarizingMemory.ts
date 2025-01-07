// src/memory/SummarizingMemory.ts
import { Memory, ConversationMessage } from "./Memory";
import { OpenAIChat } from "../LLMs/OpenAIChat";

/**
 * SummarizingMemory:
 *  - Stores messages in an array until they exceed a threshold.
 *  - Then uses an LLM (summarizerModel) to summarize the older messages,
 *    replaces them with a single summary message, and keeps that summary in context.
 */
export class SummarizingMemory implements Memory {
  private messages: ConversationMessage[] = [];
  private threshold: number; // number of messages before summarizing
  private summarizerModel: OpenAIChat; // the model we'll use for summarizing
  private summaryPrompt: string; // instructions on how to summarize
  private maxSummaryTokens: number;

  constructor(options: {
    threshold: number;
    summarizerModel: OpenAIChat;
    summaryPrompt?: string;
    maxSummaryTokens?: number;
  }) {
    this.threshold = options.threshold;
    this.summarizerModel = options.summarizerModel;
    this.summaryPrompt =
      options.summaryPrompt ??
      "Please provide a concise summary of the following conversation:";
    this.maxSummaryTokens = options.maxSummaryTokens ?? 150;
  }

  public async addMessage(message: ConversationMessage): Promise<void> {
    this.messages.push(message);
    // If we exceed threshold, summarize older messages
    if (this.messages.length > this.threshold) {
      await this.summarizeOlderMessages();
    }
  }

  public async getContext(): Promise<ConversationMessage[]> {
    return this.messages;
  }

  public async clear(): Promise<void> {
    this.messages = [];
  }

  private async summarizeOlderMessages(): Promise<void> {
    // We'll keep the most recent 3 messages unsummarized
    const keepCount = 3;
    if (this.messages.length <= keepCount) return;

    const olderMessages = this.messages.slice(0, this.messages.length - keepCount);
    const recentMessages = this.messages.slice(this.messages.length - keepCount);

    // Build text from the older messages
    const conversationText = olderMessages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    // Summarize with the LLM
    const summary = await this.summarizerModel.call([
      { role: "system", content: this.summaryPrompt },
      { role: "user", content: conversationText }
    ]);

    // Replace older messages with a single summary message
    const summaryMessage: ConversationMessage = {
      role: "assistant",
      content: `Summary of earlier discussion:\n${summary}`
    };

    this.messages = [summaryMessage, ...recentMessages];
  }
}
