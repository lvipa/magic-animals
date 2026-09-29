# Ассеты для профессионального релиза

## Сейчас в проекте

- Оригинальные игрушечные Three.js Foxy, CAT, DOG, baby LION: округлые силуэты, простые добрые лица, маленькие глаза и закрытые улыбающиеся глазки, матовые пастельные цвета. Сиреневый котёнок сидит с передними лапками на полу. Грива цельная, хвосты плавные с закруглёнными концами. Галерея `/characters` доступна через Parent Mode.
- Четыре настоящих GLB в `public/models/` с 7 transform-анимациями: idle, happy, wave, jump, run, sleep, roar. Каждый примерно 1.3–1.6 MiB, 22–30 тысяч треугольников. Экспорт: `npm run models`, проверка: `npm run test:models`. Каталог размеров — `public/models/catalog.json`.
- Original SVG/PNG иллюстрации, уникальные узоры, printable A4 и иконки, созданные `scripts/generate-cards.mjs`.
- 13 нейронных английских реплик Kokoro af_heart с оригинальным мультяшным тембром и три процедурных звука животных, MP3/WAV. Генератор: `scripts/generate-neural-audio.py`; параметры и фонемы: `public/audio/manifest.json`.
- Procedural stars, bubbles, confetti. Нет чужих персонажей, логотипов, музыкальных записей или скачанных моделей.

## Модели и дальнейшая доработка

Paths `/models/foxy.glb`, `/models/cat.glb`, `/models/dog.glb`, `/models/lion.glb` содержат экспортированные ассеты. Игра строит те же модели в `src/characters/toyFactory.ts`; `models.ts` управляет анимацией. Экспорты доступны для скачивания и редактирования в Blender. Transform-группы без skinned mesh. По предоставленным пользователем примерам выбраны мягкие игрушечные пропорции и простая мимика; дизайн/геометрия оригинальные.

Для постановочных клипов с более сложной пластикой нужен художественный rig и интеграция дополнительных clips:

- Foxy: idle, lookAround, point, happy, surprised, scared/hide, laugh, dance, fall, getUp.
- CAT: paws/head reveal или отдельный emergence clip, jump, meow, wave, spin, sit, sleep.
- DOG: emerge, run loop в небольшой области, woof, sit, chaseTail, friendlyReturn/lick.
- Baby LION: soft roar, surprised, happy, roll, sleep, imitation dance.

Рекомендации: общая единица — metre или явно описанный scale; origin у лап; Y-up; clips без root motion за пределы anchor; небольшой mesh budget, простые materials, максимум 1024² textures, целевые GLB примерно до 1–2 MB каждый. Тестировать compression и decoder self-hosting на Safari, прежде чем включать Draco/KTX2. Загружать профессиональные модели по необходимости, не все сразу.

## Звук

Включены Hello, Let's find our friends, Find the CAT/DOG/LION, CAT/DOG/LION, A cat/dog/lion, Our friends are here, Great! You found our friends. Голос AI, игривый en-US; meow/woof/roar созданы процедурно. Прослушивание: `/parent/audio`, пример `artifacts/foxy-voice-preview.mp3`. Если понадобится актёрская версия, получить разрешение исполнителя и заменить файлы с теми же cue ID.

Howler поддерживает MP3/AAC/OGG/WAV, но выбранный браузер должен декодировать формат. Для iOS предпочтительны MP3 или AAC. При замене расширений обновить AudioManager paths/source list и Workbox glob; проверить offline status. Громкость выровнять, убрать клики и неожиданные пики.

Никакой asset swap не должен менять GameEngine или делать отсутствие одного файла фатальной ошибкой для ребёнка.
