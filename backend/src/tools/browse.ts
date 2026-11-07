import { Tool, ToolResult } from './types.js';
import { safeFetchText } from './webSearch.js';

export const browseTool: Tool = {
  name: 'browser_agent',
  description: 'Stage 1 read-only page summarization: fetches a safe external URL, strips markup, and returns text content',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The web page URL to inspect and summarize', required: true },
      instruction: { type: 'string', description: 'Specific summarization prompt or query' },
    },
  },
  status: 'ready',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    let url = '';
    let instruction = 'Summarize key information from this page';

    if (typeof input === 'string') {
      url = input.trim();
    } else {
      url = input.url || '';
      instruction = input.instruction || instruction;
    }

    if (!url) {
      return { success: false, output: 'URL is required for browsing.', error: 'Missing url' };
    }

    try {
      const { text: html, finalUrl } = await safeFetchText(url, 3);

      // Clean HTML tags, scripts, and styling
      const textOnly = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000); // 10k character slice for token efficiency

      const hostname = new URL(finalUrl).hostname;

      return {
        success: true,
        output: `Fetched ${textOnly.length} chars from ${hostname}.\n\nContent preview:\n${textOnly.slice(0, 1500)}${textOnly.length > 1500 ? '\n...[content truncated for token conservation]' : ''}`,
        sources: [{ title: hostname, url: finalUrl }],
        metadata: {
          stage: 'read-only',
          note: 'Interactive click/type navigation is planned (requires backend headless browser).',
          url: finalUrl,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to browse URL: ${err.message}`,
        error: err.message,
      };
    }
  },
};
