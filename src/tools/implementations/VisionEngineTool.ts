import { Tool, ToolResult, ToolExecutionContext } from '../types';

export const VisionEngineTool: Tool = {
  id: 'vision_engine',
  name: 'Vision Engine',
  description: 'Analyze uploaded images, camera snapshots, or screen captures using Gemini multimodal vision',
  status: 'ready',
  category: 'vision',
  run: async (input: string, context?: ToolExecutionContext): Promise<ToolResult> => {
    const prompt = input.trim() || 'Analyze this image and describe key visual elements in detail.';
    const backendUrl =
      localStorage.getItem('jexa_backend_url') ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const accessToken = localStorage.getItem('jexa_access_token') || '';

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

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res = await fetch(`${backendUrl}/api/tools/vision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt,
        image: base64Image,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Vision analysis failed (${res.status})`);
    }

    const data = await res.json();
    return {
      success: true,
      output: `### Visual Analysis\n\n${data.analysis || data.reply}`,
      metadata: { prompt, hasImage: true },
    };
  },
};
