# Independent contact-interaction audit

## Final verdict: PASS

Root confirmed the final frozen artifact:
`6c0f4534a3d4eaec4590e2ca8707e67409dd41d857d616c63b3d79571ec63af7`.
HTML 63,235 B, gzip 28,106 B, Brotli 24,849 B. Both compressed variants independently
decompress to the exact HTML; both PNG favicons and the embedded SIL OFL license
are present, with no external script or stylesheet tags.

All 13 checks in the independent judge script and all three freshly rerun
standard suites pass on this exact revision. Runtime was corrected by Luna;
judge made no runtime edits. Both initial P2 defects are resolved. No remaining
blocking findings were found within the specified Chrome desktop/mobile gate.

| Final requirement | Verdict | Fresh revision evidence |
| --- | --- | --- |
| 1: Active-face native Tab/Shift+Tab | PASS | Forward/backward real key presses across all six links on both faces; inactive descendants excluded. |
| 1: Visible focus attached to each link | PASS | All 12 desktop cues visually inspected. Email cue after 1440→390 resize equals a newly focused mobile email cue; corrected mobile screenshot inspected. No-derivatives shader cue also visibly inspected. |
| 1: Native hrefs and Enter | PASS | All 12 native Enter clicks are trusted; in-page capture prevents real navigation/calls/email. |
| 1: Focus holds pose and permits moving light | PASS | Matrix delta 0 while light delta 0.2022975229 after 500 ms. |
| 1: Language/history moves focus safely | PASS | Hashchange leaves outgoing face, clears GPU cue; Back/Forward retain no stale rectangle. Keyboard selection of EN also passes. |
| 2: Hover pose, underline, resumed motion | PASS | Held matrix delta 0; moving off link resumes with delta 0.1194139235. Trusted browser-viewport pointerleave now resumes with delta 0.0439114156 after 1.8 s. |
| 2: Existing controls/gestures | PASS | Final fresh built browser suite passes drag, pinch/tap, flip, background reset, language, keyboard and reduced-motion checks. Independent actual captured on-card drag, post-recovery drag, pinch scale 1→1.6666666269, capture cleanup and following flip also pass. |
| 2: Touch lacks hover locking | PASS | Touch pinch never sets GPU hover underline; mouse-only fine-pointer gate confirmed in source. |
| 3: No-GPU/context-loss native links and RU/EN/history | PASS | Same full native Tab/Enter RU/EN/RU/EN and Back/Forward loop separately in no-GPU and lost-context states; selected HTML face visibly switches. |
| 3: Native fallback wheel/touch | PASS | Actual wheel scrollY 240 and native touch scrollY 243 in both no-GPU and context-loss states. |
| 3: No-JS | PASS | Both static faces visible with six native links each. |
| 3: Context restoration, focus and gesture cleanup | PASS | Lose context during captured drag; capture/dragging cleared; native email focus survives restore with visible GPU rectangle; next drag changes pose. Additional EN mobile restore after history preserves visible email focus. |
| Additional: focus during asynchronous first initialization | PASS | Delay font-load completion, reach real email with Tab, release font gate; first ready rendering has correct visible email cue. |
| Invariant: unchanged appearance | PASS | Both final PNG screenshots exactly equal supplied production baselines byte-for-byte under specified desktop/mobile, DPR, reduced motion and deterministic random conditions. |
| Invariant: no new controls/dependencies/requests | PASS | Source inspection, identical baseline images, zero external requests and zero page errors across independent scenarios. |
| Invariant: single HTML/compression/favicons/license | PASS | Independent artifact byte/decompression checks above. |
| Invariant: outside-webgl user files protected | PASS with stated evidence limits | Independent scan found 58 files and all scanned directories outside webgl/node_modules/.git older than goal in ctime; no newSinceGoal entries. Final hashes and timestamps match judge snapshot. No pre-Luna SHA snapshot is claimed. |
| Invariant: no production actions by judge | PASS | Only temporary localhost server and installed Chrome; no SSH/deploy. |

Final independent logs: `/tmp/ya-card-judge-final-independent.log` and
`/tmp/ya-card-judge-final-results.json`. Corrected focus visuals:
`/tmp/ya-card-judge-final-focus-after-resize.png`,
`/tmp/ya-card-judge-focus-during-boot.png`,
`/tmp/ya-card-judge-restored-focus.png`, and
`/tmp/ya-card-judge-mobile-en-restored-focus.png`.
The initial failure screenshots were viewed and included in the tool transcript;
their original fixed filenames were overwritten by the successful rerun. The
initial JSON/logs below preserve the numerical failure evidence.

Final fresh commands (same working directory; external Playwright is test-only):

