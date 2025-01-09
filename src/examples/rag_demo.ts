import { Agent, AgentOptions } from "../Agent";
import { CompositeMemory } from "../memory/CompositeMemory";
import { ShortTermMemory } from "../memory/ShortTermMemory";
import { SummarizingMemory } from "../memory/SummarizingMemory";
import { LongTermMemory } from "../memory/LongTermMemory";
import { OpenAIChat, OpenAIEmbeddings } from "../LLMs";

async function main() {
  // 1) Chat model
  const chatModel = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini"
  });

  // 2) Summarizer model
  const summarizerModel = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini"
  });

  // 3) Embeddings for long-term
  const embeddingsModel = new OpenAIEmbeddings({
    apiKey: "YOUR-API-KEY"
  });

  // 4) Memory instances
  const shortMem = new ShortTermMemory(10);
  const summarizingMem = new SummarizingMemory({
    threshold: 5,
    summarizerModel,
    summaryPrompt: "Summarize earlier conversation:",
    maxSummaryTokens: 200,
  });
  const longTermMem = new LongTermMemory({
    embeddings: embeddingsModel,
    maxMessages: 100,
    topK: 3
  });

  // 5) Composite memory
  const compositeMem = new CompositeMemory(shortMem, summarizingMem, longTermMem);

  // 6) Agent
  const agentOptions: AgentOptions = {
    maxSteps: 5,
    usageLimit: 10,
    timeToLive: 60000,
    useReflection: true,
    debug: true
  };

  const agent = Agent.create({
    name: "RAGAgent",
    model: chatModel,
    memory: compositeMem,
    instructions: [
      "If the user asks about older content, recall from memory. If uncertain, say so politely."
    ],
    options: agentOptions
  });

  // 7) Simulate a user adding data, then later asking about it
  // First: user provides some info
  await agent.run("I'm planning a road trip from LA to Vegas next month, maybe around the 15th.");
  await agent.run("I want to remember that I'll have a budget of $500 total.");

  // Later: user asks
  const question = "Hey, do you recall how much money I budgeted for my LA to Vegas trip?";
  const answer = await agent.run(question);
  console.log("\nFinal Answer:\n", answer);
}

main().catch(console.error);
