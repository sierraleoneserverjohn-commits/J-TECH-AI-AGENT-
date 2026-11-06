import { Tool, ToolResult } from './types.js';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

export const visionDescribeTool: Tool = {
  name: 'vision_describe',
  description: 'Analyzes images, diagrams, photos, or screenshots using Gemini multimodal intelligence',
  inputSchema: {
    type: 'object',
    properties: {
      image: { type: 'string', description: 'Base64 image data or data URL', required: true },
      prompt: { type: 'string', description: 'Question or inspection request for the image' },
    },
  },
  status: 'ready',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    let image = '';
    let prompt = 'Analyze this image and describe what you observe concisely.';

    if (typeof input === 'string') {
      image = input;
    } else {
      image = input.image || '';
      prompt = input.prompt || prompt;
    }

    if (!image) {
      return { success: false, output: 'No image data provided for visual analysis.', error: 'Missing image' };
    }

    if (!config.geminiApiKey) {
      return {
        success: false,
        output: 'Gemini multimodal vision is not configured on the backend. Provide GEMINI_API_KEY in environment variables.',
        error: 'Not configured',
      };
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: config.geminiApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      let mimeType = 'image/jpeg';
      let cleanBase64 = image;

      const match = image.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      }

      const response = await ai.models.generateContent({
        model: config.geminiModel || 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: cleanBase64, mimeType } },
              { text: prompt },
            ],
          },
        ],
      });

      const analysis = response.text || 'Image analyzed successfully.';
      return {
        success: true,
        output: analysis,
        metadata: { model: config.geminiModel, mimeType },
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Vision analysis failed: ${err.message}`,
        error: err.message,
      };
    }
  },
};
