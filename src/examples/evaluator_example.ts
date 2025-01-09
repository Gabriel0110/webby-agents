import { Agent } from "../Agent";
import { SimpleEvaluator } from "../Evaluators/SimpleEvaluator";
import { ShortTermMemory } from "../memory/ShortTermMemory";
import { OpenAIChat } from "../LLMs/OpenAIChat";

async function main() {
  // 1) Create a model for the agent
  const agentModel = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
  });

  // 2) Create memory
  const memory = new ShortTermMemory(10);

  // 3) Create the agent
  const agent = Agent.create({
    name: "EvaluatedAgent",
    model: agentModel,
    memory,
    instructions: ["Provide a concise but detailed explanation."],
    options: { maxSteps: 3, usageLimit: 5, useReflection: true, debug: true},
  });

  // 4) Create a model for the evaluator
  const evalModel = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
  });

  const evaluator = new SimpleEvaluator(evalModel);

  // 5) Run the agent
  const userQuestion = "Explain the difference between supervised and unsupervised learning algorithms.";
  const answer = await agent.run(userQuestion);

  console.log("\nAgent's Final Answer:\n", answer);

  // 6) Evaluate the final answer
  const messages = await memory.getContext();
  const result = await evaluator.evaluate(messages);

  console.log("\nEvaluation Result:");
  console.log("Score:", result.score);
  console.log("Feedback:", result.feedback);
  console.log("Improvements:", result.improvements);
}

main().catch(console.error);
