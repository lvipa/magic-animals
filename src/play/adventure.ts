import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { characterIds, type Character } from '../characters/catalog';

export const worlds = {
  meadow: { icon: '🌼', label: 'Полянка', english: 'Meadow' },
  space: { icon: '🚀', label: 'Космос', english: 'Space' },
  forest: { icon: '🌳', label: 'Лес', english: 'Forest' },
  trampoline: { icon: '🎪', label: 'Батуты', english: 'Trampolines' },
} as const;
export type World = keyof typeof worlds;
export const isWorld = (value: unknown): value is World =>
  typeof value === 'string' && Object.hasOwn(worlds, value);
interface Adventure {
  world: World;
  found: Character[];
  missions: Character[];
  setWorld: (world: World) => void;
  collect: (id: Character) => void;
  finishMission: (id: Character) => void;
  restart: () => void;
}
const storage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Session still works. */
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* No persistent progress. */
    }
  },
};
const validFriends = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.filter((id): id is Character => characterIds.includes(id)))]
    : [];
export const useAdventure = create<Adventure>()(
  persist(
    (set) => ({
      world: 'meadow',
      found: [],
      missions: [],
      setWorld: (world) => set({ world }),
      collect: (id) => set((s) => ({ found: [...new Set([...s.found, id])] })),
      finishMission: (id) =>
        set((s) => ({
          missions: s.found.includes(id) ? [...new Set([...s.missions, id])] : s.missions,
        })),
      restart: () => set({ found: [], missions: [] }),
    }),
    {
      name: 'magic-adventure',
      storage: createJSONStorage(() => storage),
      partialize: ({ world, found, missions }) => ({ world, found, missions }),
      merge: (saved, current) => {
        const data = saved as Partial<Adventure> | undefined;
        const found = validFriends(data?.found);
        return {
          ...current,
          world: isWorld(data?.world) ? data.world : 'meadow',
          found,
          missions: validFriends(data?.missions).filter((id) => found.includes(id)),
        };
      },
    },
  ),
);
