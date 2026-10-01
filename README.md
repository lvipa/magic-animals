# Magic Animals

Детское приложение для знакомства с английскими словами через бумажные карточки,
3D животных, движения и небольшие задания на слух. React + Three.js + MindAR, PWA.
Учётная запись, пароль и внешний TTS сервис для игры не нужны.

**Рабочая версия:** https://animals.flowlabli.online/

## Быстрый запуск

Нужны Node.js 24 LTS и npm. Ассеты камеры, модели и озвучка уже включены.

```sh
git clone https://github.com/lvipa/magic-animals.git
cd magic-animals
npm ci
npm run dev
```

Откройте адрес Vite из терминала. Production/PWA:

```sh
npm run build
npm run preview
```

На Windows можно использовать `powershell -ExecutionPolicy Bypass -File ./run.ps1 dev`.
Для камеры на телефоне/iPad нужен доверенный HTTPS; `localhost` относится к самому
телефону, а не компьютеру. Полный порядок: [RUN_GUIDE.md](RUN_GUIDE.md).

## Экраны

| Адрес | Назначение |
|---|---|
| `/` | Сканирование восьми карточек в любом порядке и история из трёх глав |
| `/friends` | Восемь друзей, движения, задания «слушай и найди» / «слушай и двигайся» |
| `/tv` | Экран телевизора, QR и код сопряжения |
| `/connect-tv` | Поле ввода TV-кода; QR заполняет его автоматически |
| `/printables/cards.html` | Карточки для печати |
| `/printables/magic-animals-milo-a4.pdf` | Восемь карточек на трёх листах A4, масштаб 100% |
| `/printables/magic-animals-print-sources.zip` | PNG, SVG, HTML и PDF |

## TV

Откройте `/tv` на телевизоре и нажмите **START TV**. Наведите штатную камеру телефона
на QR, откройте ссылку и нажмите **Connect TV**. Можно ввести код вручную на
`/connect-tv`; ссылка **Connect TV · QR / code** есть на первом экране игры.
Оба устройства должны открыть один и тот же адрес игры.

Локальный relay: `npm run build`, затем `npm run tv` (порт 8080).
На текущем публичном сайте используется отдельный PHP транспорт.
[TV_SETUP.md](TV_SETUP.md) · [DEPLOYMENT.md](DEPLOYMENT.md).

## Исходники и устройство проекта

- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура и границы модулей.
- [PRINT_GUIDE.md](PRINT_GUIDE.md) — печать и распознавание камерой.
- [AUDIO_PRODUCTION.md](AUDIO_PRODUCTION.md) — восемь голосов, звук и генерация.
- [CHARACTER_ART_DIRECTION.md](CHARACTER_ART_DIRECTION.md) — требования и этап утверждения CAT.
- [MILO_AR_RELEASE.md](MILO_AR_RELEASE.md) — текущий CAT, короткая шерсть, восемь целей и проверки.
- `scripts/export-milo-game.py` — экспорт новой основы CAT из локального Blender-источника.
- `assets/characters/cat/milo-master.blend` — архив предыдущей версии CAT.
- [CAT_PRODUCTION.md](CAT_PRODUCTION.md) — редактирование, экспорт сохранённого Blender-источника и проверка ракурсов.
- [CAT_REVIEW.md](CAT_REVIEW.md) — технический результат, 32 снимка WebGL и непройденные художественные критерии.
- [CAT_ART_HANDOFF.md](CAT_ART_HANDOFF.md) — требования к новому художественному CAT, поставке исходника и визуальной приёмке.
- [BLENDER_WORKFLOW.md](BLENDER_WORKFLOW.md) — локальный официальный Blender MCP, запуск и новая сцена Milo без Meshy.
- [FUTURE_WORK_HANDOFF.md](FUTURE_WORK_HANDOFF.md) — договорённости по остальным персонажам, будущим играм и передаче работы в другой Codex.
- `assets/characters/cat/milo-authoring.blend` — отдельный незавершённый этюд нового Milo; пока не используется в игре.
- `public/markers/milo-v2/*.svg` — редактируемые оригиналы восьми карточек.

## Текущий статус

Камера распознаёт **CAT, DOG, LION, FOX, RABBIT, BEAR, PANDA и ELEPHANT**.
Нажмите **SCAN ANY CARD** для свободного порядка с первого экрана.
В игре используется новая основа Milo CAT с семью движениями и короткой шерстью.
CAT — текущий кандидат на визуальный эталон, **ещё не утверждён пользователем**.
Остальные модели сохраняют прежний прототипный вид до утверждения CAT.
Физическое тестирование на iPad/iPhone/Smart TV остаётся отдельным этапом.

```sh
npm run lint
npm test -- --maxWorkers=1 --no-file-parallelism
npm run build
python scripts/check-cat-studio.py
```

Репозиторий не содержит данных доступа к ISP, локальных снимков конфигурации,
паролей, приватных ключей или служебных логов. Все секреты и локальные файлы
инфраструктуры исключены через `.gitignore`; публикация проверяется скриптом
`scripts/check-public-source.py`.
