import { Agent } from "../agents/Agent";
import { AgentTeam } from "../multi-agent/AgentTeam";
import { ShortTermMemory } from "../memory/ShortTermMemory";
import { OpenAIChat } from "../LLMs/OpenAIChat";

// We'll create two simple Agents with no real tools or reflection

async function main() {
  // 1) Create base LLMs
  const agent1Model = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini"
  });
  const agent2Model = new OpenAIChat({
    apiKey: "YOUR-API-KEY",
    model: "gpt-4o-mini"
  });

  // 2) Memory
  const mem1 = new ShortTermMemory(5);
  const mem2 = new ShortTermMemory(5);

  // 3) Agent #1: "GreetingAgent"
  const greetingAgent = Agent.create({
    name: "GreetingAgent",
    model: agent1Model,
    memory: mem1,
    instructions: [
      "Greet the user in a friendly way."
    ],
    options: {
      maxSteps: 1,
      useReflection: false
    }
  });

  // 4) Agent #2: "MotivationAgent"
  const motivationAgent = Agent.create({
    name: "MotivationAgent",
    model: agent2Model,
    memory: mem2,
    instructions: [
      "Provide a short motivational statement or advice to the user."
    ],
    options: {
      maxSteps: 1,
      useReflection: false
    }
  });

  // 5) Create an AgentTeam
  const team = new AgentTeam("Greeting+MotivationTeam", [greetingAgent, motivationAgent]);

  // 6) Use runInParallel
  const userPrompt = "I could use some positivity today!";
  console.log("User Prompt:", userPrompt);

  const parallelResults = await team.runInParallel(userPrompt);
  console.log("\nParallel Results:\n", parallelResults);

  // 7) Use runSequential
  const sequentialResult = await team.runSequential(userPrompt);
  console.log("\nSequential Result:\n", sequentialResult);
}

main().catch(console.error);
