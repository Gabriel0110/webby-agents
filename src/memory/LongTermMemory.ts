import { Memory, ConversationMessage } from "./Memory";
import { InMemoryVectorStore } from "./VectorStore";
import { OpenAIEmbeddings } from "../LLMs/OpenAIEmbeddings";

export interface LongTermMemoryOptions {
  embeddings: OpenAIEmbeddings;
  maxMessages?: number; 
  topK?: number;        
}

/**
 * LongTermMemory with vector store retrieval.
 */
export class LongTermMemory implements Memory {
  private vectorStore: InMemoryVectorStore;
  private embeddings: OpenAIEmbeddings;
  private maxMessages: number;
  private topK: number;

  constructor(options: LongTermMemoryOptions) {
    this.embeddings = options.embeddings;
    this.vectorStore = new InMemoryVectorStore();
    this.maxMessages = options.maxMessages ?? 1000;
    this.topK = options.topK ?? 3;
  }

  public async addMessage(message: ConversationMessage): Promise<void> {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const embedding = await this.embeddings.embed(message.content);

    this.vectorStore.addItem({
      id,
      content: message.content,
      embedding,
      metadata: {
        role: message.role,
        timestamp: Date.now(),
      }
    });

    const allItems = this.vectorStore.getAllItems();
    if (allItems.length > this.maxMessages) {
      allItems.shift();
    }
  }

  public async getContext(): Promise<ConversationMessage[]> {
    // By default, no immediate context unless you do retrieval
    return [];
  }

  /**
   * Return top-K relevant messages to the query
   */
  public async getContextForPrompt(query: string): Promise<ConversationMessage[]> {
    if (!query.trim()) {
      return [];
    }
    const embedding = await this.embeddings.embed(query);
    const results = this.vectorStore.similaritySearch(embedding, this.topK);
    return results.map((r) => ({
      role: "assistant",
      content: r.content,
      timestamp: r.metadata?.timestamp,
    }));
  }

  public async clear(): Promise<void> {
    this.vectorStore = new InMemoryVectorStore();
  }
}
