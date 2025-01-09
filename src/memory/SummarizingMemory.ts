import { Memory, ConversationMessage } from "./Memory";
import { OpenAIChat } from "../LLMs/OpenAIChat";

interface SummarizingMemoryOptions {
  threshold: number;
  summarizerModel: OpenAIChat;
  summaryPrompt?: string;
  maxSummaryTokens?: number;
  hierarchical?: boolean; // If true, store multiple chunk-level summaries
}

/**
 * SummarizingMemory with optional hierarchical chunk-level approach.
 */
export class SummarizingMemory implements Memory {
  private messages: ConversationMessage[] = [];
  private threshold: number; 
  private summarizerModel: OpenAIChat; 
  private summaryPrompt: string; 
  private maxSummaryTokens: number;
  private hierarchical: boolean;
  private chunkSummaries: string[] = []; // store summaries for sub-chunks

  constructor(options: SummarizingMemoryOptions) {
    this.threshold = options.threshold;
    this.summarizerModel = options.summarizerModel;
    this.summaryPrompt = options.summaryPrompt ?? "Summarize the following conversation:";
    this.maxSummaryTokens = options.maxSummaryTokens ?? 150;
    this.hierarchical = options.hierarchical ?? false;
  }

  public async addMessage(message: ConversationMessage): Promise<void> {
    this.messages.push(message);
    if (this.messages.length > this.threshold) {
      // If hierarchical is enabled, we keep chunk-level summary
      if (this.hierarchical) {
        await this.summarizeAndStoreChunk();
      } else {
        await this.summarizeOlderMessages();
      }
    }
  }

  public async getContext(): Promise<ConversationMessage[]> {
    return this.messages;
  }

  public async getContextForPrompt(_query: string): Promise<ConversationMessage[]> {
    // Possibly return just the last few messages + the summary message(s).
    return this.messages;
  }

  public async clear(): Promise<void> {
    this.messages = [];
    this.chunkSummaries = [];
  }

  private async summarizeOlderMessages(): Promise<void> {
    // We'll keep the most recent 3 messages unsummarized
    const keepCount = 3;
    if (this.messages.length <= keepCount) return;

    const olderMessages = this.messages.slice(0, this.messages.length - keepCount);
    const recentMessages = this.messages.slice(this.messages.length - keepCount);

    const conversationText = olderMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const summary = await this.summarizerModel.call([
      { role: "system", content: this.summaryPrompt },
      { role: "user", content: conversationText },
    ]);

    const summaryMessage: ConversationMessage = {
      role: "assistant",
      content: `Summary of earlier discussion:\n${summary}`,
    };

    this.messages = [summaryMessage, ...recentMessages];
  }

  /**
   * If hierarchical, we store the summary in chunkSummaries, then clear older messages.
   */
  private async summarizeAndStoreChunk(): Promise<void> {
    const olderMessages = this.messages.slice(0, this.threshold);
    const remainder = this.messages.slice(this.threshold);

    const conversationText = olderMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const summary = await this.summarizerModel.call([
      { role: "system", content: this.summaryPrompt },
      { role: "user", content: conversationText },
    ]);

    // store chunk summary
    this.chunkSummaries.push(summary);

    // replace older messages with a single summary message
    this.messages = [
      {
        role: "assistant",
        content: `Chunk summary: ${summary}`,
      },
      ...remainder,
    ];
  }
}