```text
PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/contact.mjs
PASS: active-face native anchors, focus cue and pose hold, Enter mailto/tel, RU/EN history, no-GPU/context-loss fallback, native wheel, no-JS faces, no external requests.

PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/run-built-browser.mjs
PASS: native WebGL, RU/EN, history, keyboard, drag, wheel, pinch/tap, reduced motion, raycast links, context recovery, no-JS/no-GPU fallback, no CDN; desktop/mobile screenshots saved to /tmp.

PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/engraving.mjs
PASS: engraving depth/sign, exact neutral normals, mask, front/back basis, mipmaps, lifecycle, no per-frame uploads, light response.

node webgl/reviews/2026-09-24-contact-judge.mjs
13 PASS / 0 FAIL; SHA-256 6c0f4534a3d4eaec4590e2ca8707e67409dd41d857d616c63b3d79571ec63af7
```

Final suite logs: `/tmp/ya-card-judge-final-contact.log`,
`/tmp/ya-card-judge-final-browser.log`, `/tmp/ya-card-judge-final-engraving.log`.
Final engraving evidence repeats initial expected result: wrongOutside 0 for both
faces, depth 255, changed shading pixels 3843/3690, changingResponse 3691, GL error 0.
Artifact SHA was checked again after all tests and remained identical to the
root-confirmed frozen hash above. Root-file hashes/timestamps still match the
judge snapshot. The original failures and initial test limitation below are
historical; all pending retests listed there were completed in this final gate.

## Initial verdict: FAIL — historical artifact rejected and superseded

Artifact reviewed: SHA-256 `478727fe353068c7b8b2851f034479ec4b3237db5bcd8f6912bc445afd537633`.
Fresh `node webgl/build.mjs` reproduced this exact digest: HTML 63,076 B,
gzip 28,071 B, Brotli 24,803 B.

This judge did not author or edit runtime implementation, deploy, or access
production. Runtime findings were sent to the root agent for Luna to fix.
The implementation's PASS report was not accepted as evidence; all commands below
were executed afresh. A later artifact needs a new explicit verdict.

## Blocking findings

1. **P2 — focused link loses its visible cue after a layout-changing resize.**
   `webgl/app.js:323-326` calls `renderer.resize()` without rebuilding the cached
   `focusRect` copied at `webgl/app.js:248-253`. Reproduction: focus RU email at
   1440×1000, then resize to 390×844 without changing focus. The shader receives
   `[0.55,0.3596330275,1.0229993771,0.3944954128]`; refocusing the same native
   email corrects it to `[0.2629803467,0.6055045872,0.7359797160,0.6403669725]`.
   The incorrect rectangle is drawn over the job title and clips beyond the card
   edge, while the actually focused email has no cue. This violates outcome 1's
   visible focus requirement. Judge visually inspected
   `/tmp/ya-card-judge-resize-stale.png` and
   `/tmp/ya-card-judge-resize-refocused.png`.

2. **P2 — leaving the browser viewport while hovering a link leaves pose frozen.**
   `webgl/app.js:289-296` clears `renderer.hoverPointer`/hover tilt but never
   clears `pointerOverLink`; the blur handler at lines 327-332 also omits it.
   Reproduction: actual mouse movement onto GPU GitHub link, then
   `page.mouse.move(-50,-50)`. Chrome delivered trusted pointerleave events to
   CANVAS, DIV, MAIN, BODY, HTML, and document. Hover underline disappears, but
   the model matrix is exactly unchanged (`max absolute delta = 0`) after
   1.8 seconds. Outcome 2 requires motion to resume after leaving the link.

## Requirement-by-requirement evidence for initial artifact

