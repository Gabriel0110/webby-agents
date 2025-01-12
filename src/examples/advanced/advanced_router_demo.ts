// src/examples/advanced/advanced_router_demo.ts

import { Agent } from "../../agents/Agent";
import { AdvancedAgentRouter, AgentCapability } from "../../agents/multi-agent/AdvancedAgentRouter";
import { ShortTermMemory } from "../../memory/ShortTermMemory";
import { OpenAIChat } from "../../LLMs/OpenAIChat";

async function main() {
  // 1. Create specialized agents
  const model = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini"
  });

  const financeAgent = Agent.create({
    name: "FinanceAgent",
    model,
    memory: new ShortTermMemory(5),
    instructions: [
      "You are a financial expert specialized in investments, budgeting, and financial planning.",
      "Provide clear, actionable financial advice.",
      "Always consider risk management in your recommendations."
    ],
    options: { 
      maxSteps: 3,
      useReflection: false,
      debug: true
    }
  });

  const legalAgent = Agent.create({
    name: "LegalAgent",
    model,
    memory: new ShortTermMemory(5),
    instructions: [
      "You are a legal expert specialized in general law and regulations.",
      "Provide clear explanations of legal concepts and implications.",
      "Always include disclaimers about seeking professional legal counsel when appropriate."
    ],
    options: { 
      maxSteps: 3,
      useReflection: false,
      debug: true
    }
  });

  const generalAgent = Agent.create({
    name: "GeneralAgent",
    model,
    memory: new ShortTermMemory(5),
    instructions: [
      "You are a general knowledge assistant.",
      "Provide helpful information on a wide range of topics.",
      "Direct specialized queries to appropriate experts."
    ],
    options: { 
      maxSteps: 3,
      useReflection: false,
      debug: true
    }
  });

  // 2. Define agent capabilities
  const capabilities = new Map<number, AgentCapability>([
    [0, {
      name: "Finance Expert",
      description: "Specialized in financial advice, investments, and budgeting",
      keywords: ["money", "invest", "budget", "stock", "finance", "savings"],
      examples: [
        "What stocks should I invest in?",
        "How do I create a monthly budget?",
        "Should I invest in cryptocurrency?"
      ]
    }],
    [1, {
      name: "Legal Expert",
      description: "Specialized in legal advice and regulations",
      keywords: ["legal", "law", "court", "rights", "contract", "sue"],
      examples: [
        "Is it legal to break my lease early?",
        "What are my rights as an employee?",
        "How do I handle a contract dispute?"
      ]
    }]
    // Index 2 is our fallback general agent
  ]);

  // 3. Create the advanced router
  const router = new AdvancedAgentRouter(
    [financeAgent, legalAgent, generalAgent],
    capabilities,
    {
      useLLM: true,
      debug: true,
      fallbackIndex: 2,
      confidenceThreshold: 0.7
    }
  );

  // 4. Test queries
  const queries = [
    "What's the best way to invest $10,000?",
    "Is it legal to record a conversation without consent?",
    "How do I create a budget for my small business?",
    "What are my rights as a tenant?",
    "Tell me about the history of pizza", // Should go to general agent
    "I need advice about a contract dispute with my financial advisor" // Complex case
  ];

  console.log("=== Testing Advanced Agent Router ===\n");

  for (const query of queries) {
    console.log(`\nUser Query: "${query}"`);
    console.log("-".repeat(50));

    try {
      const response = await router.run(query);
      console.log("Response:", response);
    } catch (error) {
      console.error("Error processing query:", error);
    }
  }

  // 5. Display routing history
  console.log("\n=== Routing History ===\n");
  const history = router.getRoutingHistory();
  
  history.forEach((entry, index) => {
    console.log(`\nQuery ${index + 1}:`);
    console.log(`Query: "${entry.query}"`);
    console.log(`Routed to: ${entry.selectedAgent}`);
    console.log(`Confidence: ${entry.confidence.toFixed(2)}`);
    if (entry.reasoning) {
      console.log(`Reasoning: ${entry.reasoning}`);
    }
    console.log("-".repeat(30));
  });
}

main().catch(console.error);