/**
 * agent_team_advanced.ts
 *
 * Demonstrates advanced synergy:
 * 1) Shared memory among multiple agents
 * 2) Interleaved chat approach until we detect a "FINAL ANSWER"
 * 3) Aggregator agent merges everything
 */

import { Agent } from "../../Agent";
import { AdvancedAgentTeam } from "../../multi-agent/AdvancedAgentTeam";
import { CompositeMemory } from "../../memory/CompositeMemory";
import { ShortTermMemory } from "../../memory/ShortTermMemory";
import { OpenAIChat } from "../../LLMs/OpenAIChat";

async function main() {
  // LLMs
  const model1 = new OpenAIChat({ apiKey: "...", model: "gpt-4o-mini" });
  const model2 = new OpenAIChat({ apiKey: "...", model: "gpt-4o-mini" });
  const aggregatorModel = new OpenAIChat({ apiKey: "...", model: "gpt-4o-mini" });

  // Each agent might have short-term memory
  const agent1Mem = new ShortTermMemory(5);
  const agent2Mem = new ShortTermMemory(5);

  // Agents
  const agent1 = Agent.create({
    name: "AgentOne",
    model: model1,
    memory: agent1Mem,
    instructions: ["You're specialized in number facts."],
    options: { maxSteps: 3, useReflection: false }
  });

  const agent2 = Agent.create({
    name: "AgentTwo",
    model: model2,
    memory: agent2Mem,
    instructions: ["You're specialized in word definitions."],
    options: { maxSteps: 3, useReflection: false }
  });

  // aggregator agent merges final answers
  const aggregatorAgent = Agent.create({
    name: "Aggregator",
    model: aggregatorModel,
    memory: new ShortTermMemory(5),
    instructions: ["Merge or unify the messages from the sub-agents into a cohesive final answer."],
    options: { maxSteps: 3, useReflection: false }
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
  const userQuery = "Could you two collaborate on the definition and numeric facts about 'Pi'?\nPlease finalize with 'FINAL ANSWER:' once done.";
  const interleavedOutput = await advancedTeam.runInterleaved(userQuery, 8, checkConverged);
  console.log("\nInterleaved Result:\n", interleavedOutput);

  console.log("\n--- Aggregator Step ---");
  // aggregator merges the final answers if needed
  const aggregatorFinal = await aggregatorAgent.run(interleavedOutput);
  console.log("\nAggregator Final:\n", aggregatorFinal);
}

main().catch(console.error);
