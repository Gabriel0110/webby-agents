// src/examples/advanced/agent_subteam_routing.ts

import { Agent } from "../../agents/Agent";
import { AgentTeam } from "../../agents/multi-agent/AgentTeam";
import { AgentRouter } from "../../agents/multi-agent/AgentRouter";
import { ShortTermMemory } from "../../memory/ShortTermMemory";
import { OpenAIChat } from "../../LLMs/OpenAIChat";

// Suppose we have 5 agents, but we want to route queries to subsets
async function main() {
  // 5 specialized Agents
  const agents: Agent[] = [
    Agent.create({
      model: new OpenAIChat({ apiKey: "YOUR-API-KEY", model: "gpt-4o-mini" }),
      memory: new ShortTermMemory(5),
      instructions: ["You are specialized in finance, investments, and budgeting."],
      options: { useReflection: false, maxSteps: 1 }
    }), // Agent #0: Finance

    Agent.create({
      model: new OpenAIChat({ apiKey: "YOUR-API-KEY", model: "gpt-4o-mini" }),
      memory: new ShortTermMemory(5), 
      instructions: ["You are specialized in legal advice and regulations."],
      options: { useReflection: false, maxSteps: 1 }
    }), // Agent #1: Legal

    Agent.create({
      model: new OpenAIChat({ apiKey: "YOUR-API-KEY", model: "gpt-4o-mini" }),
      memory: new ShortTermMemory(5),
      instructions: ["You are specialized in technology and programming."],
      options: { useReflection: false, maxSteps: 1 }
    }), // Agent #2: Tech

    Agent.create({
      model: new OpenAIChat({ apiKey: "YOUR-API-KEY", model: "gpt-4o-mini" }),
      memory: new ShortTermMemory(5),
      instructions: ["You are specialized in travel and hospitality advice."],
      options: { useReflection: false, maxSteps: 1 }
    }), // Agent #3: Travel

    Agent.create({
      model: new OpenAIChat({ apiKey: "YOUR-API-KEY", model: "gpt-4o-mini" }),
      memory: new ShortTermMemory(5),
      instructions: ["You are a general knowledge assistant."],
      options: { useReflection: false, maxSteps: 1 }
    }) // Agent #4: General
  ];

  // Then create an AgentRouter that picks which subset to run
  const routerFn = (query: string): number => {
    const lower = query.toLowerCase();
    if (lower.includes("stock") || lower.includes("budget")) return 0;       // finance
    if (lower.includes("law") || lower.includes("sue")) return 1;            // legal
    if (lower.includes("programming") || lower.includes("nodejs")) return 2; // tech
    if (lower.includes("travel") || lower.includes("hotel")) return 3;       // travel
    return 4;                                                                // general
  };

  // Basic router that picks 1 agent from the 5
  const mainRouter = new AgentRouter(agents, routerFn);

  // But let's say for queries that mention "I want multiple opinions",
  // we want a sub-team approach
  async function advancedRun(query: string): Promise<string> {
    if (query.includes("multiple opinions")) {
      // run all agents in parallel
      const team = new AgentTeam("AllAgentsTeam", agents);
      const results = await team.runInParallel(query);
      return results.join("\n---\n");
    } else {
      // otherwise route to just one
      return mainRouter.run(query);
    }
  }

  // Example usage
  const userQueries = [
    "What's a good stock to invest in?",
    "I want multiple opinions on NodeJS frameworks",
    "Is it legal to break a lease early?",
  ];

  for (const q of userQueries) {
    console.log(`\nUser: "${q}"`);
    const response = await advancedRun(q);
    console.log(`\nResponse:\n${response}`);
  }
}

main().catch(console.error);
