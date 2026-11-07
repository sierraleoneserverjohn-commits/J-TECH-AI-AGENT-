import { ApiConnector } from './types';
import { ApiClient } from '../../api/client';

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
      execute: async ({ query, repo }) => {
        return ApiClient.post('/tools/github', {
          action: 'info',
          repo: repo || query || 'facebook/react',
        });
      },
    },
    {
      id: 'get_file',
      name: 'Read Repository File',
      description: 'Fetch and view source file content from a repository',
      requiresConfirmation: false,
      execute: async ({ repo, path }) => {
        return ApiClient.post('/tools/github', {
          action: 'file',
          repo: repo || 'facebook/react',
          path: path || 'package.json',
        });
      },
    },
    {
      id: 'create_issue',
      name: 'Create Repository Issue',
      description: 'File an issue or bug ticket on GitHub repository',
      requiresConfirmation: true,
      execute: async ({ repo, title, body }) => {
        return ApiClient.post('/tools/github', {
          action: 'create_issue',
          repo,
          title,
          body,
        });
      },
    },
  ],
};
