// src/tools/Tool.ts

/**
 * Defines the interface for Tools that an Agent can call.
 */
export interface Tool {
    /** 
     * A short name or identifier for the tool (e.g., "DuckDuckGo"). 
     */
    name: string;
    /**
     * A human-readable description of what the tool does.
     */
    description?: string;
  
    /**
     * Executes the tool with the given input, returning the result as a string.
     */
    run(input: string): Promise<string>;
  }  
