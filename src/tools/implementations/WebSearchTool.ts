import { Tool, ToolResult } from '../types';

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

    const backendUrl =
      localStorage.getItem('jexa_backend_url') ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const accessToken = localStorage.getItem('jexa_access_token') || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res = await fetch(`${backendUrl}/api/tools/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Search failed with status ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      output: data.output || data.answer || 'Search completed.',
      sources: data.sources || [],
      metadata: { engine: data.provider || 'Google Search Grounding' },
    };
  },
};
