import { Tool, ToolResult } from './types.js';

export const documentReaderTool: Tool = {
  name: 'document_reader',
  description: 'Parses and extracts key sections from uploaded text, markdown, or JSON documents',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Raw document text content', required: true },
      filename: { type: 'string', description: 'Original document name' },
      query: { type: 'string', description: 'Specific question or filter to apply' },
    },
  },
  status: 'ready',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    let content = '';
    let filename = 'document.txt';
    let query = '';

    if (typeof input === 'string') {
      content = input;
    } else {
      content = input.content || '';
      filename = input.filename || 'document.txt';
      query = input.query || '';
    }

    if (!content.trim()) {
      return { success: false, output: 'Empty document content received.', error: 'Empty content' };
    }

    // Token-efficient extraction: clean whitespace and summarize structure
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const charCount = content.length;
    const wordCount = content.split(/\s+/).length;

    let summaryText = `Document "${filename}" (${wordCount} words, ${charCount} chars):\n`;

    if (query) {
      // Find matching paragraphs or lines
      const matching = lines.filter((l) => l.toLowerCase().includes(query.toLowerCase()));
      if (matching.length > 0) {
        summaryText += `Key excerpts matching "${query}":\n` + matching.slice(0, 4).map((m) => `> ${m}`).join('\n');
      } else {
        summaryText += `No direct matches for "${query}". Excerpt:\n` + lines.slice(0, 4).join('\n');
      }
    } else {
      summaryText += `Overview:\n` + lines.slice(0, 5).join('\n');
    }

    return {
      success: true,
      output: summaryText.slice(0, 1200),
      metadata: { filename, charCount, wordCount },
    };
  },
};
