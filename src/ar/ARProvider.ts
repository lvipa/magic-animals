import type * as THREE from 'three';
import type { AnimalId } from '../config/animals';
export interface TrackingInfo {
  target: AnimalId | null;
  visible: boolean;
  confidence?: number;
}
export interface ARProvider {
  initialize(container: HTMLElement, markerTest?: boolean): Promise<void>;
  registerTargets(ids: AnimalId[]): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  onTargetFound(handler: (id: AnimalId) => void): () => void;
  onTargetLost(handler: (id: AnimalId) => void): () => void;
  setAppearance(id: AnimalId, progress: number): void;
  setQuality(pixelRatio: number): void;
  setAction?(id: AnimalId, action: string): void;
  setFocus?(id: AnimalId | null): void;
  getTracking(): TrackingInfo;
  getScene?(): THREE.Scene | undefined;
}
