import type { Character } from '../characters/catalog';
export const moves = {
  happy: {
    icon: '😊',
    label: 'Happy',
    phrase: 'I am happy!',
    ru: 'Я счастлив!',
    hint: 'Улыбнись вместе с другом',
  },
  wave: {
    icon: '👋',
    label: 'Wave',
    phrase: 'I am waving!',
    ru: 'Я машу лапкой!',
    hint: 'Помаши другу и повтори',
  },
  jump: {
    icon: '🦘',
    label: 'Jump',
    phrase: 'I am jumping!',
    ru: 'Я прыгаю!',
    hint: 'Покажи прыжок пальчиками',
  },
  run: {
    icon: '🏃',
    label: 'Run',
    phrase: 'I am running!',
    ru: 'Я бегаю!',
    hint: 'Пробеги двумя пальчиками',
  },
  sleep: {
    icon: '😴',
    label: 'Sleep',
    phrase: 'I am sleeping.',
    ru: 'Я сплю.',
    hint: 'Сложи ладошки под щёку',
  },
  sing: {
    icon: '🎵',
    label: 'Sing',
    phrase: 'I am singing! La, la, la!',
    ru: 'Я пою!',
    hint: 'Спой «ла-ла-ла» вместе с другом',
  },
  tired: {
    icon: '🥱',
    label: 'Tired',
    phrase: 'I am tired.',
    ru: 'Я устал.',
    hint: 'Покажи, как друг отдыхает',
  },
  hungry: {
    icon: '🍎',
    label: 'Hungry',
    phrase: 'I am hungry.',
    ru: 'Я голоден.',
    hint: 'Потрогай животик',
  },
  thirsty: {
    icon: '💧',
    label: 'Thirsty',
    phrase: 'I am thirsty.',
    ru: 'Я хочу пить.',
    hint: 'Покажи, как пьёшь из чашки',
  },
  sad: {
    icon: '💙',
    label: 'Sad',
    phrase: 'I am sad.',
    ru: 'Мне грустно.',
    hint: 'Обними друга, чтобы поддержать его',
  },
} as const;
export type LearningAction = keyof typeof moves;
export const learningActions = Object.keys(moves) as LearningAction[];
export const isLearningAction = (value: string): value is LearningAction =>
  Object.hasOwn(moves, value);
export const missionAction: Record<Character, LearningAction> = {
  cat: 'wave',
  dog: 'jump',
  foxy: 'run',
  lion: 'sing',
  bunny: 'jump',
  bear: 'sleep',
  panda: 'happy',
  elephant: 'thirsty',
};
export const discoveries: Record<Character, string> = {
  cat: 'Усы · whiskers. Лапки · paws.',
  foxy: 'Пушистый хвост · fluffy tail. Уши · ears.',
  dog: 'Уши · ears. Лапки · paws.',
  lion: 'Грива · mane. Лапки · paws.',
  bunny: 'Длинные уши · long ears. Прыгать · hop.',
  bear: 'Круглые уши · round ears. Лапки · paws.',
  panda: 'Чёрный и белый · black and white. Лапки · paws.',
  elephant: 'Большие уши · big ears. Хобот · trunk.',
};
