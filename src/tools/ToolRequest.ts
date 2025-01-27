// src/tools/ToolRequest.ts

import { Tool } from "./Tools";
import { ToolError } from "./ToolError";

/**
 * Represents the parsed request from an LLM's output.
 * Example: TOOL REQUEST: MyTool "some query"
 */
export interface ParsedToolRequest {
  toolName: string;
  query: string;
  args?: Record<string, any>; // JSON for structured parameters
}

export class ToolRequestParser {
  /**
   * We match either:
   * 1. Simple pattern: TOOL REQUEST: <ToolName> "<Query>"
   * 2. JSON pattern: TOOL REQUEST: <ToolName> {"key": "value"}
   */
  private static readonly SIMPLE_PATTERN = /^TOOL REQUEST:\s*(\w+)\s+"([^"]+)"$/i;
  private static readonly JSON_PATTERN = /^TOOL REQUEST:\s*(\w+)\s+(\{.*\})$/is;

  /**
   * Attempt to parse a string into a ParsedToolRequest.
   * If we detect JSON, we parse the `args` object.
   */
  static parse(input: string): ParsedToolRequest | null {
    // First try JSON pattern
    const jsonMatch = input.match(this.JSON_PATTERN);
    if (jsonMatch) {
      try {
        const toolName = jsonMatch[1];
        const jsonString = jsonMatch[2];
        const parsedArgs = JSON.parse(jsonString);
        return {
          toolName,
          query: JSON.stringify(parsedArgs), // Store full JSON as query
          args: parsedArgs
        };
      } catch (err) {
        // If JSON parsing fails, continue to try simple pattern
      }
    }

    // Try simple pattern
    const match = input.match(this.SIMPLE_PATTERN);
    if (!match) return null;
    
    return {
      toolName: match[1],
      query: match[2]
    };
  }

  /**
   * Validates that the request references an available tool and has minimal required fields.
   */
  static validateBasic(request: ParsedToolRequest, tools: Tool[]): string | null {
    if (!request.toolName || !request.query) {
      return "Invalid tool request format.";
    }
  
    if (tools.length === 0) {
      return `No tools are available, but a tool request was made: "${request.toolName}".`;
    }
  
    const tool = tools.find((t) => t.name.toLowerCase() === request.toolName.toLowerCase());
    if (!tool) {
      return `Tool "${request.toolName}" is not available.`;
    }
  
    return null; // Valid request
  }  

  /**
   * Enhanced parameter validation if the tool supports parameters.
   * We can handle either (a) a single string query or (b) a JSON 'args' object.
   */
  static validateParameters(tool: Tool, request: ParsedToolRequest): void {
    // If no parameters are declared, no further validation needed
    if (!tool.parameters || tool.parameters.length === 0) {
      return;
    }

    // If the tool expects structured parameters, we should parse from request.args
    // For a simpler approach, we treat the entire `request.query` as one "input" param
    // but let's demonstrate how to do more advanced usage with request.args
    if (request.args) {
      for (const param of tool.parameters) {
        if (param.required && !(param.name in request.args)) {
          throw new ToolError(tool.name, `Missing required parameter: "${param.name}"`);
        }
      }
      // Optional: check param types, etc.
    } else {
      // The tool might expect a single string if it only has one param
      // If multiple parameters are expected but we only have a single query,
      // that might be insufficient or invalid.
      if (tool.parameters.length > 1) {
        throw new ToolError(tool.name, `Tool "${tool.name}" requires multiple parameters, but only a single query string was provided.`);
      }
    }
  }
}