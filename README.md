# Magic Animals

Детское приложение для знакомства с английскими словами через бумажные карточки,
3D животных, движения и небольшие задания на слух. React + Three.js + MindAR, PWA.
Учётная запись, пароль и внешний TTS сервис для игры не нужны.

**Рабочая версия:** https://animals.flowlabli.online/

**Контрольная точка 04.10.2026:** `magic-animals-snapshot-2026-10-04`.
Разработка сохранена для продолжения позднее: [как вернуться](GAME_CHECKPOINT.md),
[план следующих игр](NEXT_GAMES_PLAN.md). Сейчас хостинг отдаёт HTTP 403
«Работа сайта приостановлена»; исходники и готовые ассеты сохранены в GitHub.

**Новое:** поиск всех восьми карточек с альбомом и заданиями — `/hunt`,
детское меню, четыре мира, десять озвученных действий/состояний и рассказы друзей.
Исправлены хвосты и деформация рта FOX/DOG.
Инструкция и текущие ограничения: [CHILD_PLAY_RELEASE.md](CHILD_PLAY_RELEASE.md).

Все восемь друзей переведены на общий skinned GLB-процесс Milo: худи,
отдельные глаза/веки, короткий ворс и семь движений. Текущие ассеты,
происхождение и восстановление: [MILO_CAST_RELEASE.md](MILO_CAST_RELEASE.md).
Последняя полировка v9, движения ушей/хобота и рот под голос:
[MILO_POLISH_RELEASE.md](MILO_POLISH_RELEASE.md). Подключение телевизора:
[TV_GUIDE.md](TV_GUIDE.md).

Модели скачиваются при выборе и сохраняются на устройстве. Для игры без сети
на `/offline-status` нажмите **Save all friends for offline play** и дождитесь
READY. Если обычный Safari удерживает старую сборку, откройте
https://animals.flowlabli.online/review/update.html и нажмите **Update and open friends**.
Это сохраняет прогресс игры. Подробности: [CACHE_UPDATES.md](CACHE_UPDATES.md).

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
CAT остаётся визуальным эталоном; окончательная художественная полировка ещё требуется.
Пользователь разрешил обновление остальных героев; теперь вся коллекция использует
общий skinned GLB-процесс. Подробности: [MILO_CAST_RELEASE.md](MILO_CAST_RELEASE.md).
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
