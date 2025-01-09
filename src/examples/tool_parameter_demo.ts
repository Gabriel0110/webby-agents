// src/examples/tool_parameter_demo.ts

import { Agent } from "../Agent";
import { ShortTermMemory } from "../memory/ShortTermMemory";
import { OpenAIChat } from "../LLMs/OpenAIChat";
import { DemoWeatherTool } from "../tools/DemoWeatherTool";

async function main() {
  // 1) Create LLM
  const model = new OpenAIChat({
    apiKey: "YOUR_API_KEY_HERE",
    model: "gpt-4o-mini",
    temperature: 0.7
  });

  // 2) Simple memory
  const memory = new ShortTermMemory(5);

  // 3) Tool with required "location" param
  const weatherTool = new DemoWeatherTool();

  // 4) Create an agent
  const agent = Agent.create({
    name: "WeatherAgent",
    model,
    memory,
    tools: [weatherTool],
    instructions: [
      "If the user wants weather data, call the WeatherTool with JSON arguments. The 'location' parameter is required, 'units' is optional. Example:\n" +
      `TOOL REQUEST: WeatherTool "{\\"location\\":\\"New York\\",\\"units\\":\\"imperial\\"}"`
    ],
    options: {
      useReflection: true,  // Multi-step reasoning
      maxSteps: 5,
      timeToLive: 60_000,
      debug: true
    },
    hooks: {
      onToolValidationError: (toolName, errorMsg) => {
        console.warn(`[Hook: onToolValidationError] Tool: ${toolName}, Error: ${errorMsg}`);
      },
      onToolResult: (toolName, result) => {
        console.log(`[Hook: onToolResult] Tool: ${toolName}, Result: ${result}`);
      }
    }
  });

  // 5) Let's run a user query that triggers the WeatherTool
  const userQuestion = "I'd like the weather for Tokyo in metric units, please.";
  console.log("\nUser Question:", userQuestion);

  // 6) The agent will (hopefully) produce a TOOL REQUEST with JSON arguments:
  const finalAnswer = await agent.run(userQuestion);
  console.log("\nAgent's Final Answer:\n", finalAnswer);
}

main().catch(console.error);
