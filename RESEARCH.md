# PHASE 0 — WebAR research

Проверено по первичным источникам 28–29 сентября 2026 года. Выводы о реальном iPad требуют device test, а не только совместимых API.

| Вариант | Image targets / Three.js | Safari и локальная камера | Self-hosting / лицензия | Решение |
| --- | --- | --- | --- | --- |
| MindAR 1.2.5 | Natural feature targets, несколько целей в `.mind`, Controller и Three wrapper | getUserMedia + WebGL; без требования immersive WebXR | npm-бандл и локальные файлы; MIT | Выбран для трёх иллюстрированных карточек |
| AR.js NFT | Natural feature tracking; Three.js и A-Frame | Browser camera; требуется device QA и настройка NFT descriptors | Self-host; AR.js MIT, ARToolKit зависимость LGPLv3 + additional permission | Реальная альтернатива, больше деталей интеграции и лицензирования |
| AR.js pattern markers | Контрастный квадратный marker с pattern | getUserMedia, без native SDK | Self-host; лицензии как выше | Запасной вариант, если natural image tracking на устройстве неудовлетворителен; потребует смены печатных карточек |
| Обязательный WebXR | Это API сессий XR, а не готовый image tracker | Нельзя предполагать одинаковую доступность immersive AR на iPhone/iPad | Зависит от реализации | Не используется как обязательная основа |

## Источники

- [MindAR repository, distribution, MIT](https://github.com/hiukim/mind-ar-js).
- [Официальная установка: ES modules и Three.js](https://hiukim.github.io/mind-ar-js-doc/installation/).
- [Three.js image example](https://hiukim.github.io/mind-ar-js-doc/more-examples/threejs-image/).
- [Compiler / Controller API](https://github.com/hiukim/mind-ar-js-doc/blob/master/docs/core-api.md).
- [Compiler implementation](https://github.com/hiukim/mind-ar-js/blob/master/examples/image-tracking/compile.html).
- [AR.js: возможности и лицензии](https://github.com/AR-js-org/AR.js).
- [getUserMedia: secure context, permission и rear camera](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
- [Vite PWA / Workbox](https://vite-pwa-org.netlify.app/guide/).

## Техническое решение

Пинning версии обязателен: Controller API upstream является расширенным API без стабильной формальной спецификации. Используемый набор методов и нормализация pose сверены с исходным Three wrapper версии 1.2.5. В проекте реализован свой адаптер для управляемого lifecycle, локального video, собственного canvas, диагностики и прекращения camera tracks.

Камера → локальный GPU feature detector → локальный Worker matching → pose → сглаженный anchor → Three.js. Позиция определяется изображением; plane tracking, room mesh, face recognition и cloud vision отсутствуют.

Первая версия карточек давала ложное совпадение DOG → CAT. Добавлены независимые контрастные узоры и разные детали лиц. Повторная проверка всех трёх целей через реальный Controller вернула правильные индексы и матрицы позы. Это зафиксировано в `TRACKING_TEST_RESULTS.json`.

## Ограничения и fallback

- Нужны разрешение камеры, HTTPS, WebGL и достаточные ресурсы GPU.
- Одна активная цель одновременно; потеря изображения не даёт полноценного room anchor.
- Pose сохраняется визуально на 1.2 секунды после потери цели, затем скрывается. Это последнее положение в кадре, а не SLAM.
- Confidence не предоставляется выбранным API; интерфейс не выдумывает число.
- Печатный контраст, отражения, расстояние, перекрытие изображения и свет влияют на распознавание.
- Browser APIs совместимы с выбранным способом для Safari; физический iPad в этой среде недоступен. Срок/надёжность tracking и iOS-память не объявляются проверенными до device checklist.

Fallback никогда не обозначается как AR. При ошибке init tracking включается камера с ручным размещением; при невозможности камеры — 3D. Если CAT не распознаётся на устройстве при рабочей камере и правильной печати, сначала тестировать `/marker-test`, затем улучшать признаки/размер цели. Реальная следующая browser-based альтернатива — AR.js NFT, либо AR.js pattern tracking с новыми контрастными карточками. Не заменять targetFound искусственным таймером.
