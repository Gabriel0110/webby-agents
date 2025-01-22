import { Agent } from "../agents/Agent";
import { OpenAIChat } from "../LLMs/OpenAIChat";
import { ShortTermMemory } from "../memory/ShortTermMemory";

async function main() {
  // 1) Create a minimal LLM
  const chatModel = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.7,
    stream: true, // Stream output to console
    onToken: (token) => process.stdout.write(token), // Hook to process tokens (basic example)
  });

  // 2) Create a simple short-term memory
  const shortTermMemory = new ShortTermMemory(5);

  // 3) Instantiate an Agent with NO reflection or tools
  const agent = Agent.create({
    model: chatModel,
    memory: shortTermMemory,
    instructions: [
      "You are a simple agent. Answer only in one short sentence."
    ],
    options: {
      useReflection: false,  // Single pass only
      maxSteps: 1,
      usageLimit: 2,
      timeToLive: 5000,
    },
  });

  // 4) Run the agent with a simple question
  const userQuestion = "What's a quick tip for staying productive at work?";
  console.log("User Question:", userQuestion);

  const answer = await agent.run(userQuestion);
  console.log("\n\nAgent's Final Answer:", answer);
}

main().catch(console.error);
