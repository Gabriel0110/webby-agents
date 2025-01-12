// src/examples/advanced/aggregator_team_example.ts

import { AgentTeam } from "../../agents/multi-agent/AgentTeam";
import { Agent } from "../../agents/Agent";

export class AggregatorAgentTeam extends AgentTeam {
  private aggregator: Agent;

  constructor(name: string, agents: Agent[], aggregator: Agent) {
    super(name, agents);
    this.aggregator = aggregator;
  }

  // Similar to runInParallel, but aggregator merges results
  public async runWithAggregator(query: string): Promise<string> {
    const results = await this.runInParallel(query);

    const combined = `Here are the sub-agents' answers:\n${results.join("\n---\n")}\nPlease unify.`;
    return this.aggregator.run(combined);
  }
}
