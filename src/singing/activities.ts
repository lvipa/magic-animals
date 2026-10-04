import type { SongDefinition } from './song';
export const farmFriends = [
  { icon: '🐮', word: 'cow', label: 'Корова', sound: 'Moo!', at: 3 },
  { icon: '🐴', word: 'horse', label: 'Лошадка', sound: 'Neigh!', at: 35 },
  { icon: '🐷', word: 'pig', label: 'Поросёнок', sound: 'Oink!', at: 67 },
  { icon: '🐑', word: 'sheep', label: 'Овечка', sound: 'Baa!', at: 99 },
  { icon: '🦆', word: 'duck', label: 'Уточка', sound: 'Quack!', at: 131 },
  { icon: '🐓', word: 'rooster', label: 'Петушок', sound: 'Cock-a-doodle-doo!', at: 163 },
];
export const busControls = [
  { icon: '🛞', word: 'round and round', label: 'Колёса', action: 'dance' },
  { icon: '🚪', word: 'open and shut', label: 'Двери', action: 'wave' },
  { icon: '🌧️', word: 'swish swish swish', label: 'Дворники', action: 'wave' },
  { icon: '📯', word: 'beep beep beep', label: 'Сигнал', action: 'happy' },
  { icon: '↕️', word: 'up and down', label: 'Прыгаем', action: 'jump' },
  { icon: '👶', word: 'wah wah wah', label: 'Малыши', action: 'sad' },
  { icon: '🤫', word: 'shh shh shh', label: 'Тихонько', action: 'tired' },
];
export const danceMoves = [
  { icon: '👏', word: 'clap your hands', label: 'Хлопай', action: 'music-clap' },
  { icon: '🦶', word: 'stomp your feet', label: 'Топай', action: 'run' },
  { icon: '🙌', word: 'shout hooray', label: 'Ура!', action: 'happy' },
  { icon: '💃', word: 'dance', label: 'Танцуй', action: 'dance' },
];
export const bodyParts = [
  { icon: '🙂', word: 'head', label: 'Голова', action: 'music-head' },
  { icon: '🙆', word: 'shoulders', label: 'Плечи', action: 'music-shoulders' },
  { icon: '🦵', word: 'knees', label: 'Колени', action: 'music-knees' },
  { icon: '🦶', word: 'toes', label: 'Пальчики', action: 'music-toes' },
  { icon: '👀', word: 'eyes', label: 'Глазки', action: 'music-eyes' },
  { icon: '👂', word: 'ears', label: 'Ушки', action: 'music-ears' },
  { icon: '👄', word: 'mouth', label: 'Рот', action: 'music-mouth' },
  { icon: '👃', word: 'nose', label: 'Нос', action: 'music-nose' },
];
export const spiderWeather = [
  { icon: '🕷️', word: 'up the spout', label: 'Паучок', action: 'wave' },
  { icon: '🌧️', word: 'rain', label: 'Дождик', action: 'sad' },
  { icon: '☀️', word: 'sun', label: 'Солнышко', action: 'happy' },
  { icon: '🕷️', word: 'up again', label: 'Снова вверх', action: 'jump' },
];
export const activityOptions = (song: SongDefinition) =>
  song.activity === 'farm'
    ? farmFriends
    : song.activity === 'bus'
      ? busControls
      : song.activity === 'moves'
        ? danceMoves
        : song.activity === 'body'
          ? bodyParts
          : song.activity === 'spider'
            ? spiderWeather
            : [];
export function musicAction(song: SongDefinition, choice: number, performing: boolean) {
  if (!performing) return 'idle';
  const option = activityOptions(song)[choice];
  return option && 'action' in option ? option.action : 'sing';
}
/** Approximate play-along cues; the official recording remains the musical clock. */
export function automaticActivityChoice(song: SongDefinition, time: number, fallback: number) {
  if (song.activity === 'body') {
    const sequence = [0, 1, 2, 3, 2, 3, 0, 1, 2, 3, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 2, 3];
    return sequence[Math.floor(Math.max(0, time - 3)) % sequence.length];
  }
  if (song.activity === 'spider') return Math.floor(Math.max(0, time - 3) / 6) % 4;
  return Math.min(fallback, Math.max(0, activityOptions(song).length - 1));
}
