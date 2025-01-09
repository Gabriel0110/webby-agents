// src/tools/Tool.ts

import { ToolParameter, ToolDocumentation } from "./ToolMetadata";

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
   * (Optional) A list of parameter definitions for validating or documenting input.
   */
  parameters?: ToolParameter[];

  /**
   * Additional documentation for advanced usage or function-calling patterns.
   */
  docs?: ToolDocumentation;

  /**
   * Executes the tool with the given input string and optionally a structured args object.
   * The 'input' will usually be the extracted string from "TOOL REQUEST: <ToolName> \"<Query>\""
   */
  run(input: string, args?: Record<string, any>): Promise<string>;
}
