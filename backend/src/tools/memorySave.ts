import { Tool, ToolResult } from './types.js';
import { supabaseMemory } from '../memory/supabaseMemory.js';
import { sseManager } from '../events/sseManager.js';

export const memorySaveTool: Tool = {
  name: 'memory_save',
  description: 'Persists key facts, user preferences, and insights into long-term memory via Supabase',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Unique memory key or title', required: true },
      value: { type: 'string', description: 'Content, fact, or instruction to remember', required: true },
      category: { type: 'string', description: 'Optional category e.g. "preference", "credential", "fact"' },
    },
  },
  status: 'ready',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    let key = '';
    let value = '';
    let category = 'general';

    if (typeof input === 'string') {
      const parts = input.split(/[:=]/);
      key = parts[0]?.trim() || `note_${Date.now()}`;
      value = parts.slice(1).join(':').trim() || input.trim();
    } else {
      key = input.key || `note_${Date.now()}`;
      value = input.value || '';
      category = input.category || 'general';
    }

    if (!value) {
      return { success: false, output: 'No memory value provided.', error: 'Missing value' };
    }

    const saved = await supabaseMemory.save(key, value, category);

    // Emit memory event for HUD
    sseManager.emit('memory', {
      layer: 'long-term',
      delta: 1,
      item: { id: saved.id, key: saved.key, value: saved.value },
    });

    return {
      success: true,
      output: `Saved to memory: "${saved.key}" -> "${saved.value}"`,
      metadata: { id: saved.id, backend: supabaseMemory.isConfigured() ? 'Supabase' : 'LocalFallback' },
    };
  },
};
