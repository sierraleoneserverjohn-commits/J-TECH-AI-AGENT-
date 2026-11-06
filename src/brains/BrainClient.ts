/**
 * Swappable BrainClient interface
 */

export interface BrainClient {
  id: string;
  name: string;
  description: string;
  send(command: string): Promise<void>;
  abort?: () => void;
}
