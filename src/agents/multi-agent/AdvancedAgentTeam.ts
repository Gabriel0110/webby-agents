// src/multi-agent/AdvancedAgentTeam.ts

import { Agent } from "../Agent";
import { TeamHooks } from "./AgentTeam";
import { Memory } from "../../memory/Memory";
import { AgentTeam } from "./AgentTeam";
import { DebugLogger } from '../../utils/DebugLogger';

/**
 * AdvancedTeamHooks extends the basic TeamHooks with:
 * 1) Round start and end events
 * 2) Convergence event when an agent's output meets criteria
 * 3) Aggregation event when all agents have contributed
 */
export interface AdvancedTeamHooks extends TeamHooks {
    onRoundStart?: (round: number, maxRounds: number) => void;
    onRoundEnd?: (round: number, contributions: Map<string, AgentContribution>) => void;
    onConvergence?: (agent: Agent, content: string) => void;
    onAggregation?: (result: string) => void;
}

/**
 * AgentRole defines a specialization for an agent in a team
 */
export interface AgentRole {
  name: string;
  description: string;
  queryTransform: (baseQuery: string) => string;
}

/**
 * TeamConfiguration defines the roles and specializations for a team
 */
export interface TeamConfiguration {
  roles: Map<string, AgentRole>;
  defaultRole?: AgentRole;
}

/**
 * AgentContribution tracks an agent's contribution with metadata
 */
export interface AgentContribution {
  agent: Agent;
  content: string;
  hasFinalAnswer: boolean;
  timestamp?: number;
}

/**
 * AdvancedTeamOptions extends the basic TeamOptions with:
 * 1) Shared memory for agents to see the same conversation context
 * 2) Team configuration with roles and specializations
 * 3) Debug flag for verbose logging
 */
export interface AdvancedTeamOptions {
  sharedMemory?: Memory;
  teamConfig?: TeamConfiguration;
  hooks?: AdvancedTeamHooks;
  debug?: boolean;
}

/**
 * AdvancedAgentTeam extends the basic AgentTeam with:
 * 1) Shared memory (optional) so each agent sees the same conversation context
 * 2) Configurable agent roles and specializations
 * 3) Interleaved run method with role-based query transformation
 */
export class AdvancedAgentTeam extends AgentTeam {
  private sharedMemory?: Memory;
  private logger: DebugLogger;
  private teamConfig?: TeamConfiguration;
  private hooks?: AdvancedTeamHooks;

  constructor(
    name: string,
    agents: Agent[],
    options: AdvancedTeamOptions
  ) {
    super(name, agents);
    this.sharedMemory = options.sharedMemory;
    this.teamConfig = options.teamConfig;
    this.hooks = options.hooks;
    this.logger = new DebugLogger(options.debug ?? false);
  }

  /**
   * Configure team roles and specializations
   */
  public setTeamConfiguration(config: TeamConfiguration): void {
    this.teamConfig = config;
    this.logger.log("Team configuration updated", { 
      roles: Array.from(config.roles.keys()) 
    });
  }

  /**
   * If a sharedMemory is provided, each Agent's memory references 
   * the same memory object.
   */
  public enableSharedMemory(): void {
    if (!this.sharedMemory) {
      this.logger.warn(`No shared memory set. Nothing to enable.`);
      return;
    }
    for (const agent of this.agents) {
      (agent as any).memory = this.sharedMemory;
    }
    this.logger.log("Shared memory enabled for all agents");
  }

  /**
   * Get the role for a specific agent
   */
  private getAgentRole(agent: Agent): AgentRole | undefined {
    if (!this.teamConfig) return undefined;
    
    // Check for specific role assignment
    const role = this.teamConfig.roles.get(agent.name);
    if (role) return role;

    // Fall back to default role if specified
    return this.teamConfig.defaultRole;
  }

  /**
   * Transform query based on agent's role
   */
  private getSpecializedQuery(agent: Agent, baseQuery: string): string {
    const role = this.getAgentRole(agent);
    if (!role) {
      this.logger.warn(`No role defined for agent ${agent.name}, using base query`);
      return baseQuery;
    }

    try {
      const transformedQuery = role.queryTransform(baseQuery);
      this.logger.log(`Query transformed for ${agent.name} (${role.name})`, {
        original: baseQuery,
        transformed: transformedQuery
      });
      return transformedQuery;
    } catch (error) {
      this.logger.error(`Error transforming query for ${agent.name}`, error);
      return baseQuery;
    }
  }

