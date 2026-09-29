export type TVEvent =
  | 'GAME_STARTED'
  | 'ANIMAL_FOUND'
  | 'ANIMAL_RELEASED'
  | 'CELEBRATION'
  | 'SCENE_CHANGE'
  | 'FINALE'
  | 'SCENE_SYNC'
  | 'FRIEND_SCENE'
  | 'AUDIO_CUE'
  | 'AUDIO_ROUTE'
  | 'CONNECTION_CHANGED'
  | 'TRANSFER_CANCELLED';
import type { AnimalId } from '../config/animals';
import type { TransferPlan } from './protocol';
export interface TVBridge {
  connect(): Promise<void>;
  disconnect(): void;
  sendEvent(event: TVEvent, payload?: unknown): void;
  onEvent(handler: (event: TVEvent, payload?: unknown) => void): () => void;
  isReady?(): boolean;
  serverTime?(): number;
  requestTransfer?(id: AnimalId): Promise<TransferPlan | null>;
  cancelTransfer?(transferId: string): void;
}
export class NoopTVBridge implements TVBridge {
  async connect() {}
  disconnect() {}
  sendEvent(_event: TVEvent, _payload?: unknown) {}
  onEvent(_handler: (event: TVEvent, payload?: unknown) => void) {
    return () => {};
  }
}
