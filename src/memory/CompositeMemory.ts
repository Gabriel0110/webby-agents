import { Memory, ConversationMessage } from "./Memory";

export class CompositeMemory implements Memory {
  private memories: Memory[];

  constructor(...memories: Memory[]) {
    this.memories = memories;
  }

  public async addMessage(message: ConversationMessage): Promise<void> {
    for (const mem of this.memories) {
      await mem.addMessage(message);
    }
  }

  public async getContext(): Promise<ConversationMessage[]> {
    let all: ConversationMessage[] = [];
    for (const mem of this.memories) {
      const ctx = await mem.getContext();
      all = all.concat(ctx);
    }
    return this.sortByTimestamp(all);
  }

  public async getContextForPrompt(query: string): Promise<ConversationMessage[]> {
    let all: ConversationMessage[] = [];
    for (const mem of this.memories) {
      const partial = await mem.getContextForPrompt(query);
      all = all.concat(partial);
    }
    return this.sortByTimestamp(all);
  }

  public async clear(): Promise<void> {
    for (const mem of this.memories) {
      await mem.clear();
    }
  }

  private sortByTimestamp(messages: ConversationMessage[]): ConversationMessage[] {
    return messages.sort((a, b) => (a.metadata?.timestamp ?? 0) - (b.metadata?.timestamp ?? 0));
  }
}