  /**
   * Improved contribution tracking with metadata
   */
  private trackContribution(
    agent: Agent,
    content: string,
    hasConverged: boolean
  ): void {
    const role = this.getAgentRole(agent);
    this.logger.log(`Tracking contribution from ${agent.name}`, {
      role: role?.name ?? 'Unspecified',
      contentLength: content.length,
      hasConverged
    });

    // Add to shared memory with metadata
    if (this.sharedMemory) {
      this.sharedMemory.addMessage({
        role: "assistant",
        content,
        metadata: {
          agentName: agent.name,
          roleName: role?.name,
          timestamp: Date.now(),
          hasConverged
        }
      });
    }
  }

  /**
   * Build team-level system prompt
   */
  private buildTeamSystemPrompt(): string {
    const roleDescriptions = this.teamConfig 
      ? Array.from(this.teamConfig.roles.entries())
        .map(([name, role]) => `${name}: ${role.description}`)
        .join('\n')
      : '';

    return `
      This is a collaborative analysis by multiple expert agents.
      Each agent has a specific role and expertise:
      ${roleDescriptions}
      
      Agents will build on each other's insights while maintaining their specialized focus.
      Final responses should be marked with "FINAL ANSWER:".
    `;
  }

  /**
   * Initialize shared memory with system and user context
   */
  private async initializeSharedContext(query: string): Promise<void> {
    if (!this.sharedMemory) return;

    // Clear any previous conversation
    await this.sharedMemory.clear();

    // Add system context
    await this.sharedMemory.addMessage({
      role: "system",
      content: this.buildTeamSystemPrompt()
    });

    // Add user query
    await this.sharedMemory.addMessage({
      role: "user",
      content: query
    });

    this.logger.log("Shared context initialized", { query });
  }

  /**
   * Check if all agents have contributed
   */
  private haveAllAgentsContributed(
    contributions: Map<string, AgentContribution>
  ): boolean {
    return contributions.size === this.agents.length;
  }

  /**
   * Check if all agents have contributed AND converged
   */
  private haveAllAgentsConverged(
    contributions: Map<string, AgentContribution>
  ): boolean {
    if (!this.haveAllAgentsContributed(contributions)) {
      return false;
    }
    
    // Check if all contributions have converged
    const allConverged = Array.from(contributions.values())
      .every(contribution => contribution.hasFinalAnswer);

    this.logger.log("Checking convergence status", {
      totalAgents: this.agents.length,
      contributingAgents: contributions.size,
      allConverged,
      convergenceStatus: Array.from(contributions.entries()).map(([name, c]) => ({
        agent: name,
        hasConverged: c.hasFinalAnswer
      }))
    });

    return allConverged;
  }

