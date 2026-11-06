import { Tool, ToolResult, ToolExecutionContext } from './types';
import { eventBus } from '../events/eventBus';

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private listeners = new Set<() => void>();

  public register(tool: Tool): void {
    this.tools.set(tool.id, tool);
    this.notify();
  }

  public unregister(id: string): void {
    if (this.tools.delete(id)) {
      this.notify();
    }
  }

  public get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  public getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Error in ToolRegistry subscriber:', e);
      }
    });
  }

  public async executeTool(
    id: string,
    input: string,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    let tool = this.tools.get(id);
    if (!tool && (id === 'search' || id === 'web_search')) {
      tool = this.tools.get('web_search') || this.tools.get('search');
    }
    if (!tool) {
      throw new Error(`Tool "${id}" is not registered.`);
    }

    if (tool.status === 'needs_android_app') {
      const msg = `${tool.name} requires the JEXA native Android companion app.`;
      eventBus.emit('action', {
        id: `action-${Date.now()}`,
        title: tool.name,
        description: msg,
        needsAndroidApp: true,
        status: 'pending',
      });
      eventBus.emit('log', { text: msg, level: 'warn' });
      return { success: false, output: msg, error: msg };
    }

    const prevStatus = tool.status;
    tool.status = 'active';
    this.notify();

    // Emit event bus start events
    eventBus.emit('tool', {
      name: tool.name,
      status: 'calling',
      detail: `Running tool [${tool.name}]...`,
    });
    eventBus.emit('activity', {
      id: `tool-${tool.id}`,
      label: `Tool: ${tool.name}`,
      active: true,
    });
    eventBus.emit('state', {
      state: 'running_tools',
      detail: `Executing ${tool.name}: "${input.slice(0, 36)}..."`,
    });
    eventBus.emit('log', {
      text: `[Tool] ${tool.name} invoked with: "${input.slice(0, 50)}${input.length > 50 ? '...' : ''}"`,
      level: 'info',
    });

    try {
      const result = await tool.run(input, context);

      tool.status = prevStatus === 'active' ? 'ready' : prevStatus;
      this.notify();

      if (result.success) {
        eventBus.emit('tool', { name: tool.name, status: 'success' });
        eventBus.emit('activity', {
          id: `tool-${tool.id}`,
          label: `Tool: ${tool.name}`,
          active: false,
        });
        eventBus.emit('log', {
          text: `[Tool: ${tool.name}] Finished: ${result.output.slice(0, 80)}...`,
          level: 'success',
        });
        eventBus.emit('state', {
          state: 'completed',
          detail: `${tool.name} completed successfully`,
        });

        // Also add assistant message to conversation so user sees the output
        let messageText = result.output;
        if (result.sources && result.sources.length > 0) {
          messageText += `\n\nSources:\n` + result.sources.map((s) => `• [${s.title}](${s.url})`).join('\n');
        }
        eventBus.emit('message', {
          role: 'assistant',
          text: messageText,
          timestamp: Date.now(),
        });
      } else {
        throw new Error(result.error || 'Tool execution unsuccessful');
      }

      setTimeout(() => eventBus.emit('state', { state: 'idle' }), 1200);
      return result;
    } catch (err: any) {
      tool.status = 'error';
      this.notify();

      const errMsg = err?.message || 'Tool execution failed';
      eventBus.emit('tool', { name: tool.name, status: 'failed', detail: errMsg });
      eventBus.emit('activity', {
        id: `tool-${tool.id}`,
        label: `Tool: ${tool.name}`,
        active: false,
      });
      eventBus.emit('log', {
        text: `[Tool: ${tool.name}] Error: ${errMsg}`,
        level: 'error',
      });
      eventBus.emit('state', {
        state: 'error',
        message: errMsg,
        detail: `Error in ${tool.name}`,
      });

      eventBus.emit('message', {
        role: 'system',
        text: `Tool [${tool.name}] error: ${errMsg}`,
        timestamp: Date.now(),
      });

      setTimeout(() => eventBus.emit('state', { state: 'idle' }), 2000);

      // Reset back to ready after short interval so user can retry
      setTimeout(() => {
        if (tool.status === 'error') {
          tool.status = 'ready';
          this.notify();
        }
      }, 5000);

      return {
        success: false,
        output: errMsg,
        error: errMsg,
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
