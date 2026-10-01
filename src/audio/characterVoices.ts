import type { Character } from '../characters/catalog';
import { isLearningAction } from '../play/lessons';
export { learningActions } from '../play/lessons';
export function characterActionCue(id: Character, action: string) {
  if (isLearningAction(action)) return `character-${id}-learn-${action}`;
  const mood = ['idle', 'happy', 'wave', 'jump', 'run', 'sleep', 'roar'].includes(action)
    ? action
    : ['meow', 'woof'].includes(action)
      ? 'roar'
      : 'happy';
  return `character-${id}-${mood}`;
}
