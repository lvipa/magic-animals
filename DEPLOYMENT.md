# Запуск и HTTPS deployment

## Требования

- Node.js 22.12+ или 24 LTS. Текущий Node 18 на исходном компьютере недостаточен для актуального Vite; `run.ps1` использует имеющийся bundled Node 24.
- npm. Одиночная игра не требует backend или API key. TV использует необязательный Node/WebSocket relay; его настройки описаны в `.env.example`.
- Доверенный HTTPS и hosting в **корне сайта**. Asset paths и PWA scope начинаются с `/`.

## Текущий ISP сайт

Сайт размещён отдельно на `https://animals.flowlabli.online/`. Доменная A-запись,
webdomain и сертификат выпущены только для этого поддомена. Настройки и файлы
существующих сайтов не меняются; до и после публикации скрипт сверяет их с
`.deployment/isp-before.json`.

Новая версия собирается командой `npm run build`; содержимое `dist/` загружается
в корень этого отдельного сайта. При PHP relay дополнительно разместите
`server/tv-poll-standalone.php` как `/tv-poll.php`, а его state — вне web root.
Локальная автоматизация ISP сверяет прежние сайты, DNS, сертификаты и файлы до и
после публикации. Эти скрипты, снимки ISP и файл доступа исключены из GitHub и
никогда не загружаются в публичный каталог. Публичный репозиторий запускается
без них и не содержит конкретных учётных данных хостинга.

Для `animals.flowlabli.online` в ISP отключён параметр `srv_cache`: прежнее
значение выдавало `sw.js` с `Cache-Control: max-age=3888000` (45 дней).
Остальные сайты не менялись. Nginx раздаёт JavaScript напрямую, поэтому
`.htaccess` не мог исправить этот заголовок. Клиент проверяет обновление
Service Worker при открытии, возвращении на вкладку, восстановлении сети и
каждые 15 минут во время долгой сессии. При публикации сначала загружаются
ассеты, затем `index.html`, последним `sw.js`; старые хэшированные ассеты
остаются доступными для открытых вкладок.

На этом тарифе Passenger директивы для Node в `.htaccess` запрещены, а фоновый
Node процесс ограничен памятью. TV режим на опубликованном сайте работает через
same-origin PHP endpoint с состоянием в приватном каталоге. Локальный запуск
сохраняет прямое WebSocket соединение. На телевизоре открыть
`https://animals.flowlabli.online/tv`, на iPad — тот же домен и ввести код TV.

```sh
npm install
npm run lint
npm test
npm run build
```

Windows в текущем workspace:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1 install
powershell -ExecutionPolicy Bypass -File .\run.ps1 build
powershell -ExecutionPolicy Bypass -File .\run.ps1 preview
```

## Любой static host

1. Загрузите содержимое `dist/` как целый snapshot. Сохраняйте все markers, WAV и chunks, а не один index.html.
2. Включите HTTPS с доверенным сертификатом для выбранного домена.
3. Настройте SPA rewrite на `/index.html` для `/parent`, `/marker-test`, `/camera-test`, `/install`, `/offline-status`. Существующие static files должны обслуживаться непосредственно.
4. Для отсутствующих `/audio/*`, `/markers/*`, `/models/*` отдавайте 404, не HTML. Это позволяет корректно обнаружить отсутствующий ассет.
5. Для `sw.js` и `index.html` используйте `Cache-Control: no-cache`; хэшированные `/assets/*` могут иметь длительный immutable cache. Workbox сам версионирует precache.
6. Откройте `/offline-status` после полной загрузки и повторной навигации. Убедитесь, что Worker управляет страницей, затем сделайте реальный offline relaunch.

## Пример Caddy

При наличии собственного сервера и домена настройка может выглядеть так (подставьте домен и путь):

```caddyfile
animals.example.com {
  root * /srv/magic-animals/dist
  encode zstd gzip
  header Permissions-Policy "camera=(self), microphone=(), geolocation=()"
  @noCache path /sw.js /index.html
  header @noCache Cache-Control "no-cache"
  @asset path /audio/* /markers/* /models/* /icons/* /assets/* /printables/*
  handle @asset {
    file_server
  }
  handle {
    try_files {path} /index.html
    file_server
  }
}
```

Не ставьте запрет на Worker с `blob:`: MindAR использует локальный inline Worker. Если добавляете CSP, протестируйте её с реальным tracker до выдачи сайта ребёнку.

## Локальное развитие

`npm run dev` — HTTP на localhost, где камера разрешена как secure localhost. На iPad URL вида `http://192.168.x.x:5173` не является доверенным HTTPS. Для iPad используйте опубликованный HTTPS snapshot либо настройте LAN TLS с сертификатом CA, которому iPad действительно доверяет. Обычный self-signed certificate без установки доверия не считается достаточным тестом.

Preview проверяет production bundle и PWA. Development не выдаётся за offline production: service worker генерируется сборкой.

## Пересборка целей / браузерные тесты

PNG, `.mind`, GLB, MP3 и WAV уже находятся в public: build не требует Python или модели голоса. Дополнительные `cards`, `targets`, `test:tracking`, `test:models`, `test:browser`, `test:tv` используют headless browser. Runtime helper ищет Chrome/Edge на Windows, Chrome на macOS и Chrome/Chromium на Linux; другой executable передаётся через CHROME_PATH. Если браузера нет, используется Playwright Chromium после `npx playwright install chromium`.

```sh
npm run cards
npm run targets
npm run test:tracking
# Терминал 1:
npm run preview
# Терминал 2:
npm run test:browser
```

При тесте browser используются изображения карточек как искусственный video source. Это инженерная проверка реального getUserMedia/Controller/pose, а не утверждение о физическом iPad.

Обновление PWA не вызывает обязательный диалог ребёнку: режим `autoUpdate` активирует новый Worker. При deploy храните прежние хэшированные assets некоторое время или используйте atomic snapshots. Параметр версии модели `v` игнорируется текущим precache, поэтому CAT работает и offline после установки нового Worker.

## Hosting с TV

После сборки запустите `npm run tv`: сервер обслуживает dist и WebSocket на 8080. Поставьте доверенный HTTPS reverse proxy, сохраняющий Host и WebSocket. Например, Caddy для собственного домена:

```caddyfile
animals.example.com {
  reverse_proxy 127.0.0.1:8080
}
```

Альтернатива: переменные процесса TV_TLS_CERT / TV_TLS_KEY с путями к доверенному сертификату и ключу. `.env.example` автоматически не загружается. Static-only hosting не запускает relay. Действия на экранах: TV_SETUP.md.
