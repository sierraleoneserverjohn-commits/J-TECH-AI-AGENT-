import { Tool, ToolResult, ToolExecutionContext } from '../types';

export const DocumentIntelligenceTool: Tool = {
  id: 'document_intelligence',
  name: 'Document Intelligence',
  description: 'Analyze PDF, Word, Markdown, or text documents and answer queries using Gemini',
  status: 'ready',
  category: 'document',
  run: async (input: string, context?: ToolExecutionContext): Promise<ToolResult> => {
    const trimmed = input.trim();
    const backendUrl =
      localStorage.getItem('jexa_backend_url') ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const accessToken = localStorage.getItem('jexa_access_token') || '';

    let documentContent = '';
    let fileName = 'Uploaded document';

    if (context?.files && context.files.length > 0) {
      const file = context.files[0];
      fileName = file.name;
      documentContent = await file.text();
    } else if (trimmed.includes('--- DOCUMENT ---')) {
      const parts = trimmed.split('--- DOCUMENT ---');
      documentContent = parts[1].trim();
    }

    if (!documentContent && !trimmed) {
      return {
        success: false,
        output: 'Please select a document or paste document text to analyze.',
      };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res = await fetch(`${backendUrl}/api/tools/document`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: trimmed || 'Summarize and extract key insights from this document.',
        content: documentContent.slice(0, 50000),
        fileName,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Document analysis failed (${res.status})`);
    }

    const data = await res.json();
    return {
      success: true,
      output: `### Document Analysis: ${fileName}\n\n${data.analysis || data.reply}`,
      metadata: { fileName, length: documentContent.length },
    };
  },
};
