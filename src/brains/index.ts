import { BrainClient } from './BrainClient';
import { ServerBrain } from './ServerBrain';

export const serverBrain = new ServerBrain();

export const BRAIN_CLIENTS: Record<string, BrainClient> = {
  server: serverBrain,
};

let activeBrainId: string = 'server';

export function getActiveBrain(): BrainClient {
  return serverBrain;
}

export function setActiveBrain(_id: string): BrainClient {
  return serverBrain;
}

export function getActiveBrainId(): string {
  return 'server';
}
