import type { AnimalId } from '../config/animals';
import type { SceneState } from '../game/GameEngine';
import type { GameState } from '../game/machine';

export interface TVSnapshot {
  state: GameState;
  scene: SceneState;
  paused: boolean;
  released: AnimalId[];
  sequence: number;
}
export interface TransferPlan {
  transferId: string;
  id: AnimalId;
  revealAt: number;
}
export interface TVConnection {
  state: 'off' | 'connecting' | 'waiting' | 'ready' | 'reconnecting' | 'error';
  code: string;
  message: string;
  tvReady: boolean;
  controllerPresent: boolean;
  tvSoundReady: boolean;
  audioTarget: 'ipad' | 'tv';
}
export const emptyConnection: TVConnection = {
  state: 'off',
  code: '',
  message: '',
  tvReady: false,
  controllerPresent: false,
  tvSoundReady: false,
  audioTarget: 'ipad',
};
export const tvActions = [
  'idle',
  'lookAround',
  'point',
  'happy',
  'surprised',
  'scared',
  'laugh',
  'dance',
  'fall',
  'jump',
  'play',
  'spin',
  'chase tail',
  'run',
  'sit',
  'sleep',
  'roll',
  'wave',
  'roar',
  'woof',
  'meow',
  'sing',
  'tired',
  'hungry',
  'thirsty',
  'sad',
];
