import { Tool, ToolResult } from '../types';
import { ApiClient } from '../../api/client';

export const WebSearchTool: Tool = {
  id: 'web_search',
  name: 'Web Search',
  description: 'Search the live web using Google Search grounding with Tavily and public knowledge fallback',
  status: 'ready',
  category: 'search',
  run: async (input: string): Promise<ToolResult> => {
    const query = input.trim();
    if (!query) {
      return { success: false, output: 'Please provide a search query.' };
    }

    const data = await ApiClient.post('/tools/search', { query });
    return {
      success: true,
      output: data.output || data.answer || 'Search completed.',
      sources: data.sources || [],
      metadata: { engine: data.provider || 'Google Search Grounding' },
    };
  },
};
