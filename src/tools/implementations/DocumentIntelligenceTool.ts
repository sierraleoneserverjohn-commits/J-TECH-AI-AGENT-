import { Tool, ToolResult, ToolExecutionContext } from '../types';
import { ApiClient } from '../../api/client';

export const DocumentIntelligenceTool: Tool = {
  id: 'document_intelligence',
  name: 'Document Intelligence',
  description: 'Analyze PDF, Word, Markdown, or text documents and answer queries using Gemini',
  status: 'ready',
  category: 'document',
  run: async (input: string, context?: ToolExecutionContext): Promise<ToolResult> => {
    const trimmed = input.trim();
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

    const data = await ApiClient.post('/tools/document', {
      query: trimmed || 'Summarize and extract key insights from this document.',
      content: documentContent.slice(0, 50000),
      filename: fileName,
    });

    return {
      success: true,
      output: `### Document Analysis: ${fileName}\n\n${data.output || data.analysis || data.reply || 'Analysis completed.'}`,
      metadata: { fileName, length: documentContent.length },
    };
  },
};
