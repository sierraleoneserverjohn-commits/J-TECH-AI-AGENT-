export interface ToolSource {
  title: string;
  url: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  sources?: ToolSource[];
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolContext {
  userId?: string;
  taskId?: string;
  confirmed?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'string' | 'object';
    properties?: Record<string, { type: string; description: string; required?: boolean }>;
    description?: string;
  };
  status: 'ready' | 'active' | 'needs_android_app' | 'not_configured' | 'error';
  run: (input: string | Record<string, any>, context?: ToolContext) => Promise<ToolResult>;
}
