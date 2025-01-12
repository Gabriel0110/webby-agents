// src/multi-agent/AdvancedAgentRouter.ts

import { Agent } from "../agents/Agent";
import { AgentRouter } from "./AgentRouter";
import { OpenAIChat } from "../LLMs/OpenAIChat";
import { DebugLogger } from "../utils/DebugLogger";

/**
 * Agent capability metadata
 */
export interface AgentCapability {
  name: string;
  description: string;
  keywords: string[];
  examples: string[];
}

/**
 * Options for AdvancedAgentRouter
 */
export interface RouterOptions {
  useLLM?: boolean;
  debug?: boolean;
  fallbackIndex?: number;
  confidenceThreshold?: number;
}

/**
 * Metadata for routing decisions
 * Used for logging and analysis
 */
export interface RoutingMetadata {
  timestamp: number;
  query: string;
  selectedAgent: string;
  confidence: number;
  reasoning?: string;
}

/**
 * AdvancedAgentRouter extends AgentRouter with LLM-powered routing
 * and capability-based agent selection.
 */
export class AdvancedAgentRouter extends AgentRouter {
  private capabilities: Map<number, AgentCapability>;
  private routerLLM?: OpenAIChat;
  private logger: DebugLogger;
  private fallbackIndex: number;
  private confidenceThreshold: number;
  private routingHistory: RoutingMetadata[] = [];

  constructor(
    agents: Agent[],
    capabilities: Map<number, AgentCapability>,
    options: RouterOptions = {}
  ) {
    // Create default routing function
    const defaultRouting = async (query: string): Promise<number> => {
      const result = await this.routeQuery(query);
      return result.agentIndex;
    };

    super(agents, defaultRouting);

    this.capabilities = capabilities;
    this.logger = new DebugLogger(options.debug ?? false);
    this.fallbackIndex = options.fallbackIndex ?? agents.length - 1;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.7;

    if (options.useLLM) {
      this.routerLLM = new OpenAIChat({
        apiKey: "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",
        model: "gpt-4o-mini",
        temperature: 0.2, // Lower temperature for more consistent routing
      });
    }
  }

  /**
   * Override the base run method to add routing logic and logging
   */
  public async run(query: string): Promise<string> {
    const routingResult = await this.routeQuery(query);
    
    this.logger.log("Routing decision", {
      query,
      selectedAgent: this.agents[routingResult.agentIndex].name,
      confidence: routingResult.confidence,
      reasoning: routingResult.reasoning
    });

    // Track routing metadata
    this.routingHistory.push({
      timestamp: Date.now(),
      query,
      selectedAgent: this.agents[routingResult.agentIndex].name,
      confidence: routingResult.confidence,
      reasoning: routingResult.reasoning
    });

    // Use fallback if confidence is too low
    if (routingResult.confidence < this.confidenceThreshold) {
      this.logger.warn(`Low confidence routing (${routingResult.confidence}), using fallback agent`);
      return this.agents[this.fallbackIndex].run(query);
    }

    return this.agents[routingResult.agentIndex].run(query);
  }

  /**
   * Main routing logic that can use either rule-based or LLM-based routing
   */
  private async routeQuery(query: string): Promise<{
    agentIndex: number;
    confidence: number;
    reasoning?: string;
  }> {
    if (this.routerLLM) {
      try {
        const llmResult = await this.routeWithLLM(query);
        this.logger.log('LLM routing result', llmResult);
        
        if (llmResult.confidence >= this.confidenceThreshold) {
          return llmResult;
        }
        
        this.logger.log('LLM routing confidence too low, trying rule-based', {
          confidence: llmResult.confidence,
          threshold: this.confidenceThreshold
        });
      } catch (error) {
        this.logger.error('LLM routing failed, falling back to rule-based', error);
      }
    }
  
    // Fall back to rule-based routing
    return this.routeWithRules(query);
  }

