# Simplified contacts — independent gate

**PASS** for the root-confirmed frozen artifact
`ace480d4f70802aa3cae7f0389944f0dd09f939223c1b71bcfea3bc3ebe76b43`.
HTML 62,280 B; gzip 27,817 B; Brotli 24,605 B. Independent decompression of both
compressed files reproduces the exact HTML. No runtime edits, SSH or deployment
were performed by this judge; the previous historical audit is untouched.

Fresh command: `node /tmp/ya-card-simple-judge.mjs` from the project root.
The test loads only the built single HTML from a temporary localhost server and
uses installed Chrome plus external test-only Playwright. **6 checks PASS, 0 FAIL.**
Raw output: `/tmp/ya-card-simple-judge.log`; structured evidence:
`/tmp/ya-card-simple-judge-results.json` (includes the final artifact SHA).

| Requirement | Independent evidence | Result |
| --- | --- | --- |
| Three contact rows in both languages/layouts | Instrumented actual canvas `fillText`: desktop email 150, Telegram 166, site 198; mobile 278, 296, 332. RU site `rozhdestvenskiy.ru`; EN `rozhdestvenskiy.ru/#en`. Exactly five text draws per face: name, role, three contacts. | PASS |
| Four real anchors, correct keyboard mapping | Real Tab and Shift+Tab traverse logo→email→Telegram→site on RU and EN at both widths. All Enter activations yield trusted native clicks, cancelled in capture with preventDefault. Inactive face links remain inert/tabindex -1. GPU focus rectangles match the measured canvas text bounds for all three contacts. | PASS |
| Pointer mapping | Real ray-projected hover on Telegram and site yields pointer cursor and GPU underline; canvas click navigates to the correct intercepted target. All nonlocal network requests are blocked by default; the two expected targets are fulfilled locally. | PASS |
| HTML no-GPU/no-JS order and blank line | Both languages have only the four required anchors; email→Telegram top delta 20.796875 px and Telegram→site delta 41.59375 px for line-height 20.8 px, proving exactly one extra blank line. Both no-JS faces remain visible. Outside GitHub/Telegram overlays remain present. | PASS |
| Removed contacts absent | No `Льва Толстого`, `Lva Tolstogo`, `119021`, `739-70-00`, `data.address`, `data.phone`, or previous tel href in final built HTML. No GitHub anchor inside either face. | PASS |
| Preserve remaining appearance and interactions | App SHA unchanged: `09f8371d18952df3397743230bd507abffd43a7c19e2edb435e30443b514a031`. Pixel comparison against supplied previous screenshots: **0 changed pixels outside contact block**, desktop and mobile. Name, role, logo, card/engraving, background and overlays remain pixel-identical in deterministic reduced-motion baseline. Header baselines remain desktop 55/80 and mobile 187/212. | PASS |

The first candidate used primary ink for Telegram; the judge flagged this minor
unrequested change and the root requested its original secondary ink restored.
Final actual canvas colors are email/site `#20252b`, Telegram `#30353a`, in both
languages and layouts. The full compact gate was rerun on the final hash.

Final screenshot pixel-difference bounds are confined to the intended contact
area: desktop `[601,489,758,630]` (9,677 pixels changed); mobile
`[113,418,276,578]` (10,322 pixels changed). Conditions: 1440×1000 / 390×844,
DPR 1, reduced motion, `Math.random = () => .5`, mobile touch enabled only at 390.
Judge visually inspected desktop/mobile, site focus, and no-GPU screenshots:

- `/tmp/ya-card-simple-judge-1440-ru.png`
- `/tmp/ya-card-simple-judge-390-en.png`
- `/tmp/ya-card-simple-judge-390-en-site-focus.png`
- `/tmp/ya-card-simple-judge-noGPU.png`

No page errors or unexpected external resource requests occurred. The only
reported nonlocal requests were the two deliberately intercepted ray-click
targets, fulfilled in-process without contacting those services. Outside-webgl
file hashes/timestamps match the prior judge snapshot (58 files, 71 total
file/directory records; zero changes). Source scope remains `webgl/`. This is
the requested compact contact-layout gate; it does not claim a new full motion
or engraving audit beyond preserved app bytes, source review and pixel evidence.
