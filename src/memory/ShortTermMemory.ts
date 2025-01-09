import { Memory, ConversationMessage } from "./Memory";

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

  /**
   * By default, we just return all short-term messages for the user.
   * But if you want, you can skip reflection messages or filter.
   */
  async getContextForPrompt(_query: string): Promise<ConversationMessage[]> {
    return this.getContext();
  }

  async clear(): Promise<void> {
    this.messages = [];
  }
}
