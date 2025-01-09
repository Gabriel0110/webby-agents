// src/multi-agent/AgentTeam.ts

import { Agent } from "../agents/Agent";

export interface TeamHooks {
    onAgentStart?: (agentName: string, input: string) => void;
    onAgentEnd?: (agentName: string, output: string) => void;
    onError?: (agentName: string, error: Error) => void;
    onFinal?: (outputs: string[]) => void;
}  

/**
 * AgentTeam: orchestrates multiple agents. 
 * Could be parallel calls or passing context from one to the next.
 */
export class AgentTeam {
    protected agents: Agent[];
    protected name: string;
  
    constructor(name: string, agents: Agent[]) {
      this.name = name;
      this.agents = agents;
    }
  
    /**
     * Runs all agents in parallel on the same input query.
     * Each agent processes the query independently and returns its result.
     * 
     * @param query  The user input or initial query.
     * @param hooks  Optional TeamHooks for debugging/logging steps and errors.
     * @returns      An array of output strings from each agent.
     */
    public async runInParallel(query: string, hooks?: TeamHooks): Promise<string[]> {
        const promises = this.agents.map(async (agent) => {
          if (hooks?.onAgentStart) {
            hooks.onAgentStart(agent.name, query);
          }

          try {
            const output = await agent.run(query);
            if (hooks?.onAgentEnd) {
                hooks.onAgentEnd(agent.name, output);
            }

            return output;

          } catch (err) {
            if (hooks?.onError) {
                hooks.onError(agent.name, err as Error);
            }

            throw err; // or handle
          }
        });

        const results = await Promise.all(promises);
        if (hooks?.onFinal) {
            hooks.onFinal(results);
        }

        return results;
    }
  
    /**
     * Runs agents sequentially, passing each agent's output as input to the next agent.
     * Forms a processing pipeline where agents transform the data in sequence.
     * 
     * @param query  The user input or initial query.
     * @param hooks  Optional TeamHooks for debugging/logging steps and errors.
     * @returns      The final output string after all agents have processed it.
     */
    public async runSequential(query: string, hooks?: TeamHooks): Promise<string> {
      let currentInput = query;
  
      for (const agent of this.agents) {
        if (hooks?.onAgentStart) {
            hooks.onAgentStart(agent.name, currentInput);
        }

        try {
          const output = await agent.run(currentInput);
          if (hooks?.onAgentEnd) {
            hooks.onAgentEnd(agent.name, output);
          }

          currentInput = output;

        } catch (err) {
          if (hooks?.onError) {
            hooks.onError(agent.name, err as Error);
          }

          throw err;
        }
      }
  
      if (hooks?.onFinal) {
        hooks.onFinal([currentInput]);
      }

      return currentInput;
    }

    /**
     * A "safe" version of runInParallel that catches errors from individual agents.
     * 
     * @param query  The user input or initial query.
     * @param hooks  Optional TeamHooks for debugging/logging steps and errors.
     * @returns      An array of results, each containing success status and output.
     *               For successful agents, {success: true, output: string}.
     *               For failed agents, {success: false, output: error message}.
     */
    public async runInParallelSafe(query: string, hooks?: TeamHooks): Promise<{ success: boolean; output: string }[]> {
        const promises = this.agents.map(async (agent) => {
          if (hooks?.onAgentStart) {
            hooks.onAgentStart(agent.name, query);
          }

          try {
            const out = await agent.run(query);
            if (hooks?.onAgentEnd) {
                hooks.onAgentEnd(agent.name, out);
            }

            return { success: true, output: out };

          } catch (err) {
            if (hooks?.onError) {
                hooks.onError(agent.name, err as Error);
            }

            return { success: false, output: (err as Error).message };
          }
        });

        const results = await Promise.all(promises);
        if (hooks?.onFinal) {
            hooks.onFinal(results.map(r => r.output));
        }

        return results;
    }

    /**
     * A "safe" version of runSequential that catches errors from individual agents.
     * 
     * @param query        The user input or initial query.
     * @param stopOnError  If true, we stop executing further agents after the first error.
     *                     If false, we record the error and keep going with the next agent.
     * @param hooks        Optional TeamHooks for debugging/logging steps and errors.
     * @returns            An array of output strings from each agent in sequence.
     */
    public async runSequentialSafe(query: string, stopOnError: boolean, hooks?: TeamHooks): Promise<string[]> {
        let outputs: string[] = [];
        let currentInput = query;

        for (const agent of this.agents) {
            // onAgentStart hook
            if (hooks?.onAgentStart) {
                hooks.onAgentStart(agent.name, currentInput);
            }

            try {
                const out = await agent.run(currentInput);

                // onAgentEnd hook
                if (hooks?.onAgentEnd) {
                    hooks.onAgentEnd(agent.name, out);
                }

                // record output, pass to next agent
                outputs.push(out);
                currentInput = out;

            } catch (err) {
                // onError hook
                if (hooks?.onError) {
                    hooks.onError(agent.name, err as Error);
                }

                // record the error as an output
                const errorMsg = `Error from agent ${agent.name}: ${(err as Error).message}`;
                outputs.push(errorMsg);

                // break or continue based on stopOnError
                if (stopOnError) {
                    break;
                }
            }
        }

        // onFinal hook after the sequence completes
        if (hooks?.onFinal) {
            hooks.onFinal(outputs);
        }

        return outputs;
    } 
  
    public async aggregateResults(query: string): Promise<string> {
      const results = await this.runInParallel(query);
      return results.join("\n---\n"); // Combine all results
    }
}
