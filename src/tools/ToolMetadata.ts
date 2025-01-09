// src/tools/ToolMetadata.ts

export interface ToolParameter {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
  }
  
  export interface ToolDocumentation {
    name: string;
    description: string;
    usageExample?: string;
    parameters?: ToolParameter[];
  }
  