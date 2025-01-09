// src/multi-agent/AdvancedAgentTeam.ts

import { Agent } from "../agents/Agent";
import { Memory } from "../memory/Memory";
import { AgentTeam } from "./AgentTeam";

/**
 * AdvancedAgentTeam extends the basic AgentTeam with:
 * 1) Shared memory (optional) so each agent sees the same conversation context.
 * 2) Interleaved run method, letting agents "talk" in a round-robin 
 *    until a convergence condition is met.
 */
export class AdvancedAgentTeam extends AgentTeam {
  private sharedMemory?: Memory;

  constructor(
    name: string,
    agents: Agent[],
    sharedMemory?: Memory
  ) {
    super(name, agents);
    this.sharedMemory = sharedMemory;
  }

  private validateResponse(agentName: string, response: string, role: string): boolean {
    if (role === "numerical" && response.toLowerCase().includes("history")) {
      console.warn(`[${agentName}] Response contains invalid content for numerical role.`);
      return false;
    }
    if (role === "historical" && response.toLowerCase().includes("calculation")) {
      console.warn(`[${agentName}] Response contains invalid content for historical role.`);
      return false;
    }
    return true;
  }
  

  /**
   * If a sharedMemory is provided, each Agent's memory references 
   * the same memory object. This ensures they see the same 
   * conversation context.
   */
  public enableSharedMemory(): void {
    if (!this.sharedMemory) {
      console.warn(`[AdvancedAgentTeam] No shared memory set. Nothing to enable.`);
      return;
    }
    for (const agent of this.agents) {
      // Overwrite each agent's memory with the shared memory
      // or you could store the old references if you want to revert later
      (agent as any).memory = this.sharedMemory; 
    }
  }

  /**
   * Interleaved/Chat-like approach:
   * - We run a while loop, each agent sees the last message (or full conversation).
   * - They produce a new message, which we store in memory, 
   *   then move to the next agent, and so on.
   * - We stop when a "convergence" condition is met (like a final answer).
   *
   * @param userQuery The initial user query or conversation prompt
   * @param maxRounds Safety limit on how many total agent turns
   * @param isConverged A function that checks the last message, returns true if we should stop
   * @param requireAllAgents If true, we only stop when all agents have contributed
   */
  public async runInterleaved(
    userQuery: string,
    maxRounds: number,
    isConverged: (lastMsg: string) => boolean,
    requireAllAgents: boolean = false
  ): Promise<string> {
    if (!this.sharedMemory) {
      console.warn(`[AdvancedAgentTeam] No shared memory set. Agents will not see each other's contributions.`);
    }
  
    let currentMessage = userQuery;
    let round = 0;
    const contributions: Map<string, string> = new Map();
  
    while (round < maxRounds) {
      for (const agent of this.agents) {
        round++;
        if (round > maxRounds) break;
  
        const role = agent === this.agents[0] ? "numerical" : "historical";
        const agentQuery = role === "numerical"
          ? "Focus only on numerical insights about Pi."
          : "Focus only on historical and linguistic aspects of Pi.";
  
        console.log(`[AdvancedAgentTeam] Round ${round}: Passing message to ${agent.name}`);
        const agentOutput = await agent.run(agentQuery);
        
        // Validate response
        if (!this.validateResponse(agent.name, agentOutput, role)) {
          console.warn(`[AdvancedAgentTeam] Skipping invalid response from ${agent.name}.`);
          continue;
        }
  
        contributions.set(agent.name, agentOutput);
  
        if (this.sharedMemory) {
          currentMessage = (await this.sharedMemory.getContext()).slice(-1)[0].content;
        } else {
          currentMessage = agentOutput;
        }
  
        console.log(`[AdvancedAgentTeam] ${agent.name} response:`, { agentOutput });
  
        if (!requireAllAgents || contributions.size === this.agents.length) {
          if (isConverged(agentOutput)) {
            console.log(`[AdvancedAgentTeam] Convergence achieved with:`, { agentOutput });
            return Array.from(contributions.values()).join("\n---\n");
          }
        }
      }
    }
  
    console.warn(`[AdvancedAgentTeam] No convergence after ${maxRounds} rounds.`);
    return Array.from(contributions.values()).join("\n---\n");
  }  
}
