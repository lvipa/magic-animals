import { characterDetails, type Character } from '../characters/catalog';
import { markerBase } from './arCards';
import { characterModelUrl } from '../characters/assetUrls';
export type AnimalId = Character;
export type FoxyMood =
  'idle' | 'lookAround' | 'point' | 'happy' | 'surprised' | 'scared' | 'laugh' | 'dance' | 'fall';
export interface AppearanceBeat {
  at: number;
  reveal?: number;
  cue?: string;
  foxy?: FoxyMood;
  effects?: boolean;
  action?: string;
}
export interface AnimalConfig {
  id: AnimalId;
  word: string;
  article: string;
  targetIndex: number;
  image: string;
  thumbnail: string;
  model: string;
  color: string;
  call: string;
  sounds: { word: string; article: string; call: string };
  animations: string[];
  appearanceSequence: AppearanceBeat[];
  appearanceDuration: number;
  playAction?: string;
  playSequence?: AppearanceBeat[];
  interactions: string[];
}
export const animals: AnimalConfig[] = [
  {
    id: 'cat',
    word: 'CAT',
    article: 'A cat!',
    targetIndex: 0,
    image: `${markerBase}/cat.png`,
    thumbnail: `${markerBase}/cat.png`,
    model: characterModelUrl('cat'),
    color: '#f8b460',
    call: 'Meow!',
    sounds: { word: 'cat', article: 'a-cat', call: 'meow' },
    animations: ['idle', 'jump', 'wave', 'spin', 'sit'],
    appearanceDuration: 4100,
    appearanceSequence: [
      { at: 200, reveal: 0.02 },
      { at: 400, effects: true },
      { at: 700, cue: 'meow', foxy: 'point' },
      { at: 1000, reveal: 0.25 },
      { at: 1300, reveal: 0.6 },
      { at: 1600, reveal: 1, foxy: 'happy' },
      { at: 1700, cue: 'cat' },
      { at: 2600, cue: 'a-cat' },
      { at: 3500, cue: 'meow' },
    ],
    interactions: ['jump', 'meow', 'wave', 'spin', 'sit', 'sleep'],
  },
  {
    id: 'dog',
    word: 'DOG',
    article: 'A dog!',
    targetIndex: 1,
    image: `${markerBase}/dog.png`,
    thumbnail: `${markerBase}/dog.png`,
    model: characterModelUrl('dog'),
    color: '#89c9dc',
    call: 'Woof!',
    sounds: { word: 'dog', article: 'a-dog', call: 'woof' },
    animations: ['idle', 'run', 'sit', 'wave'],
    appearanceDuration: 4100,
    appearanceSequence: [
      { at: 100, cue: 'woof', foxy: 'surprised' },
      { at: 400, reveal: 0.2, effects: true },
      { at: 1000, reveal: 0.6 },
      { at: 1600, reveal: 1, foxy: 'happy' },
      { at: 1700, cue: 'dog' },
      { at: 2600, cue: 'a-dog' },
      { at: 3500, cue: 'woof' },
    ],
    playAction: 'run',
    playSequence: [
      { at: 1200, foxy: 'lookAround' },
      { at: 2300, foxy: 'fall' },
      { at: 3600, action: 'sit', foxy: 'laugh' },
    ],
    interactions: ['run', 'sit', 'woof', 'spin', 'wave'],
  },
  {
    id: 'lion',
    word: 'LION',
    article: 'A lion!',
    targetIndex: 2,
    image: `${markerBase}/lion.png`,
    thumbnail: `${markerBase}/lion.png`,
    model: characterModelUrl('lion'),
    color: '#f5cf61',
    call: 'Tiny roar!',
    sounds: { word: 'lion', article: 'a-lion', call: 'roar' },
    animations: ['idle', 'roar', 'roll', 'sleep', 'play'],
    appearanceDuration: 4800,
    appearanceSequence: [
      { at: 500, cue: 'roar', foxy: 'scared' },
      { at: 800, reveal: 0.02, effects: true },
      { at: 1200, reveal: 0.25 },
      { at: 1500, reveal: 0.6 },
      { at: 1800, reveal: 1, foxy: 'lookAround' },
      { at: 1900, cue: 'lion' },
      { at: 2800, cue: 'a-lion' },
      { at: 3700, cue: 'roar', foxy: 'laugh' },
    ],
    interactions: ['roar', 'roll', 'sleep', 'jump', 'wave'],
  },
  ...(['foxy', 'bunny', 'bear', 'panda', 'elephant'] as const).map((id, index): AnimalConfig => {
    const details = characterDetails[id];
    const word = details.word.toLowerCase();
    return {
      id,
      word: details.word,
      article: `A ${word}!`,
      targetIndex: index + 3,
      image: `${markerBase}/${id}.png`,
      thumbnail: `${markerBase}/${id}.png`,
      model: characterModelUrl(id),
      color: details.color,
      call: 'Hello!',
      sounds: { word, article: `character-${id}-idle`, call: `character-${id}-roar` },
      animations: ['idle', 'happy', 'wave', 'jump', 'run', 'sleep', 'roar'],
      appearanceDuration: 2800,
      appearanceSequence: [
        { at: 400, reveal: 0.25 },
        { at: 800, reveal: 0.6 },
        { at: 1200, reveal: 1 },
        { at: 1400, cue: word },
      ],
      interactions: ['happy', 'wave', 'jump', 'run', 'sleep', 'roar'],
    };
  }),
];
// The narrated adventure keeps its three chapters; all eight cards are
// immediately available in Scan any card / Free Play.
export const storyAnimals = animals.filter((a) => ['cat', 'dog', 'lion'].includes(a.id));
export const animalById = Object.fromEntries(animals.map((a) => [a.id, a])) as Record<
  AnimalId,
  AnimalConfig
>;
