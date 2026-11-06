import { ToolResult } from '../tools/types.js';

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  sanitizedOutput: string;
}

export class VerificationEngine {
  /**
   * Verifies that a tool result is non-empty, sensible, and not a silent error before the agent uses it
   */
  public verify(toolName: string, result: ToolResult): VerificationResult {
    // 1. Check if completely empty
    if (!result || typeof result.output !== 'string' || !result.output.trim()) {
      return {
        valid: false,
        reason: `Tool "${toolName}" returned an empty output.`,
        sanitizedOutput: 'Tool returned no information.',
      };
    }

    const trimmed = result.output.trim();

    // 2. Check for obvious failure indicators
    if (result.success === false) {
      return {
        valid: false,
        reason: result.error || `Tool "${toolName}" reported execution failure.`,
        sanitizedOutput: trimmed,
      };
    }

    // 3. Check for nonsensical or HTML error outputs
    if (trimmed.startsWith('<!DOCTYPE html>') || trimmed.includes('<title>502 Bad Gateway</title>')) {
      return {
        valid: false,
        reason: 'Received HTML error response instead of structured content.',
        sanitizedOutput: 'The external service encountered a network gateway error.',
      };
    }

    // 4. Check for rate limit or quota mentions in text
    if (trimmed.includes('quota exceeded') || trimmed.includes('429 Too Many Requests')) {
      return {
        valid: true, // Valid to present to user, but flagged
        reason: 'Quota limit mentioned in response',
        sanitizedOutput: trimmed,
      };
    }

    return {
      valid: true,
      sanitizedOutput: trimmed,
    };
  }
}

export const verificationEngine = new VerificationEngine();
