import { Workflow, LLMCallStep } from "../Workflow";
import { OpenAIChat } from "../LLMs/OpenAIChat";
import { ShortTermMemory } from "../memory/ShortTermMemory";

async function main() {
  // 1) Create a model
  const model = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini",
    temperature: 0.7,
  });

  // 2) Create memory
  const memory = new ShortTermMemory(10);

  // 3) Define workflow steps
  // Step 1: "Greeting"
  const step1 = new LLMCallStep(model, "Step 1: Greet the user politely.");
  // Step 2: "Motivation"
  const step2 = new LLMCallStep(model, "Step 2: Provide a brief motivational quote.");

  // 4) Create a workflow with these steps
  const workflow = new Workflow([step1, step2], memory);

  // 5) Run the workflow
  const userInput = "I need some positivity today!";
  console.log("User says:", userInput);

  const finalOutput = await workflow.runSequential(userInput);
  console.log("Workflow Final Output:", finalOutput);
}

main().catch(console.error);
