# Studio metal lab

One page, `/lab/`: four finishes on the production card's contour and
layout, rendered by a separate studio renderer, with every setting in a demo panel.
Settings are kept in the URL, so a look can be shared as a link, and «Скачать HTML»
saves it as a standalone production file. The production homepage
(`webgl/renderer.js`, `webgl/engraving.js`) is not used here and is unchanged.

- Editions (`?edition=`): `steel` — linear brushed steel, diamond V-cut logo, black
  enamel name; `noir` — black PVD, laser ablation to bare steel; `gold` — brushed
  champagne gold; `aurora` — anodised titanium, thin-film interference.
- Backdrop (`backdrops.js`): `velvet` — a dark room with one warm spotlight (the
  homepage's); `paper` — a warm light sweep in soft daylight, for a light theme
  (`?backdrop=paper`). The build bakes the page colours, Safari's bar colour and
  the loader's light into the page, so the first paint already matches.
- `/lab/light/`: a draft light theme, the homepage's look turned over for the
  paper room — bead-blasted silver steel, raised black enamel letters, the red Я
  anodised (`LIGHT_LOOK` in `build.mjs`).
- The old `/variants/` section (gallery, edition pages, the lab's old address) was
  removed on 2026-09-30; the lab lives at `/lab/`.
- Slow GPUs get light 3D (flat print on a shaded plate, no studio lighting, relief,
  glow or shadow), chosen by a quick probe and remembered per GPU and screen
  (`renderer.js`: `assessDevice`, `probe`). Its shader is `lite.js`, not in the
  pages: the build writes it beside them as `card-lite-<hash>.js`, fetched only
  by a device that draws light 3D. On any page, the homepage included:
  `?render=full` / `?render=lite` force a mode for that load; `?stats=1` shows GPU,
  mode and frame time and stays on in that browser until `?stats=0`.

## Rendering

- WebGL 2, linear HDR shading, Khronos PBR Neutral tone mapping. Without WebGL 2 the
  existing HTML fallback is shown.
- The environment is an analytic studio: rectangular light panels (key strip, wrap,
  fill, ceiling and side strips) plus a bounce card with a black flag. Panel edges
  soften with roughness and keep their energy, so a mirror shows a crisp panel and
  satin a broad gradient. No environment textures and no requests.
- Lighting setups (`?lightSetup=`, lab «Тип света»): studio, softbox, drama, rim,
  ring, window, neon. Lamps are uniform arrays, so a setup switches live; the key
  softbox keeps the lab's shape, softness and brightness, and the shadow and the
  backdrop's light pool follow the setup's key.
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

Build: `node variants/build.mjs` from `webgl/`. Output: `dist/lab/` (the lab) and
`dist/home/` (the homepage). The lab is a self-contained minified HTML (font, logos,
favicons embedded) with `.gz`/`.br` siblings and its `card-lite-<hash>.js`; without
WebGL 2 it opens the homepage's `/plain/`.

Published static directory: `/var/www/rozhdestvenskiy.ru/lab`. Each release lives
in `/home/sbmaxx/ya-card-lab-<date>-NN` with the previous files and `rollback.sh`.
Nginx configuration and the homepage are not modified by variant releases.
