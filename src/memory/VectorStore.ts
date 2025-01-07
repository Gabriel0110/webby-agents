// src/memory/VectorStore.ts

/**
 * Represents a single item in a vector store (content + embedding).
 */
export interface VectorStoreItem {
    id: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
  }
  
  /**
   * Basic in-memory vector store with naive cosine similarity search.
   * For larger-scale usage, we'd want to have a real vector database.
   */
  export class InMemoryVectorStore {
    private items: VectorStoreItem[] = [];
  
    public addItem(item: VectorStoreItem) {
      this.items.push(item);
    }
  
    public getAllItems(): VectorStoreItem[] {
      return this.items;
    }
  
    public similaritySearch(queryEmbedding: number[], k = 3): VectorStoreItem[] {
      const scored = this.items.map(item => {
        const score = cosineSimilarity(item.embedding, queryEmbedding);
        return { item, score };
      });
  
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, k).map(s => s.item);
    }
  }
  
  /**
   * Computes cosine similarity between two vectors.
   */
  export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must be the same length for cosine similarity.");
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] ** 2;
      normB += b[i] ** 2;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  