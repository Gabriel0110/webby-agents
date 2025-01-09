// src/demo.ts
import { Agent, AgentOptions } from "./agents/Agent";
import { ShortTermMemory, SummarizingMemory, LongTermMemory, CompositeMemory } from "./memory/index";
import { OpenAIChat, OpenAIEmbeddings } from "./LLMs/index";
import { DuckDuckGoTool } from "./tools/DuckDuckGoTool";
import { SimpleLLMPlanner } from "./Planner";
import { SimpleEvaluator } from "./Evaluators/SimpleEvaluator";

async function main() {
  // 1) Create the Chat Model
  const chatModel = new OpenAIChat({
    apiKey: "your-api-key-here",
    model: "gpt-4o-mini",
    temperature: 0.7,
  });

  // 2) Create Memories
  const shortTermMem = new ShortTermMemory(10);

  const summarizerModel = new OpenAIChat({
    apiKey: "your-api-key-here",
    model: "gpt-4o-mini",
    temperature: 1.0,
  });
  const summarizingMem = new SummarizingMemory({
    threshold: 5,
    summarizerModel,
    summaryPrompt: "Summarize the following conversation clearly:",
    maxSummaryTokens: 200,
  });

  const embeddingsModel = new OpenAIEmbeddings({
    apiKey: "your-api-key-here",
    model: "text-embedding-3-small",
  });
  const longTermMem = new LongTermMemory({
    embeddings: embeddingsModel,
    maxMessages: 500,
    topK: 3,
  });

  // Composite memory using shortTerm + summarizing
  const compositeMem = new CompositeMemory(shortTermMem, summarizingMem, longTermMem);

  // 3) Tools
  const duckTool = new DuckDuckGoTool({
    delay: 2000,
    maxResults: 1,
  });

  // 4) Planner (Optional)
  const plannerModel = new OpenAIChat({
    apiKey: "your-api-key-here",
    model: "gpt-4o-mini",
    temperature: 0.5,
  });
  const simplePlanner = new SimpleLLMPlanner(plannerModel);

  // 5) Agent options
  const agentOptions: AgentOptions = {
    maxSteps: 5,
    usageLimit: 5,
    timeToLive: 60_000,
    useReflection: true,
    debug: true,
  };

  // 6) Hooks (optional)
  const hooks = {
    onPlanGenerated: (plan: string) => {
      console.log("[Hook] Plan generated:\n", plan);
    },
    onToolCall: async (toolName: string, query: string) => {
      console.log(`[Hook] About to call tool "${toolName}" with query="${query}"`);
      return true; // returning false would cancel the call
    },
    onFinalAnswer: (answer: string) => {
      console.log("[Hook] Final answer is:", answer);
    },
    onStep: (msgs: any) => {
      console.log("[Hook] Step completed. Conversation so far:", msgs);
    },
  };

  // 7) Instantiate Agent
  const agent = Agent.create({
    name: "WebSearchAgent",
    model: chatModel,
    memory: compositeMem,
    tools: [duckTool],
    planner: simplePlanner,
    instructions: [
      "You are a helpful agent that can search the web for the latest information.",
      "Always check if a web search is needed if the user asks for current or up-to-date data.",
    ],
    options: agentOptions,
    hooks,
  });

  // 8) Evaluate the final result (optional)
  const evaluatorModel = new OpenAIChat({
    apiKey: "your-api-key-here",
    model: "gpt-4o-mini",
  });
  const evaluator = new SimpleEvaluator(evaluatorModel);

  // 9) Run the agent
  const userQuestion = "What is the weather like today in Dallas, GA 30157?";
  console.log("\nUser Question:", userQuestion);

  const answer = await agent.run(userQuestion);

  // 10) Evaluate answer
  const conversation = await compositeMem.getContext();
  const evalResult = await evaluator.evaluate(conversation);
  console.log("[Evaluation] Score:", evalResult.score, "Feedback:", evalResult.feedback);

  console.log("\nAgent's Final Answer:\n", answer);
}

main().catch(console.error);
