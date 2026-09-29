import { create } from 'zustand';
import type { AnimalId } from '../config/animals';
export interface Runtime {
  camera: 'OFF' | 'REQUESTING' | 'READY' | 'ERROR';
  ar: 'OFF' | 'LOADING' | 'READY' | 'ERROR';
  target: AnimalId | null;
  visible: boolean;
  fps: number;
  trackingFPS: number;
  error: string;
  resolution: string;
  update: (patch: Partial<Omit<Runtime, 'update'>>) => void;
}
export const useRuntime = create<Runtime>((set) => ({
  camera: 'OFF',
  ar: 'OFF',
  target: null,
  visible: false,
  fps: 0,
  trackingFPS: 0,
  error: '',
  resolution: '—',
  update: (patch) => set(patch),
}));
