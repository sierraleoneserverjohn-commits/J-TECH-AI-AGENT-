import { Tool, ToolResult } from './types.js';

export const androidActionTool: Tool = {
  name: 'android_action',
  description: 'Triggers native Android OS intents, notifications, and hardware sensors via JEXA companion app',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'Android action type, e.g. "open_app", "send_sms", "set_alarm"' },
      payload: { type: 'string', description: 'Arguments for the native intent' },
    },
  },
  status: 'needs_android_app',
  run: async (input: string | Record<string, any>): Promise<ToolResult> => {
    const action = typeof input === 'string' ? input : (input.action || 'hardware_intent');
    return {
      success: false,
      output: 'needs_android_app',
      error: `Action "${action}" requires the JEXA native Android companion app.`,
      metadata: { status: 'needs_android_app', action },
    };
  },
};
