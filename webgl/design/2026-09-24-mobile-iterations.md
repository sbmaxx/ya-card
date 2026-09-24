# Four successive visual passes

No agents were used. All changes are in the standalone `webgl/` project.

## Preserved production version

- Tag: `ya-card-polished-baseline-2026-09-24`, commit `36c2230`.
- Exact source and production files: `snapshots/2026-09-24-polished-baseline/`.
- HTML SHA-256: `acc36f6a8083c30052450855dbc80843abd565d6f44e30d4ed6e4f3bce368df8`.
- Downloaded public HTML matched the archived build before editing.
- The source archive includes `data.js`. This required standalone module was
  previously hidden by the root project's ignore rule; `webgl/.gitignore` now
  explicitly includes it so fresh checkouts can reproduce the build.

## 1. Portrait composition

Compared centered and left-aligned stacks with the saved version on 390×844 and
320×568, in both languages. Selected the left column: 110px wordmark, 24px name
on two lines, 12.5px role on two lines, then email and Telegram at 12.5px.
The website remains separated below. All visible glyphs retain equal top and
bottom margins, measured from the actual outline of the text.

Evidence: `snapshots/2026-09-24-mobile-round1/`. `?layout=center` retains the
unselected centered study; no extra controls are shown on the site.

## 2. Small screens and rotation

The first pass still shrank too much on a short screen. A 300×460 portrait plate
now replaces 300×545 when the physical screen's longest side is below 740 CSS px.
This widens the card on small phones while retaining balanced content margins.
Using the screen rather than changing viewport height avoids a toolbar-triggered
switch. Horizontal touch layouts use the wide card, fit available height, and
shift up slightly to leave room for the language and social links.

Ray intersection, shadow projection and native-link focus use the resulting
geometry. A focused site link loses focus when rotating to a layout that hides it.
Evidence: `snapshots/2026-09-24-mobile-round2/`.

## 3. Coherent studio reflection

Compared the old `cut` light with `milled`: the satin plate, polished logo floor
and inner bevel now reflect the same moving round source. Roughness changes
the width of the reflection rather than moving it to a different location.
Selected `milled`; the name bevel is quieter, while the logo remains distinct.
Evidence: `snapshots/2026-09-24-light-round3/`.

## 4. Highlight and fallback refinement

The third pass exposed a bright clipped corner. A soft highlight shoulder now
compresses values above 0.82, preserving a continuous transition below white.
The no-WebGL/no-JS cards share the new name hierarchy and silver palette. Their
footer is in document flow so it cannot cover the contacts during scrolling.
The desktop role stays on one line; mobile role uses two.

Final selected views: `snapshots/2026-09-24-multi-final/`. The renderer still uses
three draw calls, no additional image assets, and cached lettering textures.
Shallow relief is a normal-map approximation; physical mobile GPU/battery usage
and Safari chrome on an actual iPhone were not measured in this environment.

## Validation scope

- Built-browser suite: RU/EN/history, keyboard, mouse, touch, flip, zoom,
  context recovery, links, no-JS/no-GPU, no external runtime requests.
- Engraving suite: sign/depth, neutral mask outside lettering, front/back UV
  bases, actual light response, resource lifecycle, no-derivatives shader.
- Contact suite: native anchor order, focus rectangles/pose hold, Enter,
  responsive focus, fallback scrolling, context loss and language history.
- Mobile suite: 390×844, 320×568, 844×390, 568×320. Actual raster bounds for both
  languages, balanced margins, footer clearance, projected ray hits, actual
  background/card taps, and unclipped no-JS cards on desktop and mobile.

Old test fixtures assumed the former centered Telegram/email coordinates.
The browser suite now projects the actual focused link bounds, and the contact
fixture reflects the new left-aligned email. The initial coordinate failures
were retained in the task history before rerunning the corrected checks.
