import { ApiConnector } from './types';

export const GitHubConnector: ApiConnector = {
  id: 'github',
  name: 'GitHub API',
  description: 'Inspect repositories, read source code, and dispatch issues',
  auth: {
    type: 'token',
    isConfigured: typeof window !== 'undefined' && !!localStorage.getItem('jexa_github_token'),
    tokenKey: 'jexa_github_token',
  },
  actions: [
    {
      id: 'search_repos',
      name: 'Search Repositories',
      description: 'Find public GitHub repositories by topic or query',
      requiresConfirmation: false,
      execute: async ({ query }) => {
        const backendUrl = localStorage.getItem('jexa_backend_url') || (typeof window !== 'undefined' ? window.location.origin : '');
        const res = await fetch(`${backendUrl}/api/tools/github?action=search&q=${encodeURIComponent(query || 'AI')}`);
        if (!res.ok) throw new Error(`GitHub search failed (${res.status})`);
        return res.json();
      },
    },
    {
      id: 'get_file',
      name: 'Read Repository File',
      description: 'Fetch and view source file content from a repository',
      requiresConfirmation: false,
      execute: async ({ repo, path }) => {
        const backendUrl = localStorage.getItem('jexa_backend_url') || (typeof window !== 'undefined' ? window.location.origin : '');
        const res = await fetch(
          `${backendUrl}/api/tools/github?action=file&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path || 'README.md')}`
        );
        if (!res.ok) throw new Error(`Failed to read repo file (${res.status})`);
        return res.json();
      },
    },
    {
      id: 'create_issue',
      name: 'Create Repository Issue',
      description: 'File an issue or bug ticket on GitHub repository',
      requiresConfirmation: true,
      execute: async ({ repo, title, body }) => {
        const backendUrl = localStorage.getItem('jexa_backend_url') || (typeof window !== 'undefined' ? window.location.origin : '');
        const token = localStorage.getItem('jexa_github_token') || '';
        const res = await fetch(`${backendUrl}/api/tools/github`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_issue', repo, title, body, token }),
        });
        if (!res.ok) throw new Error(`Failed to create issue (${res.status})`);
        return res.json();
      },
    },
  ],
};
