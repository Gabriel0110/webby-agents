// src/memory/Memory.ts

export type MemoryRole = "system" | "user" | "assistant";

/**
 * A single message in the conversation.
 */
export interface ConversationMessage {
  role: MemoryRole;
  content: string;
  timestamp?: number;
}

/**
 * The interface every Memory class should implement.
 */
export interface Memory {
  addMessage(message: ConversationMessage): Promise<void>;
  getContext(): Promise<ConversationMessage[]>;
  clear(): Promise<void>;
}
