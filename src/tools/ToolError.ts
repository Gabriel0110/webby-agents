// src/tools/ToolError.ts

/**
 * A dedicated error class for tool-related issues.
 * This centralizes error handling logic so that the Agent or other parts
 * can catch and process errors consistently.
 */
export class ToolError extends Error {
    public toolName: string;
  
    constructor(toolName: string, message: string) {
      super(`ToolError [${toolName}]: ${message}`);
      this.toolName = toolName;
      Object.setPrototypeOf(this, ToolError.prototype);
    }
  }