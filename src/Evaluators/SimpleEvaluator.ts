// src/Evaluators/SimpleEvaluator.ts

import { OpenAIChat } from "../LLMs/OpenAIChat";
import { ConversationMessage } from "../memory/Memory";

export interface EvaluationResult {
  score: number;      // e.g., 0-1
  feedback: string;   // Detailed feedback
  improvements?: string; // Suggested improvements
}

export class SimpleEvaluator {
  private model: OpenAIChat;

  constructor(model: OpenAIChat) {
    this.model = model;
  }

  /**
   * Evaluates the last assistant response in the conversation memory.
   * @param messages Conversation history.
   * @returns EvaluationResult with score, feedback, and improvements.
   */
  public async evaluate(messages: ConversationMessage[]): Promise<EvaluationResult> {
    console.log("[SimpleEvaluator] Retrieved messages for evaluation:", messages);

    // Identify the last assistant message with "FINAL ANSWER:"
    const lastAssistantMsg = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.startsWith("FINAL ANSWER:"));

    if (!lastAssistantMsg) {
      console.warn("[SimpleEvaluator] No valid assistant message found to evaluate.");
      return {
        score: 0,
        feedback: "No valid assistant response found to evaluate.",
        improvements: "Ensure the assistant provides a response to the user query.",
      };
    }

    const assistantResponse = lastAssistantMsg.content.replace("FINAL ANSWER:", "").trim();

    const prompt = [
      { role: "system", content: "You are an AI evaluator that critiques assistant responses." },
      {
        role: "user",
        content: `Evaluate the following assistant response:

"${assistantResponse}"

Please provide:
1. A numeric score (0-1) assessing the quality and relevance of the response.
2. Detailed feedback about what the response did well or poorly.
3. Suggestions for improvements, if any. If no improvements are needed, leave the field blank.

Structure your response as follows:
Score: <numeric value>
Feedback: <detailed feedback>
Improvements: <suggested improvements>`,
      },
    ];

    const evalResponse = await this.model.call(prompt);

    console.log("[SimpleEvaluator] Raw evaluation response:", evalResponse);

    // Parse evaluation results
    const scoreMatch = evalResponse.match(/Score:\s*([\d.]+)/i);
    const feedbackMatch = evalResponse.match(/Feedback:\s*([\s\S]+?)Improvements:/i);
    const improvementsMatch = evalResponse.match(/Improvements:\s*([\s\S]+)/i);

    return {
      score: scoreMatch ? parseFloat(scoreMatch[1]) : 0,
      feedback: feedbackMatch ? feedbackMatch[1].trim() : "No feedback provided.",
      improvements: improvementsMatch ? improvementsMatch[1].trim() : "No improvements suggested.",
    };
  }
}
