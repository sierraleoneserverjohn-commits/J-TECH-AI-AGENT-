import { BrainClient } from './BrainClient';
import { GeminiBrain } from './GeminiBrain';
import { RemoteBrain } from './RemoteBrain';

export const geminiBrain = new GeminiBrain();
export const remoteBrain = new RemoteBrain();

export const BRAIN_CLIENTS: Record<string, BrainClient> = {
  gemini: geminiBrain,
  remote: remoteBrain,
};

let activeBrainId: string = localStorage.getItem('jexa_active_brain') || 'gemini';

export function getActiveBrain(): BrainClient {
  return BRAIN_CLIENTS[activeBrainId] || geminiBrain;
}

export function setActiveBrain(id: string): BrainClient {
  if (BRAIN_CLIENTS[id]) {
    activeBrainId = id;
    localStorage.setItem('jexa_active_brain', id);
  }
  return getActiveBrain();
}

export function getActiveBrainId(): string {
  return activeBrainId;
}
