// src/multi-agent/AgentRouter.ts

import { Agent } from "../Agent";

/**
 * A simple interface for how we decide which Agent to call for a user query.
 */
export type RoutingFunction = (query: string) => number | Promise<number>; 
// returns index of the agent to call

export class AgentRouter {
  protected agents: Agent[];
  protected routingFn: RoutingFunction;

  constructor(agents: Agent[], routingFn: RoutingFunction) {
    this.agents = agents;
    this.routingFn = routingFn;
  }

  public async run(query: string): Promise<string> {
    const idx = await this.routingFn(query);
    const agent = this.agents[idx];
    return agent.run(query);
  }
}
