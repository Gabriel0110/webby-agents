/**
 * src/examples/advanced/agent_team_safe_example.ts
 *
 * Demonstrates how to use "safe" multi-agent orchestration functions
 * (like runSequentialSafe) with different error-handling strategies.
 * Includes:
 *   - Agents that might throw errors
 *   - 'stopOnError' parameter usage
 *   - TeamHooks for advanced debugging/logging
 *   - Optional aggregator logic if you want a final step
 */

import { Agent } from "../../agents/Agent";
import { AgentTeam } from "../../agents/multi-agent/AgentTeam";
import { ShortTermMemory } from "../../memory/ShortTermMemory";
import { OpenAIChat } from "../../LLMs/OpenAIChat";
import { TeamHooks } from "../../agents/multi-agent/AgentTeam";

// Extend AgentTeam for the sake of having a custom class
class SafeAgentTeam extends AgentTeam {
    // You can change the constructor or add more methods if you want
}

async function main() {
  // 1) Create LLM(s)
  const model1 = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.7,
  });
  const model2 = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.7,
  });
  const model3 = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.7,
  });

  // 2) Create memory for each agent
  const memA = new ShortTermMemory(5);
  const memB = new ShortTermMemory(5);
  const memC = new ShortTermMemory(5);

  // 3) Create agents
  const agentA = Agent.create({
    name: "AgentA",
    model: model1,
    memory: memA,
    instructions: ["Respond politely. (No error here)"],
    options: { maxSteps: 1, useReflection: false }
  });

  // AgentB intentionally might throw an error or produce unexpected output
  const agentB = Agent.create({
    name: "AgentB",
    model: model2,
    memory: memB,
    instructions: ["Pretend to attempt the user query but throw an error for demonstration."],
    options: { maxSteps: 1, useReflection: false }
  });

  // Force an error for agentB to demonstrate safe run
  agentB.run = async (input: string) => {
    throw new Error("Intentional error from AgentB for demonstration!");
  };

  const agentC = Agent.create({
    name: "AgentC",
    model: model3,
    memory: memC,
    instructions: ["Provide a short helpful answer. (No error)"],
    options: { maxSteps: 1, useReflection: false }
  });

  // 4) Create our SafeAgentTeam (again, extends AgentTeam - see AgentTeam.ts)
  const team = new SafeAgentTeam("DemoTeam", [agentA, agentB, agentC]);

  // 5) Define some hooks to see what happens behind the scenes
  const hooks: TeamHooks = {
    onAgentStart: (agentName, input) => {
      console.log(`[START] ${agentName} with input: "${input}"`);
    },
    onAgentEnd: (agentName, output) => {
      console.log(`[END] ${agentName}: output => "${output}"`);
    },
    onError: (agentName, error) => {
      console.error(`[ERROR] in ${agentName}: ${error.message}`);
    },
    onFinal: (outputs) => {
      console.log("Final outputs from the entire sequential run =>", outputs);
    },
  };

  // 6a) Demonstrate runSequentialSafe with stopOnError=true
  //         - With stopOnError=true, the loop breaks immediately after AgentB throws an error,
  //           so AgentC never runs.
  console.log("\n--- runSequentialSafe (stopOnError = true) ---");
  const userPrompt = "Hello from the user!";
  const resultsStopOnError = await team.runSequentialSafe(userPrompt, true, hooks);
  console.log("\nResults (stopOnError=true):", resultsStopOnError);

  // 6b) Demonstrate runSequentialSafe with stopOnError=false
  //         - With stopOnError=false, AgentB's error is logged, but AgentC still gets a chance to run,
  //           producing its output as the final step.
  console.log("\n--- runSequentialSafe (stopOnError = false) ---");
  const userPrompt2 = "Another user query - let's see if we continue after errors.";
  const resultsContinue = await team.runSequentialSafe(userPrompt2, false, hooks);
  console.log("\nResults (stopOnError=false):", resultsContinue);
}

main().catch(console.error);
