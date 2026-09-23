# Contact interaction implementation

Implemented the contact interaction plan in `webgl/`.

The six real links on the active face now remain in the native Tab order. The
inactive face is `inert`, has no tabbable links, and loses keyboard focus safely
when the language changes. The focused link's bounds are drawn on the matching
card face with the current finish ink color. Focus and pointer hover over a card
link hold the card pose while the light continues to animate; leaving the link
returns pointer tilt through the existing eased motion. Link hover underlining
continues while the pose is held. The focus shader has a fallback path when
`OES_standard_derivatives` is unavailable.

Focused-link bounds are rebuilt from the active native anchor whenever the card
surfaces change size, and are refreshed before the first frame after context
restoration. Scene/document pointer leave and window blur clear the pointer-only
hold, while a keyboard-focused link keeps its own pose lock.

When WebGL initialization fails or its context is lost, JavaScript fallback
shows the selected language face with native links, a working language switch,
history navigation, normal wheel scrolling, and native touch scrolling. On
context loss, pending pointer capture is cleared. Context restoration keeps the
focused link and draws its focus cue on the first restored frame. With JavaScript
disabled, both static language sections remain visible.

Added `test/contact.mjs` for active-face Tab order across all six links, the
specific `uFocusRect` uniform, pose stability during focus and hover, resumed
tilt after pointer leave and window blur, focus-rectangle bounds after desktop /
portrait / desktop resize, trusted Enter activation of `mailto:` and `tel:`
links, RU/EN history, no-GPU and context-loss fallback, native wheel and touch
scrolling, no-JS faces, and absence of external requests. Added
`test/run-built-browser.mjs` to run the existing browser suite against the
single-file build on a temporary localhost server.

Verification from the workspace:

- `node webgl/build.mjs` — PASS. Updated artifact SHA-256: `6c0f4534a3d4eaec4590e2ca8707e67409dd41d857d616c63b3d79571ec63af7`. Output: 63,235 B HTML, 28,106 B gzip, 24,849 B Brotli.
- `PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/contact.mjs` — PASS.
- `PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/run-built-browser.mjs` — PASS. Runs `test/browser.mjs` with `ARTIFACT=1` and a localhost `CARD_URL`; covers desktop/mobile, gestures, reduced motion, context recovery, no-JS/no-GPU, and external requests.
- `PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/engraving.mjs` — PASS. Engraving mask, depth, shading, lifecycle, and GL error checks passed.
- Inspected `/tmp/ya-card-final-desktop.png`, `/tmp/ya-card-final-mobile.png`, and `/tmp/ya-card-contact-focus-desktop.png`. Layout and card treatment remain stable; the logo focus cue is visible in the current monochrome ink color.

No remaining implementation failures found. Production deployment and independent
judge review remain with the root agent.
