# Three material studies

These independent experiments share the production card's arrow contour, rounded
bevel, thickness, dimensions, typography and layout. Only materials, relief and
studio colours vary. The root WebGL renderer and production homepage are unchanged.

- `/variants/` — comparison page with links to the original and all editions.
- `/variants/ivory/` — warm satin titanium and raised champagne-metal logo/name.
- `/variants/obsidian/` — matte gunmetal, polished black-chrome logo/name and a cold rim.
- `/variants/prism/` — angle-dependent oxide-film colour and recessed lettering.

Raised lettering uses a normal/depth map, separate face/wall reflections and short
light-dependent contact shadows. Recessed lettering uses internal occlusion and
view-dependent inner walls. Neither version adds cuts or extruded glyph geometry.
Ordinary contact text stays matte for contrast. Three draw calls, shared movement,
RU/EN links, reduced motion and the fixed touch safe-area mask are preserved.

Each edition is a self-contained minified HTML with embedded font, logos and
favicons. The common controller and engraving generator are reused through build
aliases. `materials.js` owns the material shaders; `renderer.js` keeps the original
geometry/layout with those materials. The gallery previews are CSS illustrations.

Build: `node webgl/variants/build.mjs` from the repository root.
Output: `webgl/dist/variants/`. No test suites or preview sweeps were run.
Published static directory: `/var/www/rozhdestvenskiy.ru/variants`.
Release: `/home/sbmaxx/ya-card-variants-20260924-02`.
Rollback: `ssh rozhdestvenskiy.ru 'bash /home/sbmaxx/ya-card-variants-20260924-02/rollback.sh'`.
The preceding public variants are backed up in that release's `previous/` folder.
Nginx configuration and the existing homepage were not modified.

The source before this material-only round is preserved at
`codex/webgl-snapshot-20260924` (`c868f8d`).
