import { Tool, ToolResult } from './types.js';
import { supabaseMemory } from '../memory/supabaseMemory.js';

export const memorySearchTool: Tool = {
  name: 'memory_search',
  description: 'Searches long-term memory for stored facts, preferences, and user context via Supabase',
  inputSchema: {
    type: 'string',
    description: 'The search query or keyword to locate in memory',
  },
  status: 'ready',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    const query = typeof input === 'string' ? input.trim() : (input.query || '');
    if (!query) {
      return { success: false, output: 'No memory query provided.', error: 'Missing query' };
    }

    const records = await supabaseMemory.search(query, 5);
    if (records.length === 0) {
      return {
        success: true,
        output: `No memories found matching "${query}".`,
        metadata: { count: 0 },
      };
    }

    const formatted = records.map((r) => `• [${r.key}]: ${r.value}`).join('\n');
    return {
      success: true,
      output: `Retrieved ${records.length} relevant memories:\n${formatted}`,
      metadata: { count: records.length, records },
    };
  },
};
