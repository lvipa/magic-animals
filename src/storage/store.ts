import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { animals } from '../config/animals';
import { transition, type GameEvent, type GameState } from '../game/machine';
import type { AnimalId } from '../config/animals';
export type Quality = 'AUTO' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Mode = 'AR_MODE' | 'CAMERA_MODE' | '3D_MODE';
interface Store {
  state: GameState;
  completed: boolean;
  available: AnimalId[];
  quality: Quality;
  volume: number;
  mode: Mode;
  debug: boolean;
  parent: boolean;
  forcedAnimal: AnimalId | null;
  send: (event: GameEvent) => void;
  setMode: (mode: Mode) => void;
  setQuality: (quality: Quality) => void;
  setVolume: (volume: number) => void;
  setParent: (parent: boolean) => void;
  setDebug: (debug: boolean) => void;
  forceAnimal: (id: AnimalId | null) => void;
}
const safeStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* private browsing or full storage: keep this session playable */
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* no persistent data to remove */
    }
  },
};
export const useGame = create<Store>()(
  persist(
    (set) => ({
      state: 'WELCOME',
      completed: false,
      available: [],
      quality: 'AUTO',
      volume: 0.8,
      mode: 'AR_MODE',
      debug: false,
      parent: false,
      forcedAnimal: null,
      send: (event) =>
        set((s) => {
          const next = transition(s.state, event);
          const found =
            event.type === 'TARGET_FOUND' && (next.endsWith('_FOUND') || s.state === 'FREE_PLAY');
          return {
            state: next,
            completed: s.completed || next === 'COMPLETE',
            available:
              found && !s.available.includes(event.id) ? [...s.available, event.id] : s.available,
            ...(event.type === 'RESET' ? { completed: false, available: [] } : {}),
          };
        }),
      setMode: (mode) => set({ mode }),
      setQuality: (quality) => set({ quality }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setParent: (parent) => set({ parent }),
      setDebug: (debug) => set({ debug }),
      forceAnimal: (id) => set({ forcedAnimal: id }),
    }),
    {
      name: 'magic-animals',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        completed: s.completed,
        available: s.available,
        quality: s.quality,
        volume: s.volume,
      }),
      merge: (saved, current) => {
        const data = saved as Partial<Store> | undefined;
        return {
          ...current,
          completed: data?.completed === true,
          available: Array.isArray(data?.available)
            ? data.available.filter((id) => animals.some((a) => a.id === id))
            : [],
          quality:
            data?.quality && ['AUTO', 'HIGH', 'MEDIUM', 'LOW'].includes(data.quality)
              ? data.quality
              : 'AUTO',
          volume:
            typeof data?.volume === 'number' && Number.isFinite(data.volume)
              ? Math.max(0, Math.min(1, data.volume))
              : 0.8,
        };
      },
    },
  ),
);
