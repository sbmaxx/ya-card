# Studio metal editions

Four finishes on the production card's contour and layout, rendered by a separate
studio renderer. The production homepage (`webgl/renderer.js`, `webgl/engraving.js`)
is not used by these pages and is unchanged.

- `/variants/` — gallery with real renders (`previews/*.webp`, captured from `/lab/`).
- `/variants/steel/` — linear brushed steel (same grain as gold), diamond V-cut logo, black enamel name.
- `/variants/noir/` — black PVD; laser ablation exposes bare steel for the text and logo.
- `/variants/gold/` — linear brushed champagne gold, V-cut logo, black enamel name.
- `/variants/aurora/` — anodised titanium: thin-film interference (145–205 nm oxide).
- `/variants/lab/` — demo stand: every edition and logo relief, live light, exposure,
  bloom and idle motion. Settings are kept in the URL, so a look can be shared as a link.

## Rendering

- WebGL 2, linear HDR shading, Khronos PBR Neutral tone mapping. Without WebGL 2 the
  existing HTML fallback is shown.
- The environment is an analytic studio: rectangular light panels (key strip, wrap,
  fill, ceiling and side strips) plus a bounce card with a black flag. Panel edges
  soften with roughness and keep their energy, so a mirror shows a crisp panel and
  satin a broad gradient. No environment textures and no requests.
- The room rotates with the light path, the intro sweep and (on phones) the device
  orientation; the SVG shadow and background glow follow the same key direction.
- Brushed metal: seven reflection samples across the groove direction (anisotropic
  streak), with fine groove texture filtered by pixel footprint. Linear (lengthwise)
  brushing is used on every edition; the renderer still supports `brush: 'circular'`.
- Rim: 45° diamond-cut chamfers with hard facet normals around a satin side wall.
- Bloom: highlights above 1.6 are rendered at 1/4 resolution, blurred at 1/4 and 1/8,
  and screen-blended over the card and page.
- Intro: the plate turns in from the dark while the key light sweeps across it.
  Flip: 1.5 s with a slight overshoot; the plate comes towards the viewer mid-turn.
- Phone orientation: the room stays still while the phone turns (reflections slide),
  with a small counter-tilt of the card. iOS asks permission on the first tap.
  The baseline re-centres slowly, so any comfortable hold angle works.
- `prefers-reduced-motion` skips the intro, idle motion and orientation response.

## Lettering

`relief.js` builds the relief map once per layout: an exact Euclidean distance field
(Felzenszwalb–Huttenlocher) of the glyph coverage, corrected by the antialiased edge,
shaped into a profile and smoothed before normals are taken. This removed the
stair-steps and broken creases of the 8-connected chamfer distance on diagonal strokes.

- Logo, `?relief=vcut` (default): linear walls up to the centre line — a chiselled V.
- Logo, `?relief=deboss`: narrow chamfer down to a flat, darker floor.
- Logo, `?relief=raised`: narrow chamfer up to a flat polished top, with a short soft
  shadow thrown away from the key light.
- Name: shallow cut-and-fill (`enamel`: semi-gloss enamel with a thin polished lip) or
  laser ablation to bare metal (`ablate`), depending on the edition.
- Contacts: flat laser marking — dark annealing on bare metal, ablation on PVD.
  Link underline and keyboard focus are drawn with the same process.

## Build and publish

Build: `node webgl/variants/build.mjs` from `webgl/`. Output: `webgl/dist/variants/`.
Each page is a self-contained minified HTML (font, logos, favicons embedded) with
`.gz`/`.br` siblings. `_sheet.html` in `dist/` is a local comparison helper only.

Published static directory: `/var/www/rozhdestvenskiy.ru/variants`. Each release lives
in `/home/sbmaxx/ya-card-variants-<date>-NN` with `previous/` and `rollback.sh`.
Nginx configuration and the homepage are not modified by variant releases.
