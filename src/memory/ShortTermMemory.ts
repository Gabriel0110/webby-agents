// src/memory/ShortTermMemory.ts
import { Memory, ConversationMessage } from "./Memory";

/**
 * A simple short-term memory that stores up to N messages in an array.
 */
export class ShortTermMemory implements Memory {
    private messages: ConversationMessage[] = [];
    private maxMessages: number;
  
    constructor(maxMessages = 20) {
      this.maxMessages = maxMessages;
    }
  
    async addMessage(message: ConversationMessage): Promise<void> {
      this.messages.push(message);
      if (this.messages.length > this.maxMessages) {
        this.messages.shift();
      }
    }
  
    async getContext(): Promise<ConversationMessage[]> {
      return this.messages;
    }
  
    async clear(): Promise<void> {
      this.messages = [];
    }
  }