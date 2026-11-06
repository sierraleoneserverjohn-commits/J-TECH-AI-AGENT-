import { Tool, ToolResult } from '../types';

export const BrowserAgentTool: Tool = {
  id: 'browser_agent',
  name: 'Browser Agent (Read-Only)',
  description: 'Fetch and parse web pages server-side, summarize content, and extract citations',
  status: 'ready',
  category: 'search',
  run: async (input: string): Promise<ToolResult> => {
    let url = input.trim();
    if (!url) {
      return { success: false, output: 'Please enter a target URL to browse.' };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    const backendUrl =
      localStorage.getItem('jexa_backend_url') ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const accessToken = localStorage.getItem('jexa_access_token') || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res = await fetch(`${backendUrl}/api/tools/browse`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch page (${res.status})`);
    }

    const data = await res.json();
    const sources = [{ title: data.title || url, url }];

    return {
      success: true,
      output: `### ${data.title || 'Web Page Summary'}\n\n${data.summary}\n\n*Note: Click/type interactive navigation is planned for Stage 2 (requires backend headless browser).*`,
      sources,
      metadata: { url, contentLength: data.length },
    };
  },
};
