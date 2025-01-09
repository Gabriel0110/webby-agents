import { Memory, ConversationMessage } from "./Memory";

export class ReflectionMemory implements Memory {
  private reflections: ConversationMessage[] = [];
  private includeReflections: boolean;

  constructor(includeReflections: boolean = false) {
    this.includeReflections = includeReflections;
  }

  async addMessage(message: ConversationMessage): Promise<void> {
    // Only store if role === 'reflection'
    if (message.role === "reflection") {
      this.reflections.push(message);
    }
  }

  async getContext(): Promise<ConversationMessage[]> {
    return this.includeReflections ? this.reflections : [];
  }

  async getContextForPrompt(_query: string): Promise<ConversationMessage[]> {
    return this.includeReflections ? this.reflections : [];
  }

  async clear(): Promise<void> {
    this.reflections = [];
  }
}
