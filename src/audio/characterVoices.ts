import type { Character } from '../characters/catalog';
export const learningActions = ['happy', 'wave', 'jump', 'run', 'sleep'] as const;
export function characterActionCue(id: Character, action: string) {
  const mood = ['idle','happy','wave','jump','run','sleep','roar'].includes(action)
    ? action : ['meow','woof'].includes(action) ? 'roar' : 'happy';
  return `character-${id}-${mood}`;
}
