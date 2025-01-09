/**
 * agent_team_advanced.ts
 *
 * Demonstrates advanced synergy:
 * 1) Shared memory among multiple agents
 * 2) Interleaved chat approach until we detect a "FINAL ANSWER"
 *    - Round-robin the agents in a while loop until a convergence condition (like `"FINAL ANSWER"`) is met
 * 3) Aggregator agent merges everything
 */

import { Agent } from "../../agents/Agent";
import { AdvancedAgentTeam } from "../../multi-agent/AdvancedAgentTeam";
import { CompositeMemory } from "../../memory/CompositeMemory";
import { ShortTermMemory } from "../../memory/ShortTermMemory";
import { OpenAIChat } from "../../LLMs/OpenAIChat";

async function main() {
  // LLMs
  const model1 = new OpenAIChat({ apiKey: "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", model: "gpt-4o-mini" });
  const model2 = new OpenAIChat({ apiKey: "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", model: "gpt-4o-mini" });
  const aggregatorModel = new OpenAIChat({ apiKey: "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", model: "gpt-4o-mini" });

  // Each agent might have short-term memory
  const agent1Mem = new ShortTermMemory(5);
  const agent2Mem = new ShortTermMemory(5);

  // Agents
  const agent1 = Agent.create({
    name: "AgentOne",
    model: model1,
    memory: agent1Mem,
    instructions: [`
        You are AgentOne, an expert in numerical insights about mathematical constants like Pi. 
        Your job is to focus strictly on providing numerical insights, calculations, and scientific properties. 
        Do not provide historical or linguistic information. Another agent will handle that. 
        Provide your answer clearly without mentioning the other agent's role.
    `],
    options: { maxSteps: 3, useReflection: false, debug: true }
  });

  const agent2 = Agent.create({
    name: "AgentTwo",
    model: model2,
    memory: agent2Mem,
    instructions: [`
        You are AgentTwo, an expert in the historical and linguistic aspects of mathematical constants like Pi. 
        Your job is to focus strictly on historical and linguistic information. 
        Do not provide numerical insights, calculations, or scientific properties. Another agent will handle that. 
        Provide your answer clearly without mentioning the other agent's role.
    `],
    options: { maxSteps: 3, useReflection: false, debug: true }
  });

  // aggregator agent merges final answers
  const aggregatorAgent = Agent.create({
    name: "Aggregator",
    model: aggregatorModel,
    memory: new ShortTermMemory(5),
    instructions: ["Merge or unify the messages from the sub-agents into a cohesive final answer."],
    options: { maxSteps: 3, useReflection: false, debug: true }
  });

  // Create a shared memory if you want them to truly share a conversation
  // (Or you can skip if you want them separate.)
  const sharedMemory = new CompositeMemory(agent1Mem, agent2Mem);

  // Build an advanced team
  const advancedTeam = new AdvancedAgentTeam("NumberWordTeam", [agent1, agent2], sharedMemory);

  // Let's enable shared memory so both agents see the same conversation
  advancedTeam.enableSharedMemory();

  // We'll do an interleaved approach until we see the phrase "FINAL ANSWER" or 8 rounds.
  function checkConverged(lastMsg: string) {
    return lastMsg.includes("FINAL ANSWER");
  }

  console.log("\n--- Interleaved Chat Approach ---");
  const userQuery = `
    Please collaborate to provide a comprehensive answer about 'Pi.' 
    One of you should focus on numerical insights, while the other should focus on historical and linguistic aspects. 
    Conclude with 'FINAL ANSWER:' once all contributions are included.
  `;
  const interleavedOutput = await advancedTeam.runInterleaved(userQuery, 8, checkConverged, false);
  console.log("\nInterleaved Contributions:\n", interleavedOutput);

  console.log("\n--- Aggregator Step ---");
  // Aggregator agent unifies the responses
  const aggregatorFinal = await aggregatorAgent.run(interleavedOutput);
  console.log("\nFinal Aggregated Answer:\n", aggregatorFinal);
}

main().catch(console.error);
