/*
*
* UNDER DEVELOPMENT - NOT YET IMPLEMENTED
* 
*/

// import { Agent, AgentOptions } from "../Agent";
// import { MemoryTool } from "../tools/MemoryTool";
// import { CompositeMemory } from "../memory/CompositeMemory";
// import { ShortTermMemory } from "../memory/ShortTermMemory";
// import { SummarizingMemory } from "../memory/SummarizingMemory";
// import { LongTermMemory } from "../memory/LongTermMemory";
// import { OpenAIChat, OpenAIEmbeddings } from "../LLMs";

// async function main() {
//   // 1) LLM and Embeddings
//   const model = new OpenAIChat({
//     apiKey: "YOUR-API-KEY",
//     model: "gpt-4o-mini",
//   });

//   const embeddings = new OpenAIEmbeddings({
//     apiKey: "YOUR-API-KEY"
//   });

//   // 2) Memories
//   const shortMem = new ShortTermMemory(5);
//   const summarizingMem = new SummarizingMemory({
//     threshold: 5,
//     summarizerModel: model,
//     hierarchical: false
//   });
//   const longMem = new LongTermMemory({ embeddings, topK: 3 });
//   const composite = new CompositeMemory(shortMem, summarizingMem, longMem);

//   // 3) MemoryTool with embeddings
//   const memoryTool = new MemoryTool(
//     composite, 
//     embeddings,
//     "Store and retrieve information using semantic search. Use 'store:' prefix to save explicitly."
//   );

//   // 4) Agent
//   const agent = Agent.create({
//     name: "MemoryToolAgent",
//     model,
//     memory: shortMem,
//     tools: [memoryTool],
//     instructions: [
//       "You are equipped with short-term memory of recent conversations.",
//       "ALWAYS check your recent conversation context BEFORE using the Memory tool.",
//       "Only use the Memory tool when:",
//       "- You need to explicitly store important information for long-term recall",
//       "- You need to retrieve information that is NOT in your recent conversation",
//       "If you can find the information in the recent conversation, use that directly without calling the Memory tool.",
//       "To store: TOOL REQUEST: Memory \"store: <information>\"",
//       "To retrieve: First check recent context, then if needed: TOOL REQUEST: Memory \"<query>\"",
//       "Examples:",
//       "Good (using recent context):",
//       "User: What's my budget?\nAssistant: Based on our recent conversation, your budget is $1,500.",
//       "Good (using Memory tool):",
//       "User: What did we discuss last week?\nAssistant: TOOL REQUEST: Memory \"previous week's discussion\"",
//       "Bad (unnecessary tool use):",
//       "User: What did I just say?\nAssistant: TOOL REQUEST: Memory \"what user just said\"",
//     ],
//     options: {
//       maxSteps: 5,
//       timeToLive: 60000,
//       useReflection: true,
//       debug: true,
//       usageLimit: 15
//     }
//   });

//   // 5) Test with a more complex scenario
//   console.log("\n=== Testing Memory Tool with Long-Term Recall ===\n");
  
//   // First conversation about Tokyo
//   await agent.run("Let's talk about my travel plans. I'm flying to Tokyo next month. My budget is around $1,000.");
//   await agent.run("Actually, let's change that to $1,500, but keep track of the old budget in memory.");
  
//   // Simulate some time passing with other conversation
// //   for (let i = 0; i < 6; i++) { // Exceed ShortTermMemory capacity
// //     await agent.run(`Let's discuss topic ${i} that's unrelated to travel...`);
// //   }
  
//   // Now the original budget information should be out of ShortTermMemory
//   console.log("\n=== Testing Recall After Memory Overflow ===\n");
//   const response = await agent.run("What was my original budget for the Tokyo trip?");
//   console.log("Response:\n", response);
// }

// main().catch(console.error);
