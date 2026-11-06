import { Tool, ToolResult } from './types.js';

export const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Evaluates mathematical and arithmetic expressions deterministically with 0 tokens',
  inputSchema: {
    type: 'string',
    description: 'A mathematical expression, e.g. "45 * 12", "sqrt(144)", "2^8"',
  },
  status: 'ready',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    const rawExpr = typeof input === 'string' ? input : (input.expression || input.query || '');
    const clean = rawExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\^/g, '**')
      .replace(/pi/gi, 'Math.PI')
      .replace(/e\b/gi, 'Math.E')
      .replace(/sqrt\(([^)]+)\)/gi, 'Math.sqrt($1)')
      .replace(/abs\(([^)]+)\)/gi, 'Math.abs($1)')
      .replace(/round\(([^)]+)\)/gi, 'Math.round($1)')
      .replace(/floor\(([^)]+)\)/gi, 'Math.floor($1)')
      .replace(/ceil\(([^)]+)\)/gi, 'Math.ceil($1)')
      .trim();

    // Security check: only allow numbers, math operators, parens, and Math functions
    const validMathRegex = /^[\d\s+\-*/().%eE]|(Math\.(PI|E|sqrt|abs|round|floor|ceil|pow|log|sin|cos|tan))$/;
    if (!/^[0-9+\-*/().%eE\sMathPIEsqrtabsroundfloorceilpowlog]+$/.test(clean)) {
      return {
        success: false,
        output: 'Invalid characters in mathematical expression.',
        error: 'Security validation failed',
      };
    }

    try {
      // Safe evaluation
      const fn = new Function(`"use strict"; return (${clean});`);
      const val = fn();
      if (typeof val !== 'number' || !isFinite(val)) {
        return {
          success: false,
          output: 'Calculation produced an undefined or non-finite result.',
          error: 'Math domain error',
        };
      }
      return {
        success: true,
        output: `${clean} = ${val}`,
        metadata: { result: val, expression: rawExpr },
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Error evaluating math: ${err.message}`,
        error: err.message,
      };
    }
  },
};
