import { Agent } from "../agents/Agent";
import { SimpleLLMPlanner } from "../Planner";
import { OpenAIChat } from "../LLMs/OpenAIChat";
import { ShortTermMemory } from "../memory/ShortTermMemory";
import { Tool } from "../tools/Tools";

// Dummy tool
class DummyCalendarTool implements Tool {
  name = "Calendar";
  description = "Manages event scheduling and date lookups (dummy).";
  
  async run(input: string): Promise<string> {
    return `FAKE CALENDAR ACTION: ${input}`;
  }
}

async function main() {
  // 1) Create an LLM for both agent & planner
  const mainModel = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.7
  });
  const plannerModel = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.3
  });

  // 2) Planner
  const planner = new SimpleLLMPlanner(plannerModel);

  // 3) Memory
  const memory = new ShortTermMemory(5);

  // 4) Tool
  const calendar = new DummyCalendarTool();

  // 5) Create Agent with Planner
  const agent = Agent.create({
    name: "PlannerAgent",
    model: mainModel,
    memory,
    tools: [calendar],
    planner,
    instructions: [
      "You can plan tasks first, then execute them. If a plan step references 'Calendar', call the Calendar tool."
    ],
    options: {
      maxSteps: 5,
      usageLimit: 10,
      timeToLive: 30000,
      useReflection: true,
      debug: true,
    },
    hooks: {
      onPlanGenerated: (plan) => {
        console.log("[PLAN GENERATED]\n", plan);
      }
    }
  });

  // 6) User request
  const userQuery = "Schedule a meeting next Friday to discuss project updates.";
  console.log("User Query:", userQuery);

  // 7) Run agent
  const answer = await agent.run(userQuery);
  console.log("\nFinal Answer:\n", answer);
}

main().catch(console.error);
