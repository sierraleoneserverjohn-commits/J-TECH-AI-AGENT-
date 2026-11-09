/**
 * Swappable BrainClient interface
 */

export interface BrainClient {
  id: string;
  name: string;
  description: string;
  send(
    command: string,
    singleTurnOverride?: {
      mode?: 'auto' | 'manual' | 'task' | 'presets';
      model?: string;
      preset?: 'eco' | 'balanced' | 'max';
    }
  ): Promise<void>;
  compare?: (text: string, modelA: string, modelB: string) => Promise<void>;
  abort?: () => void;
}
