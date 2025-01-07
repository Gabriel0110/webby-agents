import { search, SafeSearchType } from "duck-duck-scrape";
import { Tool } from "./Tools";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A tool that fetches DuckDuckGo search results using the duck-duck-scrape package.
 * Allows setting delay and maximum results.
 */
export class DuckDuckGoTool implements Tool {
  name = "DuckDuckGo";
  description = "Searches the web using DuckDuckGo via duck-duck-scrape";

  private delayMs: number;
  private maxResults: number;

  constructor(options?: { delay?: number; maxResults?: number }) {
    this.delayMs = options?.delay ?? 0; // Default to 0 (no delay)
    this.maxResults = Math.max(1, options?.maxResults ?? 1); // Ensure at least 1 result
  }

  async run(input: string): Promise<string> {
    console.log(`[DuckDuckGoTool] Received input: "${input}"`);

    try {
      // Apply delay if set
      if (this.delayMs > 0) {
        console.log(`[DuckDuckGoTool] Adding delay of ${this.delayMs}ms...`);
        await delay(this.delayMs);
      }

      // Perform the search
      console.log(`[DuckDuckGoTool] Searching DuckDuckGo for: "${input}"`);
      const searchResults = await search(input, {
        safeSearch: SafeSearchType.STRICT,
      });

      console.log(`[DuckDuckGoTool] Raw Search Results:`, searchResults);

      if (searchResults.noResults || !searchResults.results.length) {
        console.warn(`[DuckDuckGoTool] No search results found.`);
        return "No search results found.";
      }

      console.log(
        `[DuckDuckGoTool] Search completed. Total results: ${searchResults.results.length}`
      );

      // Extract the top results based on maxResults
      const topResults = searchResults.results.slice(0, this.maxResults).map((result, index) => {
        const title = result.title || "No Title";
        const url = result.url || "No URL";
        const snippet = result.description || "No Snippet";

        console.log(`[DuckDuckGoTool] Result ${index + 1}:`, { title, url, snippet });

        return `Title: ${title}\nLink: ${url}\nSnippet: ${snippet}`;
      });

      return topResults.join("\n\n");
    } catch (err: any) {
      console.error(`[DuckDuckGoTool] Error occurred during search:`, err);
      return `Error searching DuckDuckGo: ${err.message}`;
    }
  }
}
