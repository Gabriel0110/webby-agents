/**
 * src/examples/advanced/agent_team_advanced.ts
 *
 * Demonstrates advanced synergy:
 * 1) Shared memory among multiple agents
 * 2) Interleaved chat approach for multi-agent analysis
 *    - Round-robin the agents in a while loop until a convergence condition is met
 * 3) Aggregator agent merges everything into a final answer
 * 
 * Note: This example showcases very advanced usage. Not everything is necessary, but
 * it demonstrates the full capabilities of the AdvancedAgentTeam class. Pick and choose
 * the features that are most relevant to your use case.
 */


import { Agent } from "../../agents/Agent";
import { AgentRole } from "../../agents/multi-agent/AdvancedAgentTeam";
import { AdvancedAgentTeam, TeamConfiguration } from "../../agents/multi-agent/AdvancedAgentTeam";
import { CompositeMemory } from "../../memory/CompositeMemory";
import { ShortTermMemory } from "../../memory/ShortTermMemory";
import { OpenAIChat } from "../../LLMs/OpenAIChat";
import { AdvancedTeamHooks } from "../../agents/multi-agent/AdvancedAgentTeam";

/**
 * Different types of convergence checks we can use
 */
const convergenceChecks = {
  finalAnswer: (msg: string) => msg.includes("FINAL ANSWER:"),
  
  keywords: (msg: string) => 
    msg.toLowerCase().includes("conclusion") || 
    msg.toLowerCase().includes("summary"),
  
  comprehensive: (msg: string) => {
    const required = ["analysis", "implications", "recommendation"];
    return required.every(term => msg.toLowerCase().includes(term));
  },

  length: (msg: string) => 
    msg.length > 200 && msg.toLowerCase().includes("conclusion")
};

/**
 * Different team configurations for different analysis scenarios
 */
const teamConfigs: Record<string, Map<string, AgentRole>> = {
    // Technical Analysis Team
    technical: new Map([
      ["TechnicalAgent", {
        name: "Technical Analyst",
        description: "Focuses on technical implementation details",
        queryTransform: (query: string) => 
          `${query}\nAnalyze from a technical perspective...`
      }],
      ["SecurityAgent", {
        name: "Security Analyst",
        description: "Focuses on security implications",
        queryTransform: (query: string) => 
          `${query}\nAnalyze from a security perspective...`
      }]
    ]),
  
    // Business Analysis Team
    business: new Map([
      ["MarketAgent", {
        name: "Market Analyst",
        description: "Analyzes market implications",
        queryTransform: (query: string) => 
          `${query}\nAnalyze from a market perspective...`
      }],
      ["FinanceAgent", {
        name: "Financial Analyst",
        description: "Analyzes financial implications",
        queryTransform: (query: string) => 
          `${query}\nAnalyze from a financial perspective...`
      }]
    ])
};
  
// Create explicit TeamConfiguration objects
const technicalTeamConfig: TeamConfiguration = {
    roles: teamConfigs.technical,
    defaultRole: {
        name: "General Analyst",
        description: "Provides general analysis",
        queryTransform: (query: string) => query
    }
};

const businessTeamConfig: TeamConfiguration = {
    roles: teamConfigs.business,
    defaultRole: {
        name: "General Analyst",
        description: "Provides general analysis",
        queryTransform: (query: string) => query
    }
};

