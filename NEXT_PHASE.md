# TV — реализовано; физический тест следующий

Реализация: `/tv`, Parent pairing, relay, clock offset, prepare/ready/commit, portal, cancellation, reconnect, scene snapshots и выбор экрана для озвучки. Запуск: TV_SETUP.md; результаты desktop: TV_TEST_RESULTS.json. Реальный тест iPad + Xiaomi TV отложен пользователем. Ниже сохранены исходные художественные ориентиры, включая будущую доработку enter/exit клипов.

## Иллюзия перемещения

1. iPad распознаёт CAT и играет с ребёнком локально.
2. GameEngine решает освободить персонажа; небольшая пауза и портал на anchor.
3. CAT прыгает в портал; к моменту transfer timestamp модель iPad скрывается.
4. Bridge отправляет ANIMAL_RELEASED с scene/animal/transfer ID и общим временем раскрытия.
5. На TV по тому же timestamp появляется портал; персонаж выходит с соответствующим входным clip.
6. После подтверждения TV сцена считается переданной. При потере связи персонаж дружелюбно возвращается к iPad.

## Контракт событий следующего этапа

```ts
interface TransferPayload {
  sessionId: string;
  transferId: string;       // idempotency; один персонаж не появляется дважды
  sequence: number;
  animalId: string;
  sourceScene: string;
  destinationScene: string;
  issuedAt: number;
  revealAt: number;         // согласованное время TV появления
  animation: string;
  protocolVersion: 1;
}
```

`TVBridge` сохраняет независимость GameEngine от конкретного сервера. Реализован WebSocketTVBridge; NoopTVBridge остаётся standalone fallback.

## Архитектура и художественные ориентиры

- Статический TV frontend с Three.js и заранее загруженным нужным персонажем.
- Небольшой relay/session server в локальной сети или HTTPS/WSS hosting.
- Pairing код на TV и подтверждение родителем на iPad, session capability token.
- Clock offset оценивается ping/pong по нескольким измерениям. Запланированная задержка порядка 0.8–1.5 секунды позволяет подготовить portal и скрыть network jitter.
- TV подтверждает READY до прыжка на iPad. CAT не исчезает, если телевизор не готов.
- ACK transfer ID, deduplication, sequence ordering, reconnect и cancellation.
- Сервер пересылает игровые события, **не camera frames**.
- Slow/unsupported TV WebGL: облегчённый персонаж и сниженный DPR; заранее проверить Xiaomi TV browser, codecs и память.
- Overlay orchestration отделить от tracker: portal остаётся в AR adapter, transfer scheduling — в переиспользуемом engine/bridge.

## Acceptance для будущего задания

- Измерить разницу между hide на iPad и reveal на TV; целиться в воспринимаемую плавную последовательность, а не обещать точную синхронизацию до измерений.
- Потеря Wi-Fi никогда не теряет персонажа навсегда.
- Duplicate/reordered events не создают двойную CAT.
- Тест реальные iPad + Xiaomi TV, offline LAN, задержка, фон и reconnect.
- TV UI, процедурный portal и relay уже готовы. Художественные enter/exit clips можно доработать отдельно; deployment требует выбранного HTTPS hosting.

Birthday Adventure / The Lost Birthday Star не реализуются на этом этапе. Позже смогут использовать ARProvider, content timelines, characters, particles, audio, parent gate, storage, scene transitions и TVBridge.
