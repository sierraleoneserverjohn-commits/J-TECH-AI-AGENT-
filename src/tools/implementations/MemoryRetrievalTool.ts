import { Tool, ToolResult } from '../types';
import { eventBus } from '../../events/eventBus';
import { ApiClient } from '../../api/client';

export const MemoryRetrievalTool: Tool = {
  id: 'memory_retrieval',
  name: 'Memory Retrieval',
  description: 'Query and persist contextual memories across working and long-term storage via Supabase backend',
  status: 'ready',
  category: 'memory',
  run: async (input: string): Promise<ToolResult> => {
    const trimmed = input.trim();

    // If input starts with "save" or "remember":
    const isSave =
      trimmed.toLowerCase().startsWith('save ') ||
      trimmed.toLowerCase().startsWith('remember ') ||
      trimmed.toLowerCase().includes('store:');

    if (isSave) {
      const content = trimmed.replace(/^(save|remember)\s+/i, '').trim();
      const parts = content.split(':');
      const key = parts.length > 1 ? parts[0].trim() : 'user_directive';
      const value = parts.length > 1 ? parts.slice(1).join(':').trim() : content;

      const data = await ApiClient.post('/command', {
        text: `remember ${key}: ${value}`,
      });

      const item = {
        id: `mem-${Date.now()}`,
        key,
        value,
        timestamp: Date.now(),
      };

      eventBus.emit('memory', {
        layer: 'long-term',
        delta: 1,
        item,
        action: 'add',
      });

      return {
        success: true,
        output: data.output || data.reply || `Successfully indexed to long-term memory:\n**${key}**: "${value}"`,
        metadata: { id: item.id },
      };
    }

    // Search memories via backend agent
    const searchRes = await ApiClient.post('/command', {
      text: `search memory for ${trimmed || 'all'}`,
    });

    return {
      success: true,
      output: searchRes.output || searchRes.reply || 'Memory query completed.',
      metadata: { query: trimmed },
    };
  },
};
