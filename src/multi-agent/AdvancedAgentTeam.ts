// src/multi-agent/AdvancedAgentTeam.ts

import { Agent } from "../Agent";
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
   */
  public async runInterleaved(
    userQuery: string,
    maxRounds: number,
    isConverged: (lastMsg: string) => boolean
  ): Promise<string> {
    if (!this.sharedMemory) {
      console.warn(`[AdvancedAgentTeam] You didn't provide sharedMemory. 
        We'll just pass around text manually instead.`);
    }

    // Initialize conversation
    let currentMessage = userQuery; 
    let round = 0;

    // If we do have sharedMemory, we add the user's message to it
    if (this.sharedMemory) {
      await this.sharedMemory.addMessage({ role: "user", content: userQuery });
    }

    while (round < maxRounds) {
      for (const agent of this.agents) {
        round++;
        if (round > maxRounds) break;

        // If using sharedMemory, the agent sees the entire conversation context
        const agentOutput = await agent.run(currentMessage);

        // If using sharedMemory, the agent's run method also updates memory,
        // so we can just read from memory. Otherwise, we must store it ourselves:
        if (!this.sharedMemory) {
          // add to local or ephemeral memory
          currentMessage = agentOutput;
        } else {
          // read the last message from sharedMemory
          currentMessage = agentOutput;
        }

        // Check for convergence
        if (isConverged(agentOutput)) {
          return agentOutput;
        }
      }
    }
    // If we exit the loop, return the last known message
    return currentMessage;
  }
}
