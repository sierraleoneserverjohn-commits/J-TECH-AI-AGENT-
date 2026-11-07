import { Tool, ToolResult, ToolSource } from './types.js';
import { config } from '../config.js';
import dns from 'dns/promises';

/**
 * Validates whether an IP address is private, loopback, link-local, or cloud metadata.
 * Blocked IPv4 ranges:
 * - 0.0.0.0/8 (current network)
 * - 10.0.0.0/8 (private)
 * - 127.0.0.0/8 (loopback)
 * - 169.254.0.0/16 (link-local, cloud metadata e.g. 169.254.169.254)
 * - 172.16.0.0/12 (private: 172.16.0.0 - 172.31.255.255)
 * - 192.168.0.0/16 (private)
 * - 224.0.0.0/4 (multicast)
 * - 240.0.0.0/4 (reserved)
 * Blocked IPv6 ranges:
 * - ::1 (loopback)
 * - fc00::/7 (unique local)
 * - fe80::/10 (link-local)
 */
export function isPrivateOrRestrictedIp(ip: string): boolean {
  // IPv4 check
  if (ip.includes('.')) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // Malformed -> reject
    }
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a >= 224) return true; // Multicast / Reserved
    return false;
  }

  // IPv6 check
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // fe80::/10
  if (lower === '::' || lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6
    const mapped = lower.replace(/^::ffff:/, '');
    if (mapped.includes('.')) {
      return isPrivateOrRestrictedIp(mapped);
    }
    return true;
  }

  return false;
}

/**
 * Validates a URL against SSRF:
 * 1. Must use http or https scheme
 * 2. Resolves DNS and blocks private/loopback/cloud metadata IP addresses
 */
export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: ${parsed.protocol}. Only http and https allowed.`);
  }

  const hostname = parsed.hostname;

  // Resolve DNS to verify IP addresses
  const lookup = await dns.lookup(hostname, { all: true });
  if (!lookup || lookup.length === 0) {
    throw new Error(`DNS lookup failed for hostname: ${hostname}`);
  }

  for (const record of lookup) {
    if (isPrivateOrRestrictedIp(record.address)) {
      throw new Error(`SSRF Blocked: Target ${hostname} resolves to restricted/private IP ${record.address}`);
    }
  }

  return parsed;
}

/**
 * Safe fetch with SSRF validation, max 3 redirects re-validating each hop, 10s timeout, and 1 MB max size.
 */
export async function safeFetchText(initialUrl: string, maxRedirects = 3): Promise<{ text: string; finalUrl: string }> {
  let currentUrl = initialUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const validUrl = await validateSafeUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(validUrl.toString(), {
        signal: controller.signal,
        redirect: 'manual', // Manually handle redirects to enforce SSRF validation at every hop
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
        },
      });
      clearTimeout(timeout);

      // Handle redirect status codes 301, 302, 303, 307, 308
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error(`Redirect with status ${res.status} missing Location header`);
        }
        currentUrl = new URL(location, validUrl.toString()).toString();
        redirects += 1;
        if (redirects > maxRedirects) {
          throw new Error('Too many redirects (max 3)');
        }
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const contentType = res.headers.get('content-type') || '';
      const isText = contentType.includes('text/') || contentType.includes('json') || contentType.includes('xml');
      if (!isText && !contentType.includes('html')) {
        throw new Error(`Invalid MIME type: ${contentType}. Only text-based content is permitted.`);
      }

      // Stream text reading with 1 MB cap
      const reader = res.body?.getReader();
      if (!reader) {
        const fullText = await res.text();
        return { text: fullText.slice(0, 1024 * 1024), finalUrl: validUrl.toString() };
      }

      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.length;
          chunks.push(value);
          if (receivedBytes >= 1024 * 1024) {
            reader.cancel();
            break;
          }
        }
      }

      const merged = Buffer.concat(chunks);
      return { text: decoder.decode(merged), finalUrl: validUrl.toString() };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out after 10s');
      }
      throw err;
    }
  }

  throw new Error('Exceeded maximum redirect depth');
}

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
