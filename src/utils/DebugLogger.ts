// src/utils/DebugLogger.ts

export interface DebugStats {
    llmCallsUsed: number;
    llmCallsLimit: number;
    stepsUsed: number;
    maxSteps: number;
    elapsedMs: number;
    timeToLive: number;
  }
  
  export class DebugLogger {
    constructor(private enabled: boolean = false) {}
  
    log(message: string, context?: any) {
      if (!this.enabled) return;
      console.log(`[${new Date().toISOString()}] ${message}`);
      if (context) console.log(context);
    }
  
    warn(message: string, context?: any) {
      if (!this.enabled) return;
      console.warn(`[${new Date().toISOString()}] WARNING: ${message}`);
      if (context) console.warn(context);
    }
  
    error(message: string, error?: any) {
      if (!this.enabled) return;
      console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
      if (error) console.error(error);
    }

    logStep(step: { action: string; details: string }, attempt: number) {
      if (!this.enabled) return;
      console.log(`[${new Date().toISOString()}] Executing step (Attempt ${attempt}):`, step);
    }
    
    logRetry(reason: string, attempt: number, maxRetries: number) {
      if (!this.enabled) return;
      console.warn(`[${new Date().toISOString()}] Retry ${attempt}/${maxRetries} due to: ${reason}`);
    }
  
    stats(stats: DebugStats) {
      if (!this.enabled) return;
      console.log('\n=== Agent Stats ===');
      console.log(`LLM Calls: ${stats.llmCallsUsed}/${stats.llmCallsLimit}`);
      console.log(`Steps: ${stats.stepsUsed}/${stats.maxSteps}`);
      console.log(`Time: ${stats.elapsedMs}ms/${stats.timeToLive}ms`);
      console.log('=================\n');
    }
  }