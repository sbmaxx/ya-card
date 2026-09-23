# Simple contacts implementation — 2026-09-24

- Card contacts are email, Telegram, one blank line, then the personal site. Phone, address, and card GitHub links are removed; the company links and outer GitHub/Telegram overlay remain.
- Texture baselines: desktop `150 / 166 / 198` and mobile `278 / 296 / 332` (email / Telegram / site). Size 12; line height 16 desktop and 18 mobile.
- Telegram keeps the original secondary ink; email and site use name ink.
- Face anchors and `surfaces.links` match in order: logo, email, Telegram, site. EN keeps `https://rozhdestvenskiy.ru/#en`.
- `node webgl/build.mjs`: passed. Artifact SHA-256: `ace480d4f70802aa3cae7f0389944f0dd09f939223c1b71bcfea3bc3ebe76b43`.
- `contact.mjs`: passed four-anchor order, native Tab/focus/Enter, hover, RU/EN, fallback, and absence of address/phone from built HTML. `run-built-browser.mjs`: passed RU/EN, gestures, Telegram raycast, context recovery, no-JS/no-GPU fallback, desktop/mobile.
- Screenshots: `/tmp/ya-card-final-desktop.png`, `/tmp/ya-card-final-mobile.png`, `/tmp/ya-card-final-mobile-en.png`.
