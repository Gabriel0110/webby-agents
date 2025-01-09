// src/tools/DemoWeatherTool.ts

import { Tool } from "./Tools";
import { ToolParameter } from "./ToolMetadata";

export class DemoWeatherTool implements Tool {
  name = "WeatherTool";
  description = "Retrieves weather data from a hypothetical weather API.";

  // Parameter definitions: "location" is required, "units" is optional
  parameters: ToolParameter[] = [
    { name: "location", type: "string", required: true, description: "City or location name" },
    { name: "units", type: "string", required: false, description: "Desired unit system (imperial or metric)" }
  ];

  /**
   * The tool can accept either a raw string in `input` or structured args in `args`.
   * In this example, we rely on `args` to read the parameters properly.
   */
  async run(input: string, args?: Record<string, any>): Promise<string> {
    if (!args) {
      return `Error: You must provide JSON arguments matching the required parameters: "location", optional "units".\nExample:\nTOOL REQUEST: WeatherTool "{\"location\":\"New York\",\"units\":\"metric\"}"`;
    }

    const location = args["location"];
    const units = args["units"] ?? "metric";

    if (!location) {
      return `Error: Missing "location" parameter. This is required.`;
    }

    // Here you'd call a real API or do a stub
    // For demonstration, we'll just pretend we have data
    return `Stubbed Weather: It's sunny in ${location} [units=${units}] right now.`;
  }
}