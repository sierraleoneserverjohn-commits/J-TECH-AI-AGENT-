import { Tool, ToolResult } from './types.js';

export const datetimeTool: Tool = {
  name: 'datetime',
  description: 'Returns real current local and UTC date, time, day of the week, and epoch with 0 tokens',
  inputSchema: {
    type: 'string',
    description: 'Optional timezone or query, e.g. "UTC", "America/New_York"',
  },
  status: 'ready',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    const tz = typeof input === 'string' ? input.trim() : (input.timezone || '');
    const now = new Date();

    try {
      const options: Intl.DateTimeFormatOptions = {
        dateStyle: 'full',
        timeStyle: 'long',
      };
      if (tz && tz.includes('/')) {
        options.timeZone = tz;
      }

      const formatted = new Intl.DateTimeFormat('en-US', options).format(now);
      const iso = now.toISOString();

      return {
        success: true,
        output: `Current date and time: ${formatted} (ISO: ${iso})`,
        metadata: {
          iso,
          epochMs: now.getTime(),
          timezone: options.timeZone || 'System Local',
        },
      };
    } catch {
      return {
        success: true,
        output: `Current date and time: ${now.toUTCString()}`,
        metadata: { iso: now.toISOString(), epochMs: now.getTime() },
      };
    }
  },
};
