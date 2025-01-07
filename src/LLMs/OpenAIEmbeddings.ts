// src/LLMs/OpenAIEmbeddings.ts
import axios from "axios";

export interface OpenAIEmbeddingsOptions {
  apiKey?: string;
  model?: string;
}

export class OpenAIEmbeddings {
  private apiKey: string;
  private model: string;

  constructor(options: OpenAIEmbeddingsOptions) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = options.model ?? "text-embedding-3-small";

    if (!this.apiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable. Please set it or provide the apiKey directly in the constructor.");
    }
  }

  /**
   * Returns a single embedding vector for the given text.
   */
  public async embed(text: string): Promise<number[]> {
    try {
      const url = "https://api.openai.com/v1/embeddings";
      const response = await axios.post(
        url,
        {
          input: text,
          model: this.model
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`
          }
        }
      );
      const vector = response.data.data[0].embedding as number[];
      return vector;
    } catch (err: any) {
      console.error("Error embedding text:", err?.response?.data || err.message);
      throw err;
    }
  }
}
