import { Tool, ToolResult, ToolSource } from './types.js';
import { config } from '../config.js';

export const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Searches the live web using Tavily with token-efficient truncation (max 3 results, 300 chars each) and free fallback',
  inputSchema: {
    type: 'string',
    description: 'The search query to look up on the live web',
  },
  status: 'ready',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    const query = typeof input === 'string' ? input.trim() : (input.query || '');
    if (!query) {
      return { success: false, output: 'No search query provided.', error: 'Missing query' };
    }

    const sources: ToolSource[] = [];
    const snippets: string[] = [];

    // Tier 1: Tavily API if configured
    if (config.tavilyApiKey) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: config.tavilyApiKey,
            query,
            max_results: 3,
            search_depth: 'basic',
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const results = data.results || [];

          for (const item of results.slice(0, 3)) {
            // Strict token conservation: cap each snippet at 300 characters
            const rawContent = item.content || item.title || '';
            const truncated = rawContent.slice(0, 300).trim();
            snippets.push(`• **${item.title}**: ${truncated}`);
            sources.push({
              title: item.title,
              url: item.url,
            });
          }

          if (snippets.length > 0) {
            return {
              success: true,
              output: snippets.join('\n\n'),
              sources,
              metadata: { engine: 'Tavily', resultCount: snippets.length },
            };
          }
        }
      } catch {
        // Continue to free fallback
      }
    }

    // Tier 2: Free decentralized web knowledge fallback (Wikipedia + DuckDuckGo)
    try {
      // Query Wikipedia
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`,
        { headers: { 'User-Agent': 'JEXA-Command-Centre/1.0' } }
      );
      if (wikiRes.ok) {
        const wikiData = (await wikiRes.json()) as any;
        const hits = wikiData.query?.search || [];
        for (const h of hits.slice(0, 3)) {
          const clean = h.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").slice(0, 300).trim();
          snippets.push(`• **${h.title}**: ${clean}`);
          sources.push({
            title: h.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`,
          });
        }
      }

      // Query DuckDuckGo Instant Answer
      if (snippets.length < 3) {
        const ddgRes = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
          { headers: { 'User-Agent': 'JEXA-Command-Centre/1.0' } }
        );
        if (ddgRes.ok) {
          const ddgData = (await ddgRes.json()) as any;
          if (ddgData.AbstractText) {
            const heading = ddgData.Heading || query;
            snippets.unshift(`• **${heading}**: ${ddgData.AbstractText.slice(0, 300)}`);
            if (ddgData.AbstractURL) {
              sources.unshift({ title: heading, url: ddgData.AbstractURL });
            }
          }
        }
      }

      if (snippets.length > 0) {
        return {
          success: true,
          output: snippets.slice(0, 3).join('\n\n'),
          sources: sources.slice(0, 3),
          metadata: { engine: 'PublicWebKnowledge', resultCount: Math.min(3, snippets.length) },
        };
      }
    } catch (err: any) {
      return {
        success: false,
        output: `Search failed: ${err.message}`,
        error: err.message,
      };
    }

    return {
      success: false,
      output: 'No search results found for the requested query.',
      sources: [],
    };
  },
};
