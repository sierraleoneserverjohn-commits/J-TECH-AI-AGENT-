import { Tool, ToolResult } from '../types';
import { ApiClient } from '../../api/client';

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

    const data = await ApiClient.post('/tools/browse', { url });
    const sources = data.sources || [{ title: url, url }];

    return {
      success: true,
      output: data.output || `### Web Page Summary\n\n${data.summary || 'Content fetched.'}\n\n*Note: Click/type interactive navigation is planned for Stage 2 (requires backend headless browser).*`,
      sources,
      metadata: { url, ...data.metadata },
    };
  },
};