  /**
   * Interleaved/Chat-like approach where agents build on each other's contributions
   */
  public async runInterleaved(
    userQuery: string,
    maxRounds: number,
    isConverged: (lastMsg: string) => Promise<boolean> | boolean,
    requireAllAgents: boolean = false
  ): Promise<string> {
    if (requireAllAgents) {
      this.logger.log("requireAllAgents is true. Waiting for all agents to contribute.");
      this.logger.log(`Total agents: ${this.agents.length}\n`);
    }

    this.logger.log("Starting interleaved team workflow", {
      query: userQuery,
      maxRounds,
      requireAllAgents,
      teamSize: this.agents.length
    });

    // Track contributions per round
    const contributions = new Map<string, AgentContribution>();
    let currentRound = 0;
    let finalAnswer: string | null = null;

    // Initialize shared memory if enabled
    await this.initializeSharedContext(userQuery);

    // Main interaction loop
    while (currentRound < maxRounds) {
      currentRound++;
      this.logger.log(`Starting round ${currentRound}/${maxRounds}`);
      
      if (this.hooks?.onRoundStart) {
        this.hooks.onRoundStart(currentRound, maxRounds);
      }

      // Each agent takes a turn in the current round
      for (const agent of this.agents) {
        this.logger.log(`Round ${currentRound}: ${agent.name}'s turn`);

        if (this.hooks?.onAgentStart) {
          this.hooks.onAgentStart(agent.name, userQuery);
        }

        // Get agent's specialized query based on their role
        const agentQuery = this.getSpecializedQuery(agent, userQuery);
        
        try {
          const agentOutput = await agent.run(agentQuery);
          this.logger.log(`${agent.name} response received`, { agentOutput });

          // Check if this output meets convergence criteria
          const hasConverged = await Promise.resolve(isConverged(agentOutput));

          // Track agent contribution with metadata
          contributions.set(agent.name, {
            agent,
            content: agentOutput,
            hasFinalAnswer: hasConverged,
            timestamp: Date.now()
          });

          this.trackContribution(agent, agentOutput, hasConverged);

          if (this.hooks?.onAgentEnd) {
            this.hooks.onAgentEnd(agent.name, agentOutput);
          }

          // Check convergence conditions
          if (hasConverged) {
            if (this.hooks?.onConvergence) {
              this.hooks.onConvergence(agent, agentOutput);
            }

            if (!requireAllAgents) {
              // Stop at first convergence if not requiring all agents
              finalAnswer = agentOutput;
              this.logger.log(`${agent.name} met convergence criteria, stopping early`);
              break;
            } else if (this.haveAllAgentsConverged(contributions)) {
              // Stop only if all agents have contributed AND converged
              finalAnswer = this.combineContributions(contributions);
              this.logger.log("All agents have contributed and converged");
              break;
            }
          }
        } catch (error) {
          this.logger.error(`Error during ${agent.name}'s turn`, error);
          if (this.hooks?.onError) {
            this.hooks.onError(agent.name, error as Error);
          }

          contributions.set(agent.name, {
            agent,
            content: `Error during execution: ${(error as Error).message}`,
            hasFinalAnswer: false,
            timestamp: Date.now()
          });
        }
      }

      if (this.hooks?.onRoundEnd) {
        this.hooks.onRoundEnd(currentRound, contributions);
      }

      // Break if we found a final answer
      if (finalAnswer) {
        this.logger.log("Convergence achieved", { finalAnswer });
        break;
      }

      // If all agents have contributed but not all converged, log and continue
      if (this.haveAllAgentsContributed(contributions) && 
          !this.haveAllAgentsConverged(contributions)) {
        this.logger.log("All agents contributed but not all converged, continuing to next round");
        continue;
      }

      // Check if we should continue
      if (currentRound === maxRounds) {
        this.logger.warn(`Maximum rounds (${maxRounds}) reached without convergence`);
      }
    }

    // If no final answer was reached, combine all contributions
    if (!finalAnswer) {
      this.logger.warn("No convergence reached, combining all contributions");
      finalAnswer = this.combineContributions(contributions);
    }

    const formattedOutput = this.formatFinalOutput(finalAnswer, contributions);

    if (this.hooks?.onAggregation) {
      this.hooks.onAggregation(formattedOutput);
    }

    return formattedOutput;
  }

  /**
   * Combine all agent contributions into a final response
   */
  private combineContributions(
    contributions: Map<string, AgentContribution>
  ): string {
    return Array.from(contributions.values())
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)) // Sort by timestamp if available
      .map(c => {
        const role = this.getAgentRole(c.agent);
        const roleInfo = role ? ` (${role.name})` : '';
        return `[${c.agent.name}${roleInfo}]\n${c.content}`;
      })
      .join("\n---\n");
  }

  /**
   * Format the final output with additional context if needed
   */
  private formatFinalOutput(
    finalAnswer: string,
    contributions: Map<string, AgentContribution>
  ): string {
    const contributingAgents = Array.from(contributions.entries())
      .map(([name, c]) => `${name}${c.hasFinalAnswer ? ' ✓' : ''}`)
      .join(", ");

    const header = `Team Response (Contributors: ${contributingAgents})\n${"=".repeat(40)}\n`;
    return `${header}${finalAnswer}`;
  }
}