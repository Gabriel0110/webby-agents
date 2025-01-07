import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();

/**
 * Options for the OpenAIChat class:
 * - apiKey: your OpenAI API key
 * - model: which ChatCompletion model to use (e.g., "gpt-3.5-turbo")
 * - temperature: creativity setting
 * - stream: whether to use streaming
 * - onToken: callback for streaming tokens
 */
export interface OpenAIChatOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  stream?: boolean;
  onToken?: (token: string) => void;
}

export class OpenAIChat {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private stream: boolean;
  private onToken?: (token: string) => void;

  constructor(options: OpenAIChatOptions) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = options.model ?? "gpt-4o-mini";
    this.temperature = options.temperature ?? 0.7;
    this.stream = options.stream ?? false;
    this.onToken = options.onToken;

    if (!this.apiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable. Please set it or provide the apiKey directly in the constructor.");
    }
  }

  /**
   * Calls the OpenAI ChatCompletion endpoint with the specified messages.
   * If stream=true, handles partial token responses and calls onToken.
   */
  public async call(
    messages: { role: string; content: string }[]
  ): Promise<string> {
    const url = "https://api.openai.com/v1/chat/completions";

    // Non-streaming path:
    if (!this.stream) {
      try {
        const response = await axios.post(
          url,
          {
            model: this.model,
            temperature: this.temperature,
            messages
          },
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.apiKey}`
            }
          }
        );
        return response.data.choices?.[0]?.message?.content.trim() ?? "";
      } catch (error: any) {
        console.error("Error calling OpenAI API:", error?.response?.data || error.message);
        throw error;
      }
    }

    // Streaming path:
    const requestBody = {
      model: this.model,
      temperature: this.temperature,
      messages,
      stream: true
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    let finalText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split("\n").filter(line => line.trim() !== "");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.replace("data: ", "");
          if (dataStr === "[DONE]") {
            break;
          }
          try {
            const data = JSON.parse(dataStr);
            const content = data?.choices?.[0]?.delta?.content;
            if (content) {
              finalText += content;
              if (this.onToken) this.onToken(content);
            }
          } catch {
            // ignore keep-alive or invalid lines
          }
        }
      }
    }

    return finalText.trim();
  }
}
