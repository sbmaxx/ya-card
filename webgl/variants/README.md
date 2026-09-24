# Three separate visual directions

These are independent experiments alongside the existing homepage. The root
WebGL renderer, HTML and production index remain unchanged.

- `/variants/` — comparison page with links to the original and all editions.
- `/variants/ivory/` — pale warm metal, brass raised mark, rounded rectangle,
  centered composition and an ivory studio background.
- `/variants/obsidian/` — dark mirrored metal, raised platinum mark, clipped
  corners, larger typography and a black studio environment.
- `/variants/prism/` — angle-dependent cyan/lilac/rose anodized metal, a dark
  engraved mark, desktop split layout and a vivid cobalt/violet environment.

Each edition is a self-contained minified HTML with the same RU/EN contacts,
flip, pointer/touch interaction, embedded font, logos and favicons. The common
application controller and engraving generator are reused through build aliases;
this folder owns the experimental renderer and art directions.

Build: `node webgl/variants/build.mjs` from the repository root.
Output: `webgl/dist/variants/`. No test suites or preview sweeps were run.
Published static directory: `/var/www/rozhdestvenskiy.ru/variants`.
Staged copy: `/home/sbmaxx/ya-card-variants-20260924-01`.
Nginx configuration and the existing homepage were not modified.
