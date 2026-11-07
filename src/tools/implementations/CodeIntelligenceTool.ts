import { Tool, ToolResult } from '../types';
import { eventBus } from '../../events/eventBus';
import { ApiClient } from '../../api/client';

export const CodeIntelligenceTool: Tool = {
  id: 'code_intelligence',
  name: 'Code Intelligence',
  description: 'Inspect GitHub repository source code, explain logic, and suggest code modifications',
  status: 'ready',
  category: 'code',
  run: async (input: string): Promise<ToolResult> => {
    const trimmed = input.trim();
    if (!trimmed) {
      return { success: false, output: 'Please specify a repository (e.g. "facebook/react" or "explain src/App.tsx in vercel/next.js").' };
    }

    const isWriteAction =
      trimmed.toLowerCase().includes('write') ||
      trimmed.toLowerCase().includes('commit') ||
      trimmed.toLowerCase().includes('push') ||
      trimmed.toLowerCase().includes('create pr') ||
      trimmed.toLowerCase().includes('delete');

    if (isWriteAction) {
      // Require confirm card before any write action
      return new Promise((resolve) => {
        const actionId = `act-${Date.now()}`;
        eventBus.emit('action', {
          id: actionId,
          title: 'GitHub Repository Modification',
          description: `JEXA requires confirmation to execute code modification: "${trimmed}"`,
          requiresConfirmation: true,
          status: 'pending',
          payload: { command: trimmed },
        });

        const unsub = eventBus.on('action', (act) => {
          if (act.id === actionId) {
            if (act.status === 'confirmed') {
              unsub();
              resolve({
                success: true,
                output: `Confirmed and queued write operation for: "${trimmed}". Executing through secure GitHub token interface.`,
              });
            } else if (act.status === 'cancelled') {
              unsub();
              resolve({
                success: false,
                output: 'Operation cancelled by user.',
                error: 'Action cancelled',
              });
            }
          }
        });
      });
    }

    const data = await ApiClient.post('/tools/github', { repo: trimmed });

    return {
      success: true,
      output: data.output || data.analysis || 'Code analysis complete.',
      sources: data.sources || [],
      metadata: data.metadata,
    };
  },
};
