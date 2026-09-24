# Промпт для превью (OpenGraph) rozhdestvenskiy.ru

Нужны две картинки: `og-ru.jpg` для https://rozhdestvenskiy.ru/ и `og-en.jpg` для
https://rozhdestvenskiy.ru/en/. Итоговый размер ровно 1200×630, JPEG, sRGB, до 300 КБ.
Лучше генерировать вдвое крупнее (2400×1260) и потом уменьшить.

Референсы для модели: текущие скриншоты `og-ru.jpg` и `og-en.jpg` из этой же папки.
Приложи их к промпту: там точные форма, цвета и раскладка текста.

Промпт ниже на английском: модели генерации картинок понимают его точнее.
Если модель путает кириллицу, используй вариант B (пластина без текста) и наложи
текст сам шрифтом Onest (Medium для имени, Regular для остального).

Когда картинки готовы: положить их сюда вместо текущих, затем пересобрать
(`node variants/build.mjs` из `webgl/`) и выложить по `webgl/DEPLOYMENT.md`.

---

## Вариант A — картинка целиком, с текстом

```
A premium product photograph of a single metal business card, for a link preview
image. Landscape 1200×630 (1.91:1). Photorealistic, studio still life, shot on a
medium-format camera with a 100 mm macro lens, f/8, everything on the card in focus.

THE CARD
- A thin plate of brushed stainless steel, about 0.8 mm thick, proportions 1.8 : 1.
- Shape: a horizontal pentagon, like a luggage tag or a flag pointing right.
  The top and bottom edges are straight and parallel and run for 87% of the width;
  from there both edges converge to one blunt point at the middle of the right side.
  The left side is a straight vertical edge. All five corners have a small radius
  (about 1.3% of the width). No hole, no string.
- Surface: satin stainless steel with a fine, straight, horizontal brushed grain
  running along the length of the card. Light greyish silver, not chrome, not white.
- Edge: a narrow 45° diamond-cut chamfer around the whole outline, mirror-polished,
  catching a thin bright line of light along the top edge and the point.

THE LETTERING (all of it raised a fraction of a millimetre above the plate,
with crisp polished bevels that catch the light and a very short soft shadow)
Laid out left-aligned in a column, starting at about 9% from the left edge,
vertically centred on the card:
1. The wordmark «{LOGO}» — small, about 17% of the card width.
   The first letter «{LOGO_FIRST}» is anodised deep burgundy red (#890006).
   The rest of the word is anodised pale pearl grey (#CFD2D6).
2. The name «{NAME}» on one line — the largest text, about 80% of the card width,
   a clean geometric grotesque (Onest Medium). Raised, mirror-polished chrome
   letters of the same steel: they read as bright silver outlines with darker faces
   reflecting the dark studio.
3. Under the name, small: «{ROLE}», raised, filled with graphite-grey enamel (#5D6168).
4. A gap, then two small lines, same graphite enamel:
   «sbmaxx@yandex-team.ru»
   «t.me/sbmaxx»
All text must be spelled exactly as quoted, in the same letter case, no extra words.

SCENE AND LIGHT
- The card floats slightly in front of a seamless dark graphite studio backdrop
  (#0B0C0F at the edges to a soft pool of light around #2A2C31 behind the card).
- Card seen almost straight on, rotated no more than 8° in depth (the right point
  slightly further away), tilted up a few degrees. No dramatic perspective.
- One large soft overhead softbox: an even, gentle gradient across the steel,
  brighter at the upper left, a thin specular line along the top chamfer.
  A faint cool rim light from the right. Subtle, premium, calm.
- A soft, diffuse shadow of the card on the backdrop, below and slightly to the right.
- Very fine film grain; no bloom halos, no lens flare, no bokeh balls.

COMPOSITION
- The card is centred and occupies about 65% of the image width.
- Keep the whole card inside the central 1000×520 area: previews crop the edges.
- Everything else is the dark backdrop. No other objects, no hands, no props,
  no watermark, no extra text, no logo other than the one on the card.

STYLE REFERENCES: Apple product photography, Leica and Bang & Olufsen catalogue
shots, engraved titanium credit cards. Minimal, expensive, precise.

AVOID: gold or brass tones, rainbow reflections, chrome mirror finish on the whole
plate, rounded rectangle card shape, a hole or string on the tag, misspelled text,
Latin letters in the Russian text (or Cyrillic in the English one), busy background,
wooden desk, marble, cartoon or 3D-render look, heavy vignette, text outside the card.
```

### Подстановки

| | Русская (`og-ru.jpg`) | Английская (`og-en.jpg`) |
|---|---|---|
| `{LOGO}` | Яндекс | Yandex |
| `{LOGO_FIRST}` | Я | Y |
| `{NAME}` | Роман Рождественский | Roman Rozhdestvenskiy |
| `{ROLE}` | руководитель отдела поисковых интерфейсов | head of search interfaces department |

Для русской картинки добавь в конец промпта строку:
`All text on the card is Russian, in Cyrillic: «Яндекс», «Роман Рождественский»,
«руководитель отдела поисковых интерфейсов».`

---

## Вариант B — пластина без текста (текст накладывается потом)

Тот же промпт, но раздел THE LETTERING заменить на:

```
THE CARD IS BLANK: no text, no logo, no engraving at all. Leave the left 75% of the
plate as clean brushed steel, lit evenly enough that dark grey and burgundy lettering
added later in post-production stays readable over its whole area.
```

Потом наложить текст (координаты для картинки 1200×630, если карточка по центру
и шириной 65% кадра, то есть примерно x 210–990, y 100–530):

| Строка | Шрифт | Размер | Цвет | Отступ слева | Базовая линия |
|---|---|---|---|---|---|
| Яндекс / Yandex | Onest Medium | 30 px | «Я»/«Y» #890006, остальное #CFD2D6 | 283 | 229 |
| Имя | Onest Medium | 50 px | светлый металл #E6E8EB с тёмной обводкой 1 px | 283 | 319 |
| Должность | Onest Regular | 17 px | #5D6168 | 283 | 358 |
| Почта | Onest Regular | 17 px | #5D6168 | 283 | 405 |
| Telegram | Onest Regular | 17 px | #5D6168 | 283 | 431 |

Шрифт Onest лежит в `webgl/assets/Onest-card.woff2` (лицензия OFL рядом).

---

## Как проверить результат

- Превью в Telegram и Slack показывают картинку шириной 300–500 px: имя должно
  читаться и там. Уменьши картинку до 400 px и проверь.
- Проверь буквы: «Рождественский», «Rozhdestvenskiy», `sbmaxx@yandex-team.ru`.
- Карточка целиком внутри центральной зоны 1000×520, края не обрезаны.
