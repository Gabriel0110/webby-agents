/**
 * reflection_example.ts
 *
 * Demonstrates an agent with two memory objects:
 *   1) A public short-term memory (shared with the user).
 *   2) A ReflectionMemory that stores chain-of-thought or self-critique.
 *
 * The agent:
 *  - Adds "reflection" messages after each generation.
 *  - Optionally can see those reflections if we set includeReflections=true.
 *  - Otherwise, the reflection is purely for developer debugging.
 */

import { Agent } from "../agents/Agent";
import { OpenAIChat } from "../LLMs/OpenAIChat";
import { ShortTermMemory } from "../memory/ShortTermMemory";
import { ReflectionMemory } from "../memory/ReflectionMemory";
import { CompositeMemory } from "../memory/CompositeMemory";

async function main() {
  // 1) Create the main model
  const chatModel = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.7,
  });

  // 2) Create a public ShortTermMemory for the user conversation
  const publicMemory = new ShortTermMemory(5);

  // 3) Create a ReflectionMemory that we do NOT show to the user by default
  //    If you pass `true` to ReflectionMemory constructor, it would include
  //    the reflection messages in the next prompt, letting the agent see them.
  //    If `false`, it effectively hides them from the agent's own prompt calls.
  const reflectionMem = new ReflectionMemory(false);

  // 4) Combine them in a CompositeMemory if you want a single `memory` object
  //    for the agent. Or you could keep them separate if you prefer to pass them
  //    manually. Let's combine them so agent sees only short-term memory by default.
  const combinedMem = new CompositeMemory(publicMemory, reflectionMem);

  // 5) Create an Agent
  const agent = Agent.create({
    name: "ReflectiveAgent",
    model: chatModel,
    memory: combinedMem,
    instructions: [
      "You are a reflective agent who tries to self-critique after each answer.",
      "However, do NOT reveal your chain-of-thought or reflections to the user."
    ],
    options: {
      maxSteps: 3,
      useReflection: true // so agent can do multi-step if needed
    }
  });

  // 6) We'll override (or wrap) the final answer logic to store reflection
  //    messages after each run or step. Alternatively, you can do it with hooks.
  //    For simplicity, let's do it in a hook (onStep or onFinalAnswer).
  const originalHooks = agent["hooks"] || {};
  agent["hooks"] = {
    ...originalHooks,
    onFinalAnswer: (answer: string) => {
      console.log("Agent's Final Answer:", answer);
      // Now let's add a reflection message about that final answer
      reflectionMem.addMessage({
        role: "reflection",
        content: `I gave an answer: "${answer}". My quick critique: might want to verify correctness next time.`
      });
    }
  };

  // 7) Use the Agent with a question
  console.log("\n--- Asking the agent a question ---");
  const userQuestion = "What is the approximate radius of the Earth in kilometers?";
  const finalOutput = await agent.run(userQuestion);
  console.log("Final Output =>", finalOutput);

  // 8) Print out reflection memory for debugging
  //    It's not appended to the user conversation by default (includeReflections = false).
  const reflectionContext = await reflectionMem.getContext();
  console.log("\n[DEBUG] Reflection Memory =>", reflectionContext);

  // If we want to let the agent see its reflections next time, we can set:
  // reflectionMem["includeReflections"] = true;
  // Then agent's next call might incorporate them in the prompt for deeper self-critique.
}

main().catch(console.error);