| Requirement | Verdict | Independent evidence |
| --- | --- | --- |
| 1: Native Tab and Shift+Tab reach only six active-face anchors | PASS | Actual keyboard traversal forward through company/tel/email/site/t.me/GitHub and backward through each in both RU and EN. Inactive face anchors have tabindex -1 and inert ancestor. |
| 1: Clearly visible GPU cue on every link | FAIL overall | Twelve desktop focus screenshots visually inspected; ordinary focus is correct for all links, including logo. Layout-changing resize produces finding 1. |
| 1: Preserve real hrefs and native Enter | PASS | All 12 Enter activations yield `isTrusted: true`; capture listener cancels default before navigation. No mail, calls, or messages launched. |
| 1: Focus freezes pose while light can move | PASS for ordinary focus | Independent matrix equality and moving-light check executed before the following hashchange assertion. Full corrected transition check pending rerun; see test note below. |
| 1: Safe language change and hidden-face descendants inaccessible | PASS for tab order; transition retest pending | Both language native keyboard loops pass, inert/tabindex checked, existing fresh contact/browser suites pass history. Independent hashchange test initially overconstrained focus to `.scene`, although body is a safe browser fragment-navigation outcome. Corrected test checks absence of outgoing-face focus and stale GPU rectangle. |
| 2: Pointer link hover holds pose and preserves underline | PASS | Actual ray-projected link hover: held matrix delta 0; light continues. Moving to another in-viewport point changes matrix by 0.1193097718. |
| 2: Leaving link resumes smoothly | FAIL | Ordinary in-viewport leave works; actual browser-viewport exit leaves matrix stuck, finding 2. |
| 2: Drag, pinch, flip, background reset, language, reduced motion | PASS existing suite and captured drag | Fresh built browser suite passes all named regressions. Independent real on-card drag has pointer capture and dragging class; context loss releases both, restoration allows a second drag with matrix delta 0.0733007919. Stronger pinch scale assertion queued for final rerun. |
| 2: Touch does not get hover locking | PASS static implementation; behavioral retest pending | Hover lock is gated on pointerType mouse plus fine-pointer media. Independent explicit touch scale/hover check added for final rerun. |
| 3: No-GPU native contacts, RU/EN, Back/Forward | PASS | Independent no-GPU mobile test traverses and activates every active anchor across RU/EN/RU/EN and history. Only chosen face visible. |
| 3: Context-loss contacts and history | PASS basic recovery; extended history retest pending | Fresh suite verifies fallback contacts and recovery; independent context loss during captured drag verifies native trusted email activation. Extended RU/EN/history loop in lost-context state added for final rerun. |
| 3: Native wheel/touch in fallback | PASS no-GPU | Actual wheel advances scrollY to 240; CDP native touch swipe advances scrollY to 243. Existing suite additionally checks uncancelled lost-context wheel. Extended actual lost-context wheel/touch queued. |
| 3: Coherent fallback language and no-JS both sections | PASS | Real language switching and history visibility; independent JavaScript-disabled page exposes both sections with six links each. |
| 3: Restore GPU/focus without captured gestures | PASS | Lose context during captured drag, capture released, focus email in fallback, restore, native email retains focus with positive uFocusRect. Real next drag works. Restore focus screenshot saved. |

## Invariants

- **Appearance PASS:** 1440×1000 desktop and 390×844 touch/mobile, DPR 1,
  reducedMotion `reduce`, `Math.random = () => .5`. Fresh screenshot PNGs are
  byte-for-byte identical to both supplied production baselines: desktop
  598,737 bytes; mobile 134,751 bytes. These comparisons cover content, geometry,
  silver/engraving appearance, lighting, background, and existing controls in
  the specified deterministic state.
- **No new runtime requests/dependencies/controls PASS:** independent request
  capture recorded no external requests and no page errors; reviewed HTML,
  CSS, app and renderer. No new controls or external font/CDN dependency.
- **Single artifact and licensing PASS:** fresh build successfully produces one
  HTML plus gzip/Brotli, with decompression equality checked by build. Build and
  HTML retain both favicon data attributes and embedded Onest OFL license.
- **Scope/protection:** judge edits only its own test/report under `webgl/reviews/`.
  Root project initially contains user changes; no pre-Luna hash snapshot was
  available. Root reported matching initial/current git status and all 58
  outside-webgl files predating the goal in both ctime/mtime. Independent
  filesystem audit is recorded in `/tmp/ya-card-judge-root-files.json`; this is
  timestamp/tree evidence, not an invented before/after hash comparison.
- **No production action PASS:** local localhost tests only. No deploy or SSH.

## Fresh commands and outputs

Commands run from `/Users/sbmaxx/Development/ya-card`:

```text
node webgl/build.mjs
HTML 63076 B | gzip 28071 B | Brotli 24803 B
SHA-256 478727fe353068c7b8b2851f034479ec4b3237db5bcd8f6912bc445afd537633

PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/contact.mjs
PASS: active-face native anchors, focus cue and pose hold, Enter mailto/tel, RU/EN history, no-GPU/context-loss fallback, native wheel, no-JS faces, no external requests.

PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/run-built-browser.mjs
PASS: native WebGL, RU/EN, history, keyboard, drag, wheel, pinch/tap, reduced motion, raycast links, context recovery, no-JS/no-GPU fallback, no CDN; desktop/mobile screenshots saved to /tmp.

PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/engraving.mjs
PASS: engraving depth/sign, exact neutral normals, mask, front/back basis, mipmaps, lifecycle, no per-frame uploads, light response.

node webgl/reviews/2026-09-24-contact-judge.mjs
FAIL: focused email after crossing layout breakpoint matches freshly focused email
FAIL: leaving browser viewport while hovering link releases pose
```

Engraving: wrongOutside = 0 both faces, covered = 47808/46404, depth = 255,
light-response changed pixels = 3843/3690, changingResponse = 3691, GL error = 0.
Logs: `/tmp/ya-card-judge-contact.log`, `/tmp/ya-card-judge-browser.log`,
`/tmp/ya-card-judge-engraving.log`, `/tmp/ya-card-judge-initial-independent.log`,
and `/tmp/ya-card-judge-initial-results.json`.

The first localhost attempt was blocked by filesystem sandbox network binding
(`listen EPERM 127.0.0.1`); approved escalation then ran the local tests normally.
No test result is inferred from that environmental failure. The judge test's
initial strict `.scene` focus assertion after fragment navigation was a test
assumption, not an implementation defect; it is corrected for the final run.