async function main() {
  // OPTIONAL: Example usage of advanced team hooks for logging (hook calls would need to be added to the AdvancedAgentTeam class)
  const teamHooks: AdvancedTeamHooks = {
    onAgentStart: (name, input) => 
      console.log(`\n🤖 ${name} starting analysis...`),
    
    onAgentEnd: (name, output) =>
      console.log(`✅ ${name} completed analysis`),
    
    onRoundStart: (round, max) =>
      console.log(`\n📍 Starting round ${round}/${max}`),
    
    onRoundEnd: (round, contributions) =>
      console.log(`📍 Round ${round} complete - ${contributions.size} contributions`),
    
    onConvergence: (agent, content) =>
      console.log(`🎯 Convergence reached by ${agent.name}`),
    
    onAggregation: (result) =>
      console.log(`\n🔄 Aggregating team analysis...`),
    
    onError: (name, error) =>
      console.error(`❌ Error from ${name}:`, error.message)
  };


  // Initialize LLMs
  const model1 = new OpenAIChat({ 
    apiKey: "YOUR-API-KEY", 
    model: "gpt-4o-mini" 
  });
  const model2 = new OpenAIChat({ 
    apiKey: "YOUR-API-KEY", 
    model: "gpt-4o-mini" 
  });

  // Create memories
  const agent1Mem = new ShortTermMemory(5);
  const agent2Mem = new ShortTermMemory(5);
  const sharedMemory = new CompositeMemory(agent1Mem, agent2Mem);

  // Create agents for technical analysis
  const technicalAgent = Agent.create({
    name: "TechnicalAgent",
    model: model1,
    memory: agent1Mem,
    instructions: [
      "You are a technical analyst focusing on implementation details.",
      "Provide detailed technical analysis and specific recommendations.",
      "Always consider technical feasibility and best practices.",
      "Conclude with clear technical recommendations."
    ],
    options: { 
      maxSteps: 3, 
      useReflection: false, 
      debug: true,
      usageLimit: 10
    }
  });

  const securityAgent = Agent.create({
    name: "SecurityAgent",
    model: model2,
    memory: agent2Mem,
    instructions: [
      "You are a security analyst focusing on security implications.",
      "Provide detailed security analysis and specific recommendations.",
      "Always consider security best practices and risk mitigation.",
      "Conclude with clear security recommendations."
    ],
    options: { 
      maxSteps: 3, 
      useReflection: false, 
      debug: true,
      usageLimit: 10
    }
  });

  // Create technical analysis team
  const technicalTeam = new AdvancedAgentTeam(
    "TechnicalTeam",
    [technicalAgent, securityAgent],
    {
      sharedMemory,
      teamConfig: technicalTeamConfig,
      hooks: teamHooks,
      debug: true,
    }
  );

  // Enable shared memory
  technicalTeam.enableSharedMemory();

  // Test different scenarios
  console.log("\n=== Technical Analysis with Final Answer Convergence ===");
  const technicalQuery = `
    Analyze the implementation of a new cloud-based microservices architecture.
    Consider both technical implementation and security aspects.
    Provide specific recommendations.
  `;

  const technicalResult = await technicalTeam.runInterleaved(
    technicalQuery,
    5,
    convergenceChecks.finalAnswer,
    true // require all agents
  );


  // Create business analysis agents
  const marketAgent = Agent.create({
    name: "MarketAgent",
    model: model1,
    memory: new ShortTermMemory(5),
    instructions: [
      "You are a market analyst focusing on market implications.",
      "Provide detailed market analysis and specific recommendations.",
      "Always consider market trends and competitive advantages.",
      "Conclude with clear market-focused recommendations."
    ],
    options: { maxSteps: 3, useReflection: false, debug: true }
  });

  const financeAgent = Agent.create({
    name: "FinanceAgent",
    model: model2,
    memory: new ShortTermMemory(5),
    instructions: [
      "You are a financial analyst focusing on financial implications.",
      "Provide detailed financial analysis and specific recommendations.",
      "Always consider ROI and financial risks.",
      "Conclude with clear financial recommendations."
    ],
    options: { maxSteps: 3, useReflection: false, debug: true }
  });

  // Create business analysis team
  const businessTeam = new AdvancedAgentTeam(
    "BusinessTeam",
    [marketAgent, financeAgent],
    {
      sharedMemory: new CompositeMemory(
        new ShortTermMemory(5),
        new ShortTermMemory(5)
      ),
      teamConfig: businessTeamConfig,
      debug: true
    }
  );

  console.log("\n=== Business Analysis with Comprehensive Convergence ===");
  const businessQuery = `
    Analyze the business implications of expanding into the Asian market.
    Consider both market opportunities and financial implications.
    Provide specific recommendations.
  `;

  const businessResult = await businessTeam.runInterleaved(
    businessQuery,
    5,
    convergenceChecks.finalAnswer,
    true // require all agents
  );
  console.log("\nBusiness Analysis Result:\n", businessResult);

  // Test with different convergence criteria
  console.log("\n=== Quick Analysis with Keyword Convergence ===");
  const quickQuery = "Provide a quick analysis of current cloud computing trends.";
  
  const quickResult = await technicalTeam.runInterleaved(
    quickQuery,
    3,
    convergenceChecks.keywords,
    false // don't require all agents
  );
  console.log("\nQuick Analysis Result:\n", quickResult);

  // Test with length-based convergence
  console.log("\n=== Detailed Analysis with Length-based Convergence ===");
  const detailedQuery = `
    Provide a detailed analysis of blockchain technology adoption in enterprise.
    Include technical, security, market, and financial perspectives.
  `;

  const detailedResult = await businessTeam.runInterleaved(
    detailedQuery,
    4,
    convergenceChecks.length,
    true // require all agents
  );
  console.log("\nDetailed Analysis Result:\n", detailedResult);


  // Aggregator agent merges final answers succinctly
    const aggregatorModel = new OpenAIChat({ apiKey: "YOUR-API-KEY", model: "gpt-4o-mini" });
    const aggregatorAgent = Agent.create({
        name: "Aggregator",
        model: aggregatorModel,
        memory: new ShortTermMemory(5),
        instructions: [
            "You are an expert aggregator that combines and synthesizes multiple expert perspectives into a comprehensive analysis.",
            "Your role is to create a unified response that:",
            "1. Synthesizes key insights from all experts while eliminating redundancies",
            "2. Maintains the depth and expertise from each perspective",
            "3. Organizes content into clear sections: Market Analysis, Financial Implications, and Recommendations",
            "4. Preserves unique insights from each expert",
            "5. Provides specific, actionable recommendations",
            "\nFormat your response as follows:",
            "### Executive Summary",
            "(Brief overview of key points)",
            "\n### Combined Analysis",
            "(Main insights organized by topic)",
            "\n### Key Recommendations",
            "(Specific, actionable steps)",
            "\n### Risk Considerations",
            "(Important risks and mitigation strategies)",
            "\nEnsure your response is detailed yet concise, and maintain the depth of expertise while eliminating redundancy.",
            "Start with 'FINAL ANSWER:' and then provide your structured response."
        ],
        options: {
            maxSteps: 3,
            useReflection: false,
            debug: true
        }
    });

    // Format the input for the aggregator
    const formatAggregatorInput = (teamResponse: string): string => {
        return `
    Please synthesize and aggregate the following expert analyses into a comprehensive response.
    Each expert has provided valuable insights that need to be combined effectively.

    ${teamResponse}

    Create a unified analysis that combines these perspectives while:
    1. Maintaining the depth of expertise from both market and financial analyses
    2. Eliminating redundant information
    3. Organizing insights logically
    4. Providing clear, actionable recommendations
    5. Highlighting key risks and opportunities

    Format your response according to the structure specified in your instructions.
    `;
    };

    console.log("\n--- Aggregator Step ---");
    const formattedInput = formatAggregatorInput(quickResult);
    const aggregatorFinal = await aggregatorAgent.run(formattedInput);
    console.log("\nAggregated Analysis Result:\n", aggregatorFinal);
}

main().catch(console.error);