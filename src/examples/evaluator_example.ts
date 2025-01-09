import { Agent } from "../Agent";
import { SimpleEvaluator } from "../Evaluators/SimpleEvaluator";
import { ShortTermMemory } from "../memory/ShortTermMemory";
import { OpenAIChat } from "../LLMs/OpenAIChat";

async function main() {
  // 1) Create a model
  const agentModel = new OpenAIChat({
    apiKey: "YOUR_API_KEY",
    model: "gpt-4o-mini"
  });

  // 2) Create memory
  const memory = new ShortTermMemory(10);

  // 3) Create the agent
  const agent = Agent.create({
    name: "EvaluatedAgent",
    model: agentModel,
    memory,
    instructions: ["Provide a thorough but concise answer."],
    options: { maxSteps: 3, usageLimit: 5, useReflection: true }
  });

  // 4) SimpleEvaluator (for critique)
  const evalModel = new OpenAIChat({
    apiKey: "YOUR_API_KEY",
    model: "gpt-4o-mini"
  });
  const evaluator = new SimpleEvaluator(evalModel);

  // 5) Run agent
  const userQuestion = "Explain the difference between a supervised and unsupervised learning algorithm.";
  const answer = await agent.run(userQuestion);

  console.log("\nAgent's Final Answer:\n", answer);

  // 6) Evaluate final answer
  const messages = await memory.getContext();
  const result = await evaluator.evaluate(messages);

  console.log("\nEvaluation Result:\nScore:", result.score, "\nFeedback:", result.feedback, "\nImprovements:", result.improvements);
}

main().catch(console.error);
