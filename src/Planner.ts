// src/Planner.ts

import { Tool } from "./tools/Tools";
import { Memory } from "./memory/Memory";
import { OpenAIChat } from "./LLMs/OpenAIChat";

/**
 * The interface for a Planner that can produce a plan string or structured plan
 * from a user query, the known tools, and conversation memory.
 */
export interface Planner {
  generatePlan(
    userQuery: string,
    tools: Tool[],
    memory: Memory
  ): Promise<string>;
}

/**
 * A naive LLM-based planner that just has some prompt instructions for plan generation.
 */
export class SimpleLLMPlanner implements Planner {
    private plannerModel: OpenAIChat;
  
    constructor(plannerModel: OpenAIChat) {
      this.plannerModel = plannerModel;
    }

    public async generatePlan(userQuery: string, tools: Tool[], memory: Memory): Promise<string> {
        const context = await memory.getContext();
        const toolDescriptions = tools.map((t) => `${t.name}: ${t.description}`).join("\n");
      
        const planPrompt = [
          { role: "system", content: "You are a task planning assistant." },
          {
            role: "user",
            content: `User query: "${userQuery}"\n\nTools available:\n${toolDescriptions}\n\nContext:\n${context
              .map((m) => `${m.role}: ${m.content}`)
              .join("\n")}\n\nPlan the steps required to solve the user's query. You may also refine plans based on intermediate results. Use JSON format like this:\n[
          { "action": "tool", "details": "ToolName" },
          { "action": "message", "details": "Message to user or model" },
          { "action": "complete", "details": "FINAL ANSWER" }
        ]`,
          },
        ];
      
        return await this.plannerModel.call(planPrompt);
    }
  }
  
