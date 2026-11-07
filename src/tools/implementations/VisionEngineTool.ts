import { Tool, ToolResult, ToolExecutionContext } from '../types';
import { ApiClient } from '../../api/client';

export const VisionEngineTool: Tool = {
  id: 'vision_engine',
  name: 'Vision Engine',
  description: 'Analyze uploaded images, camera snapshots, or screen captures using Gemini multimodal vision',
  status: 'ready',
  category: 'vision',
  run: async (input: string, context?: ToolExecutionContext): Promise<ToolResult> => {
    const prompt = input.trim() || 'Analyze this image and describe key visual elements in detail.';
    let base64Image = context?.imageDataUrl || '';

    // If a file was passed in context
    if (!base64Image && context?.files && context.files.length > 0) {
      const file = context.files[0];
      base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    if (!base64Image) {
      return {
        success: false,
        output: 'No image provided. Please select an image, take a camera snapshot, or capture your screen.',
      };
    }

    const data = await ApiClient.post('/tools/vision', {
      prompt,
      image: base64Image,
    });

    return {
      success: true,
      output: `### Visual Analysis\n\n${data.output || data.analysis || data.reply || 'Analysis completed.'}`,
      metadata: { prompt, hasImage: true },
    };
  },
};
