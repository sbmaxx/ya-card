# Visual refinement after the balanced baseline

## Preserved starting point

- Git commit: `077eba6`.
- Git tag: `ya-card-balanced-baseline-2026-09-24`.
- Source archive and exact HTML/gzip/Brotli files:
  `snapshots/2026-09-24-balanced-baseline/` (local, intentionally ignored by Git).
- Baseline HTML SHA-256:
  `1dcda768c88ce1db363600ec2a15f9ca75a6f9fd54ff7ec72b8506ffc0694f45`.
- Before editing, the local HTML was compared byte-for-byte with production.
- Only `webgl/` was committed; pre-existing root-project changes were excluded.

## Compared directions

All screenshots use the same camera, light, deterministic random parameters,
and typography content. No agents were used in this round.

| Direction | Logo | Name | Observation |
|---|---|---|---|
| Saved baseline | Raised light silver | 20px recessed | The logo loses contrast in a bright reflection. |
| `?study=satin` | Softer raised satin, cooler/darker | 21px, fine recess | Calmer than baseline; a viable lighter alternative. |
| `?study=inset` — selected | Darker metal, shallow cut | 21px, finer recess | Clearest logo at ordinary size and a consistent engraved treatment. |
| `?study=polished` | Light, slightly warm raised metal | 20.5px, slight raised edge | Too close to the plate in brightness; not selected. |

The final default uses the `inset` profile. Its restrained dark face improves
readability without adding red paint, a white outline or displaced letter copies.
The name is 5% larger on desktop; its bevel is narrower and shallower than the
saved baseline. Mobile title size remains 22px. Existing vertical balance,
contact layout, gestures and controls are preserved.

Rounded rim normals now interpolate continuously across adjacent segments,
and corner subdivision is slightly finer. This removes the small faceted light
steps without introducing a postprocessing pass or changing draw-call count.

## Reproduction and validation

`node webgl/design/render-studies.mjs` renders the saved source baseline and
three candidates to `snapshots/2026-09-24-visual-studies/`. It hosts temporary
local fixtures and closes its server/browser on completion. Test-only Playwright
defaults to the existing `/tmp/ya-card-browser-check` installation.

Inspected desktop, enlarged tilted and mobile screenshots for every direction.
`test/engraving.mjs` passes for negative-depth default logo/name and an explicit
positive-depth study: masks, UV basis, filtering, lighting and resource lifecycle.
`test/run-built-browser.mjs` passes for the single-file build, including keyboard,
pointer/touch controls, links, language/history, fallback and context recovery.

Materials are still lightweight shading approximations; the actual card surface
is rigid and planar. On very small or grazing text the relief fades to preserve
readability rather than forcing a subpixel outline.
