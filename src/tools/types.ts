/**
 * Modular Tool Interface for JEXA AI Command Centre
 */

export type ToolStatus =
  | 'planned'
  | 'ready'
  | 'active'
  | 'error'
  | 'needs_android_app';

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

export interface ToolExecutionContext {
  emitProgress?: (progress: number, detail: string) => void;
  signal?: AbortSignal;
  files?: File[];
  imageDataUrl?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  status: ToolStatus;
  category?: 'search' | 'code' | 'memory' | 'automation' | 'vision' | 'document' | 'system' | 'android';
  run: (input: string, context?: ToolExecutionContext) => Promise<ToolResult>;
}
