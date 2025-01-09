// src/Evaluators/SimpleEvaluator.ts

import { OpenAIChat } from "../LLMs/OpenAIChat";
import { ConversationMessage } from "../memory/Memory";

export interface EvaluationResult {
  score: number;      // e.g. 0-1
  feedback: string;   // textual feedback
  improvements?: string; // optional or required improvements
}

/**
 * A trivial "evaluator" that calls an LLM to critique the last assistant message.
 */
export class SimpleEvaluator {
  private model: OpenAIChat;

  constructor(model: OpenAIChat) {
    this.model = model;
  }

  public async evaluate(messages: ConversationMessage[]): Promise<EvaluationResult> {
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistantMsg) {
      return { score: 0, feedback: "No assistant response to evaluate." };
    }

    const prompt = [
      { role: "system", content: "You are an AI that critiques assistant answers." },
      {
        role: "user",
        content: `Assistant answered: "${lastAssistantMsg.content}"\nPlease provide:\n- A numeric score (0-1)\n- Detailed feedback\n- Suggested improvements.`,
      },
    ];

    const evalResponse = await this.model.call(prompt);

    const scoreMatch = evalResponse.match(/Score:\s?([\d.]+)/i);
    const feedbackMatch = evalResponse.match(/Feedback:\s?([\s\S]+)/i);
    const improvementsMatch = evalResponse.match(/Improvements:\s?([\s\S]+)/i);

    return {
      score: scoreMatch ? parseFloat(scoreMatch[1]) : 0,
      feedback: feedbackMatch ? feedbackMatch[1].trim() : "No feedback.",
      improvements: improvementsMatch ? improvementsMatch[1].trim() : "No suggestions.",
    };
  }
}
