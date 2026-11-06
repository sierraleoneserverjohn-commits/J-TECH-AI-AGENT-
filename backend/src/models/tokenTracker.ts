export interface TokenUsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestsCount: number;
}

export class TokenTracker {
  private dailyUsage = new Map<string, Record<string, TokenUsageRecord>>();

  private getTodayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public recordUsage(provider: string, promptTokens: number = 0, completionTokens: number = 0): void {
    const today = this.getTodayKey();
    let dayMap = this.dailyUsage.get(today);
    if (!dayMap) {
      dayMap = {};
      this.dailyUsage.set(today, dayMap);
    }

    const current = dayMap[provider] || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      requestsCount: 0,
    };

    current.promptTokens += promptTokens;
    current.completionTokens += completionTokens;
    current.totalTokens += promptTokens + completionTokens;
    current.requestsCount += 1;

    dayMap[provider] = current;
  }

  public getTodayUsage(provider: string): TokenUsageRecord {
    const today = this.getTodayKey();
    const dayMap = this.dailyUsage.get(today);
    return dayMap?.[provider] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, requestsCount: 0 };
  }

  public getAllToday(): Record<string, TokenUsageRecord> {
    const today = this.getTodayKey();
    return this.dailyUsage.get(today) || {};
  }
}

export const tokenTracker = new TokenTracker();