  /**
   * Rule-based routing using capabilities and keywords
   */
  private routeWithRules(query: string): Promise<{
    agentIndex: number;
    confidence: number;
    reasoning?: string;
  }> {
    const lowerQuery = query.toLowerCase();
    let bestMatch = {
      index: this.fallbackIndex,
      confidence: 0,
      matches: 0
    };

    // Check each agent's capabilities
    this.capabilities.forEach((capability, index) => {
      let matches = 0;
      let totalKeywords = capability.keywords.length;

      // Check keywords
      capability.keywords.forEach(keyword => {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          matches++;
        }
      });

      // Check examples for similar patterns
      capability.examples.forEach(example => {
        if (this.calculateSimilarity(query, example) > 0.7) {
          matches++;
        }
      });

      const confidence = matches / (totalKeywords + capability.examples.length);

      if (confidence > bestMatch.confidence) {
        bestMatch = { index, confidence, matches };
      }
    });

    return Promise.resolve({
      agentIndex: bestMatch.index,
      confidence: bestMatch.confidence,
      reasoning: `Matched ${bestMatch.matches} keywords/patterns`
    });
  }

  /**
 * LLM-based intelligent routing
 */
private async routeWithLLM(query: string): Promise<{
    agentIndex: number;
    confidence: number;
    reasoning: string;
  }> {
    try {
      const prompt = this.buildRoutingPrompt(query);
      const response = await this.routerLLM!.call([{
        role: "user",
        content: prompt
      }]);
  
      // Clean the response - remove any markdown formatting or extra text
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanedResponse);
        
        // Validate the parsed response
        if (typeof parsed.selectedAgent !== 'number' ||
            typeof parsed.confidence !== 'number' ||
            typeof parsed.reasoning !== 'string') {
          throw new Error('Invalid response format');
        }
  
        // Ensure values are within expected ranges
        return {
          agentIndex: Math.min(Math.max(0, parsed.selectedAgent), this.agents.length - 1),
          confidence: Math.min(Math.max(0, parsed.confidence), 1),
          reasoning: parsed.reasoning
        };
      } catch (parseError) {
        this.logger.error('Failed to parse LLM response', {
          response: cleanedResponse,
          error: parseError
        });
        throw new Error(`Failed to parse LLM response: ${(parseError as Error).message}`);
      }
    } catch (error) {
      this.logger.error('LLM routing error', error);
      throw error;
    }
  }

  /**
 * Build prompt for LLM-based routing
 */
private buildRoutingPrompt(query: string): string {
    const capabilitiesDesc = Array.from(this.capabilities.entries())
      .map(([idx, cap]) => 
        `Agent ${idx}: ${cap.name}\n` +
        `Description: ${cap.description}\n` +
        `Example queries: ${cap.examples.join(', ')}`
      ).join('\n\n');
  
    return `You are a routing system that determines which specialized agent should handle a user query.
  
  Available agents and their capabilities:
  ${capabilitiesDesc}
  
  Additionally, there is a general-purpose agent (index: ${this.fallbackIndex}) for queries that don't clearly match any specialist.
  
  Analyze this query and determine the best agent to handle it:
  "${query}"
  
  Respond in this exact JSON format:
  {
    "selectedAgent": <agent index number>,
    "confidence": <number between 0 and 1>,
    "reasoning": "<brief explanation of your choice>"
  }
  
  Your response should ONLY contain the JSON object, nothing else.
  Choose the general agent (${this.fallbackIndex}) if no specialist is clearly suitable.
  Set confidence above 0.8 only if you're very sure about the routing.`;
  }

  /**
   * Simple similarity calculation for example matching
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(' '));
    const words2 = new Set(str2.toLowerCase().split(' '));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    return intersection.size / Math.max(words1.size, words2.size);
  }

  /**
   * Get routing history for analysis
   */
  public getRoutingHistory(): RoutingMetadata[] {
    return this.routingHistory;
  }

  /**
   * Add or update agent capabilities
   */
  public setCapability(agentIndex: number, capability: AgentCapability): void {
    this.capabilities.set(agentIndex, capability);
    this.logger.log(`Updated capabilities for agent ${agentIndex}`, capability);
  }
}