# Голоса и звук восьми друзей

Включены 104 локальных клипа: 93 английские реплики и 11 эффектов (включая три базовых animal calls и восемь cast cue). Kokoro 82M v1.0 / en-US используется только при подготовке. Голоса синтетические и оригинальные; это не копирование голоса актёра или персонажа из другого приложения.

| Друг | Базовый голос | Мультяшная высота |
|---|---|---|
| FOX / Foxy | af_bella | +3.0 полутона |
| CAT / Milo | af_heart | +3.2 |
| DOG / Bubbles | am_fenrir | +4.2 |
| LION / Sunny | am_michael | +2.3 |
| RABBIT / Poppy | af_sky | +3.8 |
| BEAR / Maple | am_adam | +1.8 |
| PANDA / Pebble | af_nicole | +2.5 |
| ELEPHANT / Ellie | af_sarah | +2.0 |

Темп компенсируется при изменении высоты; Sleep немного медленнее и спокойнее.
Idle представляет друга; Happy/Wave/Jump/Run/Sleep озвучивают состояние или глагол;
Roar имеет собственную фразу для каждого вида. Эффекты — дружелюбная стилизация,
а не полевые записи. Для тихого кролика используется мягкое сопение, не мяуканье.
Задания на слух используют `find-*`, `ask-*`, `well-done-*` и `try-again`.

Прослушивание: Parent Mode → Listen to Foxy (`/parent/audio`). Пример: `artifacts/foxy-voice-preview.mp3`. Окончательно оценить интонацию и понятность ребёнку нужно на слух.

CAT /kæt/, DOG /dɑːɡ/, LION /ˈlaɪən/. Фактические входные фонемы, обработка, длительности, пики и SHA-256 WAV: `public/audio/manifest.json`. Проверка фонем не заменяет прослушивание. Моно WAV 24 kHz PCM16 + MP3 96 kbps. Убрана лишняя тишина с запасом для согласных, добавлены fades; целевые -18 LUFS речь / -25 LUFS эффекты, true peak -3 dB. Для коротких слов итоговая громкость может отличаться от целевой.

Howler завершает слово перед следующей фразой, animal calls идут отдельным более тихим каналом. Смена сцены очищает очередь. PWA кэширует файлы; в браузере нет модели/внешнего TTS/Web Speech. iOS разблокирует звук нажатием PLAY. TV использует START TV/Enable sound и выбор экрана в Parent Mode.

## Перегенерация (обычная сборка не требует её)

Python 3.11+, около 500 MB для инструментов/модели:

```powershell
python -m venv .voice-tools
.\.voice-tools\Scripts\python.exe -m pip install -r scripts/voice-requirements.txt
.\.voice-tools\Scripts\python.exe scripts/download-voice-model.py
.\.voice-tools\Scripts\python.exe scripts/expand-audio-lines.py
.\.voice-tools\Scripts\python.exe -X utf8 scripts/generate-neural-audio.py
.\.voice-tools\Scripts\python.exe scripts/generate-cast-calls.py
```

Тексты/скорости: `scripts/audio-lines.json`. Генератор обновляет аудио, manifest, generated.ts и пример в artifacts. Снова соберите PWA после изменений. `.voice-tools` не публикуется.

Источники: [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT). Animal calls созданы кодом проекта.
