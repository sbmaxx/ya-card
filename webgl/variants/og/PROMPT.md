# Промпт для превью (OpenGraph) rozhdestvenskiy.ru

Нужны две картинки: `og-ru.jpg` для https://rozhdestvenskiy.ru/ и `og-en.jpg` для
https://rozhdestvenskiy.ru/en/. Размер ровно 1200×630, JPEG, sRGB, до 300 КБ
(лучше генерировать 2400×1260 и уменьшить).

Задача не повторить визитку, а сделать обложку, от которой хочется открыть ссылку:
настроение и материал, а не чертёж. Ниже бриф (общий для всех вариантов) и четыре
концепции — можно отдать модели одну или попросить все четыре и выбрать.

Промпт на английском: модели понимают его точнее. Если модель портит кириллицу,
проси картинку без текста («no text») и накладывай имя сам шрифтом Onest
(`webgl/assets/Onest-card.woff2`), см. раздел «Текст» в конце.

Когда картинки готовы: положить сюда вместо текущих `og-ru.jpg` / `og-en.jpg`,
пересобрать (`node variants/build.mjs` из `webgl/`) и выложить по `webgl/DEPLOYMENT.md`.

---

## Бриф (вставлять перед любой концепцией)

```
Cover image for a personal website link preview, 1200×630 (1.91:1).
The site is a single interactive metal business card of a design and engineering
lead at Yandex. The image should feel like the opening frame of a premium product
film: quiet, precise, tactile, expensive. Photorealistic studio photography,
not a 3D render, not an illustration.

Visual language to borrow from the card (as motifs, not as a copy of the card):
- Material: brushed stainless steel with a fine straight grain; mirror-polished
  45° chamfered edges that catch a single thin line of light.
- Silhouette: a thin plate whose right end narrows into a blunt point, like a tag
  or a flag pointing right. It can be cropped, seen edge-on, or only hinted at.
- One accent colour: deep anodised burgundy red (#890006), used sparingly — a glint,
  a single letter, an edge. Everything else is steel and graphite.
- Palette: graphite black (#0B0C0F), dark steel greys (#2A2C31, #5D6168),
  satin silver, pale pearl (#CFD2D6), and that one burgundy accent.
- Light: dark studio, one large soft light and one thin specular streak.
  Deep, clean shadows. Fine grain. No lens flares, no bokeh balls, no bloom haze.

Composition rules:
- Leave generous calm negative space; this is shown small (300–500 px wide) in
  chats, so the main shape must read at a glance.
- Keep anything important inside the central 1000×520 area; edges may be cropped.
- No people, no hands, no desk props, no watermark, no UI, no other brands.

Avoid: gold or brass, rainbow or holographic reflections, neon, glossy plastic,
cartoon or CGI look, busy textures, wood, marble, heavy vignette, stock-photo feel.
```

---

## Концепции (добавить одну после брифа)

### 1. Макро на кромке

```
Concept: an extreme macro of the polished chamfered edge of a steel plate, running
diagonally across the frame from lower left to upper right. The brushed grain is
visible, the chamfer carries one razor-thin line of light. Near the right third the
edge turns into the blunt point of the tag. A single raised letter «{MARK}» in deep
burgundy red anodised metal sits in sharp focus on the steel; everything else falls
off into soft focus and darkness. The left 45% of the frame is dark graphite
negative space{TEXT}.
```

### 2. Пластина из темноты

```
Concept: a thin brushed-steel plate emerges from total darkness at a steep angle,
seen almost edge-on, only its pointed right end and the top chamfer lit by a single
long softbox reflection that sweeps along it like a sunrise line. The plate is
blank. A long, soft shadow falls behind it on a graphite surface. Minimal, cinematic,
lots of black{TEXT}.
```

### 3. Две половины

```
Concept: a split composition. The right 55% of the frame is filled edge to edge by
a close-up of brushed stainless steel, the grain running horizontally, lit with a
gentle gradient from bright upper left to darker lower right; the pointed end of the
plate cuts into the frame from the right, its polished chamfer glinting. A small
burgundy anodised detail catches the light. The left 45% is flat dark graphite{TEXT}.
```

### 4. Парящая пластина

```
Concept: a single thin metal tag-shaped plate floats in a dark graphite studio,
rotated in three quarters so we see its thickness and polished chamfer, pointed end
towards the upper right. Its face is blank brushed steel reflecting one large soft
light. It casts a soft, distant shadow on the seamless backdrop below. The plate
occupies the right half of the frame; the left half is calm negative space{TEXT}.
```

---

## Текст

Вместо `{TEXT}` подставить один из вариантов.

С текстом от модели (подходит, если она уверенно пишет нужные буквы):

```
, with typography set in that space: «{NAME}» in a clean geometric grotesque
(like Onest or Inter), medium weight, pale silver, large and left-aligned; below it,
much smaller and in muted grey, «{ROLE}». Text spelled exactly as quoted, no other
text anywhere in the image
```

Без текста (надёжнее, текст накладывается потом): `. No text anywhere in the image`

| | Русская (`og-ru.jpg`) | Английская (`og-en.jpg`) |
|---|---|---|
| `{NAME}` | Роман Рождественский | Roman Rozhdestvenskiy |
| `{ROLE}` | Руководитель отдела поисковых интерфейсов, Яндекс | Head of search interfaces, Yandex |
| `{MARK}` | Я | Y |

Для русской версии добавить: `All text is Russian, in Cyrillic.`

Если текст накладываешь сам: имя — Onest Medium 52–60 px, цвет #E6E8EB;
должность — Onest Regular 20–22 px, цвет #8A8E94; выравнивание по левому краю,
отступ слева около 90 px, блок по вертикали в центре тёмной части кадра.

---

## Как проверить результат

- Уменьши картинку до 400 px по ширине: главная форма и имя должны читаться.
- Проверь буквы: «Рождественский», «Rozhdestvenskiy».
- Ничего важного не выходит за центральную зону 1000×520.
- Картинка не похожа на сток и не выглядит как 3D-рендер.
