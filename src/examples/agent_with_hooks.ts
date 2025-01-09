import { Agent } from "../Agent";
import { ShortTermMemory } from "../memory/ShortTermMemory";
import { OpenAIChat } from "../LLMs/OpenAIChat";
import { Tool } from "../tools/Tools";

// Dummy tool
class DummyMathTool implements Tool {
  name = "DummyMath";
  description = "Performs fake math calculations (dummy).";

  async run(input: string): Promise<string> {
    return `FAKE MATH RESULT for "${input}": 42 (always).`;
  }
}

async function main() {
  // 1) Create LLM
  const model = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.6,
  });

  // 2) Memory
  const memory = new ShortTermMemory(5);

  // 3) Hooks
  const hooks = {
    onStep: (messages: any) => {
      console.log("[Hook: onStep] Current conversation so far:", messages);
    },
    onToolCall: async (toolName: string, query: string) => {
      console.log(`[Hook: onToolCall] About to call "${toolName}" with query="${query}"`);
      // Could confirm or deny usage. If we return false, the call is canceled
      return true; 
    },
    onFinalAnswer: (answer: string) => {
      console.log("[Hook: onFinalAnswer] The final answer is:", answer);
    }
  };

  // 4) Create Agent
  const mathTool = new DummyMathTool();
  const agent = Agent.create({
    name: "HookedAgent",
    model,
    memory,
    tools: [mathTool],
    instructions: ["Use DummyMath if the user needs a calculation."],
    hooks,
    options: {
      useReflection: true,
      maxSteps: 5,
      usageLimit: 5,
      timeToLive: 60000,
      debug: true,
    },
  });

  // 5) Run agent
  const question = "What is 123 + 456, approximately?";
  console.log("User asks:", question);

  const answer = await agent.run(question);
  console.log("\nFinal Answer from Agent:\n", answer);
}

main().catch(console.error);
