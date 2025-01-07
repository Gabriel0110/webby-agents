import { Tool } from "./Tools";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DuckDuckGoSearchResult {
  FirstURL?: string;
  Text?: string;
}

/**
 * A tool that fetches DuckDuckGo search results using the DuckDuckGo Lite API.
 * Allows setting delay and maximum results.
 */
export class DuckDuckGoTool implements Tool {
  name = "DuckDuckGo";
  description = "Searches the web using DuckDuckGo's Lite API";

  private delayMs: number;
  private maxResults: number;

  constructor(options?: { delay?: number; maxResults?: number }) {
    this.delayMs = options?.delay ?? 0; // Default to 0ms (no delay)
    this.maxResults = Math.max(1, options?.maxResults ?? 1); // Ensure at least 1 result
  }

  /**
   * Executes a DuckDuckGo search and returns formatted results.
   */
  async run(input: string): Promise<string> {
    console.log(`[DuckDuckGoTool] Received input: "${input}"`);
  
    try {
      if (this.delayMs > 0) {
        console.log(`[DuckDuckGoTool] Adding delay of ${this.delayMs}ms...`);
        await delay(this.delayMs);
      }
  
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_redirect=1`;
      console.log(`[DuckDuckGoTool] Fetching URL: ${url}`);
  
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      console.log(`[DuckDuckGoTool] Raw API Response:`, data);
  
      const results = data.RelatedTopics || [];
      if (!results.length) {
        console.warn(`[DuckDuckGoTool] No search results found.`);
        return "No search results found.";
      }
  
      const topResults = results.slice(0, this.maxResults).map((result: DuckDuckGoSearchResult, index: number) => {
        const title = result.Text || "No Title";
        const url = result.FirstURL || "No URL";
        return `Title: ${title}\nLink: ${url}`;
      });
  
      const formattedResults = topResults.join("\n\n");
      console.log(`[DuckDuckGoTool] Returning results:\n${formattedResults}`);
      return formattedResults;
    } catch (err: any) {
      console.error(`[DuckDuckGoTool] Error occurred:`, err);
      return `Error searching DuckDuckGo: ${err.message}`;
    }
  }  
}
