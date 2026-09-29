# Milo — листы образа

Три PNG созданы для этого проекта встроенным ImageGen 29.09.2026. Они служат
ориентиром для нового скульпта CAT; текущий GLB по ним автоматически не
построен. Входными изображениями первого листа чужие персонажи не были:
использовано текстовое описание. Остальные листы основаны только на первом.

- `milo-turnaround-v1.png`: единая форма спереди, слева, сзади; мех, лицо,
  лапы, хвост и объёмная тканевая толстовка.
- `milo-expressions-v1.png`: одинаковый персонаж в Idle, Happy, Sleep,
  дружелюбном Roar/мяу. Последний кадр показывает предел открытия рта;
  анимацию нужно сделать мягкой, без хищного выражения.
- `milo-rig-pose-v1.png`: тот же Milo строго спереди в нейтральной A-позе.
  Между рукавами и туловищем, между ногами оставлены зазоры для построения
  сетки и весов. Этот лист можно использовать как вход для image-to-3D,
  но сам PNG не является объёмной или анимируемой моделью.

## Запрос для листа ракурсов

> Original cute kitten Milo for a children's interactive WebAR game. Three
> consistent full-body orthographic views of the same character: front,
> left side, back. Cream and warm-peach fur; expressive teal eyes with lids
> and iris depth; broad soft muzzle and visible gentle smile; rounded ears,
> furry curved tail; head about 48% of height, compact body, separate short
> arms and legs. Oversized dusty-lavender fabric hoodie with open hood behind
> the head, visible lining, folds, zipper and cuffs. Premium cinematic
> stylized 3D maquette, short fur, matte PBR materials, warm studio light,
> neutral background. No text, logos, props or franchise likenesses. Avoid
> glued-on eyes, primitive capsules, plastic sheen and helmet-shaped hood.

## Запрос для листа мимики

> Keep the identity, proportions, fur, teal eyes and lavender hoodie of the
> turnaround image. Four equally sized head-and-shoulders views, same camera
> and lighting: calm curious Idle with a gentle closed smile; joyful Happy;
> Sleep with softly closed eyes and relaxed ears; playful child-friendly
> Roar/meow with a readable open mouth and tongue. Show sculptable cheeks,
> mouth corners, chin, lids and iris depth. Do not redesign Milo; no text,
> props, logos or additional characters.

Это сокращённые формулировки запросов, выполненных в режиме built-in ImageGen. Изображения
нужны для формы и настроения, не для копирования в texture atlas как есть.
