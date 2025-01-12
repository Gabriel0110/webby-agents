// src/examples/advanced/llm_convergence_demo.ts

/**
 * This demo showcases usage of the LLM convergence checker for multi-agent analysis.
 * It showcases the benefits of having an LLM check for convergence criteria vs more simple/basic hardcoded checks
 * displayed in agent_team_advanced.ts.
 * 
 * The LLM convergence checker uses an LLM (obviously) - this means your prompt(s) should be very well-structured like any
 * other agent prompt in order to ensure the LLM can accurately determine if the content meets the criteria. Prompt quality
 * is key to the success of the LLM convergence checker, just like any other LLM-based system.
 */

import { Agent } from "../../agents/Agent";
import { AdvancedAgentTeam, TeamConfiguration } from "../../agents/multi-agent/AdvancedAgentTeam";
import { ShortTermMemory } from "../../memory/ShortTermMemory";
import { CompositeMemory } from "../../memory/CompositeMemory";
import { OpenAIChat } from "../../LLMs/OpenAIChat";
import { LLMConvergenceChecker, ConvergenceCriteria } from "../../agents/LLMConvergenceChecker";

async function main() {
  // Initialize our LLM
  const model = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini"
  });

  // Create short-term memories for each agent
  const prosAgentMemory = new ShortTermMemory(5);
  const consAgentMemory = new ShortTermMemory(5);

  // Create shared memory
  const sharedMemory = new CompositeMemory(
    prosAgentMemory,
    consAgentMemory
  );

  // Create two simple agents: one for pros, one for cons
  const prosAgent = Agent.create({
    name: "ProsAgent",
    model,
    memory: prosAgentMemory,
    instructions: [
      "You are an analyst focused on identifying and explaining advantages and benefits.",
      "Always structure your response with clear sections.",
      "Include specific examples and evidence.",
      "End with clear recommendations.",
      "Format your final response with 'FINAL ANSWER:' prefix."
    ],
    options: { 
      maxSteps: 3,
      useReflection: false,
      debug: true
    }
  });

  const consAgent = Agent.create({
    name: "ConsAgent",
    model,
    memory: consAgentMemory,
    instructions: [
      "You are an analyst focused on identifying and explaining disadvantages and risks.",
      "Always structure your response with clear sections.",
      "Include specific examples and evidence.",
      "End with risk mitigation strategies.",
      "Format your final response with 'FINAL ANSWER:' prefix."
    ],
    options: { 
      maxSteps: 3,
      useReflection: false,
      debug: true
    }
  });

  // Define team roles
  const teamConfig: TeamConfiguration = {
    roles: new Map([
      ["ProsAgent", {
        name: "Advantages Analyst",
        description: "Focuses on benefits and opportunities",
        queryTransform: (query: string) => 
          `${query}\nAnalyze the advantages and benefits of this situation.`
      }],
      ["ConsAgent", {
        name: "Risks Analyst",
        description: "Focuses on disadvantages and risks",
        queryTransform: (query: string) => 
          `${query}\nAnalyze the disadvantages and risks of this situation.`
      }]
    ])
  };

  // Create convergence criteria
  const analysisConvergenceCriteria: ConvergenceCriteria = {
    customInstructions: [
      "Check if the analysis provides detailed explanations",
      "Verify that examples are specific and relevant",
      "Ensure recommendations are actionable",
      "Confirm the response is well-structured with clear sections"
    ]
  };

  // Create new model for the LLM convergence checker with temp of 0 (not required but recommended)
    const convergenceModel = new OpenAIChat({
        apiKey: "YOUR-API-KEY",
        model: "gpt-4o-mini",
        temperature: 0
    });

  // Create LLM convergence checker
  const convergenceChecker = new LLMConvergenceChecker(
    model,
    analysisConvergenceCriteria,
    true // Enable debug logging
  );

  // Create the team
  const team = new AdvancedAgentTeam(
    "ProsConsTeam",
    [prosAgent, consAgent],
    {
      sharedMemory,
      teamConfig,
      debug: true
    }
  );

  // Enable shared memory
  team.enableSharedMemory();

  // Test queries
  const queries = [
    "Should a small business invest in artificial intelligence technology?",
    "What are the implications of switching to a remote-first work policy?",
    "Should a company expand internationally or focus on domestic growth?"
  ];

  console.log("=== Testing LLM Convergence with Pros/Cons Analysis ===\n");

  for (const query of queries) {
    console.log(`\nAnalyzing Query: "${query}"`);
    console.log("=".repeat(50));

    try {
      const result = await team.runInterleaved(
        query,
        3, // max rounds
        async (msg) => await convergenceChecker.hasConverged(msg),
        true // require all agents
      );

      console.log("\nFinal Team Analysis:");
      console.log(result);
      
      // Add separator between queries
      console.log("\n" + "-".repeat(80) + "\n");

    } catch (error) {
      console.error("Error processing query:", error);
    }
  }

  // Display some statistics
  console.log("\n=== Analysis Complete ===");
  console.log("Queries processed:", queries.length);
}

main().catch(console.error);