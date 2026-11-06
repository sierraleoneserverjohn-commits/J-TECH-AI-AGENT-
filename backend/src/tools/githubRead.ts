import { Tool, ToolResult } from './types.js';
import { config } from '../config.js';

export const githubReadTool: Tool = {
  name: 'github_read',
  description: 'Inspects a GitHub repository structure, commits, or file contents via GitHub REST API',
  inputSchema: {
    type: 'object',
    properties: {
      repo: { type: 'string', description: 'Repository in format "owner/repo"', required: true },
      path: { type: 'string', description: 'File or directory path inside the repository' },
      action: { type: 'string', description: '"info", "tree", or "file"' },
    },
  },
  status: 'ready',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    let repo = '';
    let filePath = '';
    let action = 'info';

    if (typeof input === 'string') {
      const match = input.match(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+)/);
      repo = match ? match[1] : input.trim();
    } else {
      repo = input.repo || '';
      filePath = input.path || '';
      action = input.action || (filePath ? 'file' : 'info');
    }

    if (!repo || !repo.includes('/')) {
      return {
        success: false,
        output: 'Please provide a valid GitHub repository in "owner/repo" format.',
        error: 'Invalid repo parameter',
      };
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'JEXA-Command-Centre',
    };
    if (config.githubToken) {
      headers['Authorization'] = `token ${config.githubToken}`;
    }

    try {
      if (action === 'file' && filePath) {
        const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        const res = await fetch(fileUrl, { headers });
        if (!res.ok) {
          return { success: false, output: `GitHub API error (${res.status}): ${res.statusText}`, error: res.statusText };
        }
        const data = (await res.json()) as any;
        if (data.content && data.encoding === 'base64') {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          // Truncate to save tokens (max 1500 chars)
          const truncated = content.slice(0, 1500);
          return {
            success: true,
            output: `File: ${data.name} (${data.size} bytes)\n\n\`\`\`\n${truncated}${content.length > 1500 ? '\n...[content truncated for token efficiency]' : ''}\n\`\`\``,
            metadata: { path: data.path, size: data.size, truncated: content.length > 1500 },
          };
        }
      }

      // Default: repo overview & recent branch info
      const repoUrl = `https://api.github.com/repos/${repo}`;
      const res = await fetch(repoUrl, { headers });
      if (!res.ok) {
        return { success: false, output: `GitHub API error (${res.status}): ${res.statusText}`, error: res.statusText };
      }

      const data = (await res.json()) as any;
      const overview = [
        `Repository: ${data.full_name}`,
        `Description: ${data.description || 'No description provided'}`,
        `Stars: ${data.stargazers_count} | Forks: ${data.forks_count} | Open Issues: ${data.open_issues_count}`,
        `Default Branch: ${data.default_branch} | License: ${data.license?.spdx_id || 'None'}`,
        `URL: ${data.html_url}`,
      ].join('\n');

      return {
        success: true,
        output: overview,
        sources: [{ title: data.full_name, url: data.html_url }],
        metadata: { defaultBranch: data.default_branch, stars: data.stargazers_count },
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to query GitHub: ${err.message}`,
        error: err.message,
      };
    }
  },
};
