export interface CircuitState {
  name: string;
  failures: number;
  pausedUntil: number;
  backoffMs: number; // starts at 20,000ms, doubles up to 300,000ms (5m)
  lastError?: string;
  dailyRequests: number;
  dailyCap: number;
  remainingTokens?: number;
  remainingRequests?: number;
  lastResetDay: string;
}

export class CircuitBreaker {
  private circuits = new Map<string, CircuitState>();

  constructor() {
    this.init('Groq', 14400);
    this.init('Gemini', 1500);
    this.init('OpenRouter', 500);
  }

  public init(name: string, defaultCap: number): void {
    const today = new Date().toISOString().slice(0, 10);
    this.circuits.set(name, {
      name,
      failures: 0,
      pausedUntil: 0,
      backoffMs: 20000,
      dailyRequests: 0,
      dailyCap: defaultCap,
      lastResetDay: today,
    });
  }

  public setDailyCap(name: string, cap: number): void {
    let circuit = this.circuits.get(name);
    if (!circuit) {
      this.init(name, cap);
    } else {
      circuit.dailyCap = cap;
    }
  }

  public canExecute(name: string): { allowed: boolean; reason?: string } {
    const circuit = this.circuits.get(name);
    if (!circuit) return { allowed: true };

    const today = new Date().toISOString().slice(0, 10);
    if (circuit.lastResetDay !== today) {
      circuit.dailyRequests = 0;
      circuit.lastResetDay = today;
    }

    // Daily Cap Check
    if (circuit.dailyRequests >= circuit.dailyCap) {
      return {
        allowed: false,
        reason: `Daily request cap of ${circuit.dailyCap} reached for provider ${name}`,
      };
    }

    // Circuit Breaker Pause Check
    const now = Date.now();
    if (now < circuit.pausedUntil) {
      const remainingSec = Math.ceil((circuit.pausedUntil - now) / 1000);
      return {
        allowed: false,
        reason: `Circuit open for ${name} due to repeated errors. Paused for ${remainingSec}s`,
      };
    }

    return { allowed: true };
  }

  public recordSuccess(name: string, headers?: Headers): void {
    const circuit = this.circuits.get(name);
    if (!circuit) return;

    circuit.failures = 0;
    circuit.backoffMs = 20000;
    circuit.pausedUntil = 0;
    circuit.dailyRequests += 1;

    // Read rate-limit headers if present (e.g. from Groq or OpenRouter)
    if (headers) {
      const remReq = headers.get('x-ratelimit-remaining-requests');
      const remTokens = headers.get('x-ratelimit-remaining-tokens');
      if (remReq) circuit.remainingRequests = parseInt(remReq, 10);
      if (remTokens) circuit.remainingTokens = parseInt(remTokens, 10);
    }
  }

  public recordFailure(name: string, errorMsg: string, status?: number, retryAfterSec?: number): void {
    const circuit = this.circuits.get(name);
    if (!circuit) return;

    circuit.failures += 1;
    circuit.lastError = errorMsg;

    let pauseMs = circuit.backoffMs;

    // Honor HTTP 429 Retry-After if provided by provider
    if (retryAfterSec && retryAfterSec > 0) {
      pauseMs = retryAfterSec * 1000;
    } else {
      // Exponential backoff: 20s, 40s, 80s, 160s, max 300s (5 minutes)
      pauseMs = Math.min(300000, circuit.backoffMs);
      circuit.backoffMs = Math.min(300000, circuit.backoffMs * 2);
    }

    circuit.pausedUntil = Date.now() + pauseMs;
  }

  public getState(name: string): CircuitState | undefined {
    return this.circuits.get(name);
  }

  public getAllStates(): Record<string, CircuitState> {
    const res: Record<string, CircuitState> = {};
    for (const [k, v] of this.circuits.entries()) {
      res[k] = { ...v };
    }
    return res;
  }
}

export const circuitBreaker = new CircuitBreaker();
