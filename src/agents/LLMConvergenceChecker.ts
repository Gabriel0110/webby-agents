// src/agents/LLMConvergenceChecker.ts

/**
  * This file contains the implementation of an LLM-based convergence checker.
  * The convergence checker uses an LLM to determine if content meets specific criteria.
  * The criteria can include required elements, structure, minimum length, and custom instructions.
  * The checker prompts the LLM to analyze the content and make a decision.
  * The response is parsed to get the yes/no decision.
  * The checker can be extended to support additional criteria and custom instructions.
  */

import { OpenAIChat } from "../LLMs/OpenAIChat";
import { DebugLogger } from "../utils/DebugLogger";

export interface ConvergenceCriteria {
  requiredElements?: string[];     // Required content elements
  requiredStructure?: string[];    // Required structural elements
  minimumLength?: number;          // Minimum content length
  customInstructions?: string[];   // Additional checking instructions
}

export class LLMConvergenceChecker {
  private model: OpenAIChat;
  private logger: DebugLogger;

  constructor(
    model: OpenAIChat,
    private criteria: ConvergenceCriteria,
    debug: boolean = false
  ) {
    this.model = model;
    this.logger = new DebugLogger(debug);
  }

  /**
   * Check if content meets convergence criteria using LLM
   */
  public async hasConverged(content: string): Promise<boolean> {
    const prompt = this.buildConvergencePrompt(content);
    
    try {
      const response = await this.model.call([{
        role: "user",
        content: prompt
      }]);
      const decision = this.parseDecision(response);
      
      this.logger.log("Convergence check result", {
        decision,
        reasoning: response
      });

      return decision;
    } catch (error) {
      this.logger.error("Error in convergence check", error);
      return false; // Default to not converged on error
    }
  }

  /**
   * Build the prompt for convergence checking
   */
  private buildConvergencePrompt(content: string): string {
    const criteriaList = [
      ...(this.criteria.requiredElements 
        ? [`Content must include these elements: ${this.criteria.requiredElements.join(", ")}`] 
        : []),
      ...(this.criteria.requiredStructure 
        ? [`Content must have these structural elements: ${this.criteria.requiredStructure.join(", ")}`] 
        : []),
      ...(this.criteria.minimumLength 
        ? [`Content must be at least ${this.criteria.minimumLength} characters long`] 
        : []),
      ...(this.criteria.customInstructions || [])
    ];

    return `
      You are a convergence checker that determines if content meets specific criteria.
      
      Criteria for convergence:
      ${criteriaList.map(c => `- ${c}`).join("\n")}

      Content to check:
      ---
      ${content}
      ---

      Analyze the content and determine if it meets ALL criteria.
      Respond with "YES" or "NO" followed by a brief explanation.
      Your response must start with either "YES:" or "NO:" followed by your reasoning.
    `;
  }

  /**
   * Parse the LLM's response to get the yes/no decision
   */
  private parseDecision(response: string): boolean {
    const normalized = response.trim().toLowerCase();
    return normalized.startsWith("yes:");
  }
}