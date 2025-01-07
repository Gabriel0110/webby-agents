// src/memory/LongTermMemory.ts
import { Memory, ConversationMessage } from "./Memory";
import { InMemoryVectorStore, VectorStoreItem } from "./VectorStore";
import { OpenAIEmbeddings } from "../LLMs/OpenAIEmbeddings";

export interface LongTermMemoryOptions {
  embeddings: OpenAIEmbeddings;
  maxMessages?: number; // optional cap on how many to store
  topK?: number;        // how many old messages to retrieve
}

/**
 * LongTermMemory:
 *  - Each new message is embedded and stored in a vector store.
 *  - For retrieval, you can call retrieveRelevant(query) to get top-K similar messages.
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
        timestamp: message.timestamp
      }
    });

    // If we exceed max messages, remove the oldest
    const allItems = this.vectorStore.getAllItems();
    if (allItems.length > this.maxMessages) {
      allItems.shift(); // naive approach to drop oldest
    }
  }

  /**
   * getContext() by default returns an empty array 
   * (since you generally want to call retrieveRelevant(...) instead).
   */
  public async getContext(): Promise<ConversationMessage[]> {
    return [];
  }

  public async clear(): Promise<void> {
    this.vectorStore = new InMemoryVectorStore();
  }

  /**
   * Retrieve the top-K relevant messages from the vector store for a given query.
   */
  public async retrieveRelevant(query: string, k?: number): Promise<ConversationMessage[]> {
    const embedding = await this.embeddings.embed(query);
    const results = this.vectorStore.similaritySearch(embedding, k ?? this.topK);
    return results.map(r => ({
      role: "assistant",
      content: r.content,
      timestamp: r.metadata?.timestamp
    }));
  }
}
