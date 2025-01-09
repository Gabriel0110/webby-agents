// src/tools/MemoryTool.ts

import { Tool } from "./Tools";
import { Memory, ConversationMessage } from "../memory/Memory";
import { OpenAIEmbeddings } from "../LLMs/OpenAIEmbeddings";
import { InMemoryVectorStore, VectorStoreItem, cosineSimilarity } from "../memory/VectorStore";

interface MemoryOperation {
  type: 'store' | 'retrieve';
  content: string;
}

interface StoredMemory {
  content: string;
  timestamp: number;
  metadata?: {
    type: string;
    reason?: string;
  };
}

/**
 * A Memory tool that allows both storage and retrieval of information
 * using semantic search capabilities.
 */
export class MemoryTool implements Tool {
  name = "Memory";
  description: string;

  private memory: Memory;
  private embeddings: OpenAIEmbeddings;
  private vectorStore: InMemoryVectorStore;
  
  constructor(
    memory: Memory, 
    embeddings: OpenAIEmbeddings,
    description?: string
  ) {
    this.memory = memory;
    this.embeddings = embeddings;
    this.vectorStore = new InMemoryVectorStore();
    this.description = description ?? 
      "Store or retrieve information from memory. Use 'store:' prefix to save information, or query directly to retrieve.";
  }

  /**
   * Find relevant memories using semantic search
   */
  private async findRelevantMemories(query: string, topK: number = 3): Promise<VectorStoreItem[]> {
    try {
      const queryEmbedding = await this.embeddings.embed(query);
      return this.vectorStore.similaritySearch(queryEmbedding, topK);
    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Parse the input to determine if it's a store or retrieve operation
   */
  private parseOperation(input: string): MemoryOperation {
    const storePrefix = 'store:';
    if (input.toLowerCase().startsWith(storePrefix)) {
      return {
        type: 'store',
        content: input.slice(storePrefix.length).trim()
      };
    }
    return {
      type: 'retrieve',
      content: input
    };
  }

  /**
   * Check if information is already present in recent context
   */
  private async isAlreadyStored(content: string): Promise<boolean> {
    const storedMemories = await this.findRelevantMemories(content);
    return storedMemories.some(memory => 
      memory.content.toLowerCase().includes(content.toLowerCase())
    );
  }

  /**
   * Execute the memory operation
   */
  async run(input: string): Promise<string> {
    const operation = this.parseOperation(input);

    switch (operation.type) {
      case 'store':
        try {
          // First check if already stored to prevent duplicates
          if (await this.isAlreadyStored(operation.content)) {
            return "This information is already stored in memory.";
          }

          // Then check if in recent context
          const context = await this.memory.getContextForPrompt(operation.content);
          const contextString = context
            .map(msg => msg.content.toLowerCase())
            .join(' ');
          
          // Simple text matching for recent context
          if (contextString.includes(operation.content.toLowerCase())) {
            return "Information is already in recent context, no need to store explicitly.";
          }

          // If not found in either place, store it
          const embedding = await this.embeddings.embed(operation.content);
          const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          
          this.vectorStore.addItem({
            id,
            content: operation.content,
            embedding,
            metadata: {
              timestamp: Date.now(),
              type: 'explicit_storage',
              reason: 'User requested preservation'
            }
          });
          
          return `Successfully stored: ${operation.content}`;
        } catch (error) {
          console.error('Error storing memory:', error);
          return `Error storing memory: ${(error as Error).message}`;
        }

      case 'retrieve':
        try {
          // First check recent context
          const recentContext = await this.memory.getContextForPrompt(operation.content);
          
          // If found in recent context, just return that
          if (recentContext.length > 0) {
            const contextString = recentContext
              .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
              .join('\n');
            return `Found in recent context:\n${contextString}`;
          }

          // If not in recent context, check stored memories
          const storedMemories = await this.findRelevantMemories(operation.content);
          if (storedMemories.length === 0) {
            return "No relevant information found in memory.";
          }

          return "Relevant stored memories:\n" + 
            storedMemories
              .map((mem, i) => `${i + 1}. ${mem.content}`)
              .join('\n');

        } catch (error) {
          console.error('Error retrieving memories:', error);
          return `Error retrieving memories: ${(error as Error).message}`;
        }

      default:
        return `Unknown operation type: ${(operation as any).type}`;
    }
  }
}