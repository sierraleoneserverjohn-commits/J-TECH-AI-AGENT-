import { Tool, ToolResult } from '../types';
import { eventBus } from '../../events/eventBus';

export const MemoryRetrievalTool: Tool = {
  id: 'memory_retrieval',
  name: 'Memory Retrieval',
  description: 'Query and persist contextual memories across working and long-term storage',
  status: 'ready',
  category: 'memory',
  run: async (input: string): Promise<ToolResult> => {
    const trimmed = input.trim();
    const backendUrl =
      localStorage.getItem('jexa_backend_url') ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const accessToken = localStorage.getItem('jexa_access_token') || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

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

      const res = await fetch(`${backendUrl}/api/memory`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ layer: 'long-term', key, value }),
      });

      if (!res.ok) throw new Error(`Failed to persist memory (${res.status})`);
      const data = await res.json();

      eventBus.emit('memory', {
        layer: 'long-term',
        delta: 1,
        item: data.item,
        action: 'add',
      });

      return {
        success: true,
        output: `Successfully indexed to long-term memory:\n**${key}**: "${value}"`,
        metadata: { id: data.item?.id },
      };
    }

    // Read memories
    const res = await fetch(`${backendUrl}/api/memory`, { headers });
    if (!res.ok) throw new Error(`Failed to retrieve memories (${res.status})`);

    const data = await res.json();
    const memories = [...(data.longTermMemory || []), ...(data.workingMemory || [])];

    if (memories.length === 0) {
      return {
        success: true,
        output: 'No active memories currently indexed in neural storage. Use "remember [key]: [value]" to save.',
      };
    }

    // Filter if query provided
    const matches = trimmed
      ? memories.filter(
          (m) =>
            m.key.toLowerCase().includes(trimmed.toLowerCase()) ||
            m.value.toLowerCase().includes(trimmed.toLowerCase())
        )
      : memories;

    const listText = (matches.length > 0 ? matches : memories)
      .slice(0, 8)
      .map((m) => `• **${m.key}**: ${m.value} _(${new Date(m.timestamp).toLocaleTimeString()})_`)
      .join('\n');

    return {
      success: true,
      output: `### Retrieved Memory Records (${matches.length} found):\n\n${listText}`,
      metadata: { count: matches.length },
    };
  },
};
