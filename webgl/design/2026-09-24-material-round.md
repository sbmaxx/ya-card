# Polished engraving on satin silver

## Starting point

The exact public HTML was downloaded and compared with the local build before
editing. Source commit `a40125736d88ff8801a8022fbcb277415ab29261` is preserved as
`ya-card-inset-baseline-2026-09-24`. The local, Git-ignored archive
`snapshots/2026-09-24-inset-baseline/` contains source, HTML, gzip, Brotli and a
SHA-256 manifest. Its HTML hash is
`52b551d93a5db43a5ea73bae5c4c85bb09f40d490c45f86f5754fe707da5a559`.

No agents were used. Changes are limited to `webgl/`.

## Visual decision

The preceding logo was legible but its nearly uniform gray surface read more
like print. Three new directions were compared with the saved baseline at the
same pose, light, viewport and random seed:

| Study | Treatment | Decision |
|---|---|---|
| `cut` | Cooler polished recess, stronger inward bevel, 22px name | Selected: clear depth without changing the wordmark or adding color. |
| `emboss` | Lighter, slightly warm raised logo, 21.5px name | Retained as an optional URL study; looks more like an applied metal badge. |
| `smoke` | Darker recess, 22.5px name | Retained as an optional URL study; stronger type hierarchy but a heavier mark. |

The logo floor now has its own compact reflection from the same moving source
as the plate. Its bevel uses the actual signed normal map and interior coverage;
there is no extra offset text, silhouette expansion or external drop shadow.
Fine tooling marks fade before becoming subpixel, and are disabled when WebGL
derivatives are unavailable. The smaller portrait logo scales bevel width and
depth together to keep the contour quieter.

The desktop name increases from 21px to 22px. Name relief stays subtler than the
logo so ordinary reading is comfortable; role and contacts remain matte. Email
and Telegram now use the same dark ink. Existing contact content, card dimensions,
vertical balance, gestures, background and language controls are preserved.

## Evidence

Reproduce candidate screenshots:

```sh
STUDY_BASELINE=snapshots/2026-09-24-inset-baseline/source.tar.gz \
STUDY_OUTPUT=snapshots/2026-09-24-material-studies \
STUDIES=baseline,cut,emboss,smoke \
node webgl/design/render-studies.mjs
```

Final selected views are in `snapshots/2026-09-24-material-final/`: desktop,
enlarged tilted card, mobile, both English layouts and a second light position.
Inspected all six selected views. The result remains a lightweight shader
approximation of shallow machining, not a displaced solid letter mesh.

`test/engraving.mjs` checks depth sign, exact unchanged masks outside lettering,
front/back normal bases, response to opposite light positions, texture lifecycle
and the shader without OES derivatives. `test/run-built-browser.mjs` checks the
single-file artifact's interactions, languages, links, fallbacks and WebGL recovery.
Mobile screenshots use Chromium; this round does not claim a physical iPhone or
mobile battery-performance measurement.
