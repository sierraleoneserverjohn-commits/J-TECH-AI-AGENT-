import { calculatorTool } from '../tools/calculator.js';
import { datetimeTool } from '../tools/datetime.js';

export interface RuleEvaluationResult {
  handledLocally: boolean;
  reply?: string;
  toolNamesToProvide: string[];
  intent: 'math' | 'datetime' | 'search' | 'github' | 'memory' | 'document' | 'vision' | 'chat' | 'android';
}

export class RulesClassifier {
  /**
   * Evaluates rules before AI: handles calculations, time queries, and system greetings
   * completely locally using 0 AI model tokens!
   */
  public async evaluate(command: string): Promise<RuleEvaluationResult> {
    const text = command.trim();
    const lower = text.toLowerCase();

    // 1. Local Math Detection (0 tokens)
    // Matches expressions like "45 * 12", "what is 2 + 2", "sqrt(144)", "calculate 15% of 200"
    const isMathMathPattern =
      /^(\s*what\s+is\s+)?([0-9\s+\-*/().%eE^]+|sqrt\([0-9.]+\))$/i.test(text) ||
      /^calculate\s+[0-9\s+\-*/().%eE^]+/i.test(text);

    if (isMathMathPattern) {
      const expr = text.replace(/^(what\s+is|calculate)\s+/i, '').replace(/[?!=]/g, '').trim();
      const res = await calculatorTool.run(expr);
      if (res.success) {
        return {
          handledLocally: true,
          reply: `Result: ${res.output}`,
          toolNamesToProvide: ['calculator'],
          intent: 'math',
        };
      }
    }

    // 2. Local Date & Time Detection (0 tokens)
    // Matches "what time is it", "current date", "what is today's date", "time in UTC"
    if (
      lower.includes('what time is it') ||
      lower.includes('what is the time') ||
      lower.includes('current time') ||
      lower.includes("what's today's date") ||
      lower.includes('what is today') ||
      lower.includes('current date')
    ) {
      const res = await datetimeTool.run('');
      return {
        handledLocally: true,
        reply: res.output,
        toolNamesToProvide: ['datetime'],
        intent: 'datetime',
      };
    }

    // 3. Obvious App Commands (0 tokens)
    if (lower === 'ping' || lower === 'status' || lower === 'health') {
      return {
        handledLocally: true,
        reply: 'JEXA Core Operational. All subsystems online.',
        toolNamesToProvide: [],
        intent: 'chat',
      };
    }

    // 4. Token-Saving Tool Selection Classifier
    // Picks ONLY 1 to 3 relevant tools so massive tool schemas are never sent to models!
    const toolNames: string[] = [];
    let intent: RuleEvaluationResult['intent'] = 'chat';

    if (
      lower.includes('search') ||
      lower.includes('news') ||
      lower.includes('who is') ||
      lower.includes('what is the latest') ||
      lower.includes('find info') ||
      lower.includes('look up') ||
      lower.includes('weather')
    ) {
      toolNames.push('web_search');
      intent = 'search';
    }

    if (
      lower.includes('github') ||
      lower.includes('repo') ||
      lower.includes('commit') ||
      lower.includes('pull request') ||
      lower.includes('repository')
    ) {
      toolNames.push('github_read');
      intent = 'github';
    }

    if (
      lower.includes('remember') ||
      lower.includes('save to memory') ||
      lower.includes('memorize') ||
      lower.includes('store fact')
    ) {
      toolNames.push('memory_save');
      intent = 'memory';
    } else if (
      lower.includes('what do you remember') ||
      lower.includes('recall') ||
      lower.includes('search memory') ||
      lower.includes('my preference')
    ) {
      toolNames.push('memory_search');
      intent = 'memory';
    }

    if (
      lower.includes('read doc') ||
      lower.includes('document') ||
      lower.includes('file content') ||
      lower.includes('summarize file')
    ) {
      toolNames.push('document_reader');
      intent = 'document';
    }

    if (
      lower.includes('image') ||
      lower.includes('picture') ||
      lower.includes('photo') ||
      lower.includes('look at this') ||
      lower.includes('vision')
    ) {
      toolNames.push('vision_describe');
      intent = 'vision';
    }

    if (
      lower.includes('android') ||
      lower.includes('phone') ||
      lower.includes('sms') ||
      lower.includes('vibrate') ||
      lower.includes('open whatsapp')
    ) {
      toolNames.push('android_action');
      intent = 'android';
    }

    // If still empty and contains numbers/math words, include calculator
    if (toolNames.length === 0 && /\d+/.test(lower) && (lower.includes('+') || lower.includes('*') || lower.includes('minus') || lower.includes('times'))) {
      toolNames.push('calculator');
    }

    return {
      handledLocally: false,
      toolNamesToProvide: toolNames.slice(0, 3), // Max 3 tools to conserve tokens
      intent,
    };
  }
}

export const rulesClassifier = new RulesClassifier();
