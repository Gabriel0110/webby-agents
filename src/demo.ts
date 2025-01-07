import 'dotenv/config';
import { Agent, AgentOptions } from "./Agent";
import { ShortTermMemory, SummarizingMemory, LongTermMemory } from "./memory";
import { OpenAIChat, OpenAIEmbeddings } from "./LLMs";
import { DuckDuckGoTool } from "./tools/DuckDuckGoTool";

// import { Agent, AgentOptions } from "webby-agent";
// import { ShortTermMemory, SummarizingMemory, LongTermMemory } from "webby-agent/memory";
// import { OpenAIChat, OpenAIEmbeddings } from "webby-agent/LLMs";
// import { DuckDuckGoTool } from "webby-agent/tools";

async function main() {

  // 1) Create LLM
  const chatModel = new OpenAIChat({
    model: "gpt-4o-mini",
    temperature: 0.7
  });

  // 2) Create Memory (short-term, up to 10 messages, very basic memory model for short-term context)
  const shortTermMem = new ShortTermMemory(10);

  // 2.1) OPTIONAL: Summarizing memory for slightly longer context, summarizing past conversations
  const summarizerModel = new OpenAIChat({
    model: "gpt-4o-mini",
    temperature: 1.0
  });

  const summarizingMem = new SummarizingMemory({
    threshold: 5,
    summarizerModel,
    summaryPrompt: "Summarize the following conversation clearly:",
    maxSummaryTokens: 200
  });

  // 2.2) OPTIONAL: Long-term memory with embeddings for memory search
  const embeddingsModel = new OpenAIEmbeddings({
    model: "text-embedding-3-small"
  });

  const longTermMem = new LongTermMemory({
    embeddings: embeddingsModel,
    maxMessages: 500,
    topK: 3
  });

  // 3) Create Tools (here, just DuckDuckGo)
  const duckTool = new DuckDuckGoTool({
    delay: 2000, // 2s delay to avoid rate limiting
    maxResults: 1 // only 1 result from the search
  });

  // 4) Agent options with several safeguard options to protect against infinite loops and excessive API usage
  const agentOptions: AgentOptions = {
    maxSteps: 5,         // up to 5 reflection loops
    usageLimit: 5,       // up to 5 total LLM calls
    timeToLive: 60_000,  // 60s TTL
    useReflection: true  // multi-step
  };

  // 5) Instantiate the Agent
  const agent = new Agent(
    chatModel,        // Model
    summarizingMem,   // Memory
    [duckTool],       // Tools
    [                 // Instructions
      "You are a helpful agent that can search the web for the latest information.",
      "Always check if a web search is needed if the user asks for up-to-date or current data about anything."
    ],
    agentOptions      // Agent options
  );

  // 6) The user’s query that needs fresh data from the web
  const userQuestion = "What is the weather like today in Dallas, GA 30157?";
  console.log("\nUser Question:", userQuestion);

  // 7) Let the agent handle the question
  const answer = await agent.run(userQuestion);
  console.log("\nAgent's Final Answer:\n", answer);
}

async function basicAgent() {
  const model = new OpenAIChat({
    model: "gpt-4o-mini",
    temperature: 0.7
  });

  const shortTermMem = new ShortTermMemory(10);

  // Agent options: single-pass only
  const agentOptions: AgentOptions = {
    useReflection: false,
    maxSteps: 1,
    usageLimit: 1
  };

  const agent = new Agent(
    model,
    shortTermMem,
    [],
    ["You are a helpful assistant."], 
    agentOptions
  );

  const response = await agent.run("Hello, how are you?");
  console.log("Agent response:", response);
}

main().catch(console.error);
//basicAgent().catch(console.error);
