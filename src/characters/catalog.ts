export const characterIds = [
  'foxy',
  'cat',
  'dog',
  'lion',
  'bunny',
  'bear',
  'panda',
  'elephant',
] as const;
export type Character = (typeof characterIds)[number];
export const characterDetails: Record<
  Character,
  { name: string; word: string; icon: string; color: string }
> = {
  foxy: { name: 'Foxy', word: 'FOX', icon: '🦊', color: '#efa77b' },
  cat: { name: 'Milo', word: 'CAT', icon: '🐱', color: '#b897cc' },
  dog: { name: 'Bubbles', word: 'DOG', icon: '🐶', color: '#9ccad5' },
  lion: { name: 'Sunny', word: 'LION', icon: '🦁', color: '#efce87' },
  bunny: { name: 'Poppy', word: 'RABBIT', icon: '🐰', color: '#edc4ce' },
  bear: { name: 'Maple', word: 'BEAR', icon: '🐻', color: '#bd936f' },
  panda: { name: 'Pebble', word: 'PANDA', icon: '🐼', color: '#ced7cd' },
  elephant: { name: 'Ellie', word: 'ELEPHANT', icon: '🐘', color: '#a5b9d5' },
};
