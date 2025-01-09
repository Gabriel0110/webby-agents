import { Agent, AgentOptions } from "../Agent";
import { OpenAIChat } from "../LLMs/OpenAIChat";
import { ShortTermMemory } from "../memory/ShortTermMemory";
import { Tool } from "../tools/Tools";

// Dummy tool #1
class FakeSearchTool implements Tool {
  name = "FakeSearch";
  description = "Simulates a search engine lookup (dummy).";

  async run(input: string): Promise<string> {
    // This is just a stubbed implementation
    return `FAKE SEARCH RESULTS for "${input}" (no real search done).`;
  }
}

// Dummy tool #2
class FakeTranslatorTool implements Tool {
  name = "FakeTranslator";
  description = "Pretends to translate input text into French.";

  async run(input: string): Promise<string> {
    return `FAKE TRANSLATION to French of: "${input}" => [Ceci est une traduction factice]`;
  }
}

async function main() {
  // 1) Create LLM
  const chatModel = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.7,
  });

  // 2) Memory
  const mem = new ShortTermMemory(10);

  // 3) Tools
  const searchTool = new FakeSearchTool();
  const translatorTool = new FakeTranslatorTool();

  // 4) Agent Options
  const options: AgentOptions = {
    maxSteps: 5,
    usageLimit: 5,
    timeToLive: 60000,
    useReflection: true,
  };

  // 5) Create Agent with multiple tools
  const agent = Agent.create({
    name: "MultiToolAgent",
    model: chatModel,
    memory: mem,
    tools: [searchTool, translatorTool],
    instructions: [
      "You can use FakeSearch to look up information. Output exactly TOOL REQUEST if you need it.",
      "You can use FakeTranslator to convert text to French."
    ],
    options
  });

  // 6) User question
  const userQuestion = "Search for today's top news and then translate the summary into French.";
  console.log("\nUser Question:", userQuestion);

  // 7) Run agent
  const answer = await agent.run(userQuestion);
  console.log("\nAgent's Final Answer:\n", answer);
}

main().catch(console.error);
