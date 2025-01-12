export type MemoryRole = "system" | "user" | "assistant" | "reflection";

/**
 * A single message in the conversation or agent's reasoning process.
 */
export interface ConversationMessage {
  role: MemoryRole;
  content: string;
  metadata?: any;
}

/**
 * The interface every Memory class should implement.
 */
export interface Memory {
  addMessage(message: ConversationMessage): Promise<void>;

  /**
   * Returns the entire stored context (used in older design).
   * In new design, consider using `getContextForPrompt()` instead.
   */
  getContext(): Promise<ConversationMessage[]>;

  /**
   * A more advanced method that returns only the relevant or necessary context
   * for a given query or scenario.
   */
  getContextForPrompt(query: string): Promise<ConversationMessage[]>;

  clear(): Promise<void>;
}
