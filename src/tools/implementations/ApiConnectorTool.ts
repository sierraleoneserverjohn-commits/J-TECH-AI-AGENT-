import { Tool, ToolResult } from '../types';
import { GitHubConnector } from '../connectors/GitHubConnector';

export const ApiConnectorTool: Tool = {
  id: 'api_connectors',
  name: 'API Connectors (GitHub)',
  description: 'Interface for external API connectors. Query GitHub repos, issues, and metadata',
  status: 'ready',
  category: 'code',
  run: async (input: string): Promise<ToolResult> => {
    const trimmed = input.trim();
    const query = trimmed || 'AI command centre';

    const searchAction = GitHubConnector.actions.find((a) => a.id === 'search_repos');
    if (!searchAction) {
      throw new Error('Search action not configured in GitHubConnector');
    }

    const data = await searchAction.execute({ query });
    const items = data.items || [];
    const summary = items
      .slice(0, 5)
      .map(
        (repo: any) =>
          `• **${repo.full_name}** (⭐ ${repo.stargazers_count})\n  _${repo.description || 'No description'}_ — [${repo.html_url}](${repo.html_url})`
      )
      .join('\n');

    return {
      success: true,
      output: `### GitHub Repositories for "${query}":\n\n${summary || 'No repositories found.'}`,
      sources: items.slice(0, 5).map((r: any) => ({ title: r.full_name, url: r.html_url })),
    };
  },
};
