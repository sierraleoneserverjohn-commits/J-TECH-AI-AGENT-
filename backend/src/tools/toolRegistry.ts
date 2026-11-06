import { Tool, ToolResult, ToolContext } from './types.js';
import { calculatorTool } from './calculator.js';
import { datetimeTool } from './datetime.js';
import { webSearchTool } from './webSearch.js';
import { githubReadTool } from './githubRead.js';
import { memorySaveTool } from './memorySave.js';
import { memorySearchTool } from './memorySearch.js';
import { documentReaderTool } from './documentReader.js';
import { visionDescribeTool } from './visionDescribe.js';
import { androidActionTool } from './androidAction.js';
import { sseManager } from '../events/sseManager.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  constructor() {
    this.register(calculatorTool);
    this.register(datetimeTool);
    this.register(webSearchTool);
    this.register(githubReadTool);
    this.register(memorySaveTool);
    this.register(memorySearchTool);
    this.register(documentReaderTool);
    this.register(visionDescribeTool);
    this.register(androidActionTool);
  }

  public register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  public get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  public getSchemas(names?: string[]): Array<{ name: string; description: string; inputSchema: any }> {
    const list = names ? names.map((n) => this.tools.get(n)).filter(Boolean) as Tool[] : this.getAll();
    return list.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  public async execute(name: string, input: any, context?: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: `Tool "${name}" is not registered.`,
        error: 'ToolNotFound',
      };
    }

    if (tool.status === 'needs_android_app') {
      sseManager.emit('tool', { name: tool.name, status: 'needs_android_app' });
      return {
        success: false,
        output: 'needs_android_app',
        error: `${tool.name} requires the JEXA native Android companion app.`,
      };
    }

    sseManager.emit('tool', { name: tool.name, status: 'running', input });
    const startTime = Date.now();

    try {
      const result = await tool.run(input, context);
      const latencyMs = Date.now() - startTime;

      sseManager.emit('tool', {
        name: tool.name,
        status: result.success ? 'done' : 'error',
        latencyMs,
      });

      return result;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      sseManager.emit('tool', {
        name: tool.name,
        status: 'error',
        error: err.message,
        latencyMs,
      });

      return {
        success: false,
        output: `Tool execution failed: ${err.message}`,
        error: err.message,
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
