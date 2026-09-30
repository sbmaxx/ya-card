# Handoff: the studio shader's compile time on Windows (Direct3D)

For an agent on the Windows machine that profiled rozhdestvenskiy.ru on 2026-09-30
(`webgl-profiling-2026-09-30.zip`, `webgl-retest-2026-09-30.zip`). The goal is to find
and commit a fix. Measure it on that machine; it is the only place the problem shows.

## The problem

Chrome on Windows runs WebGL through ANGLE's Direct3D 11 backend. ANGLE translates
GLSL to HLSL, and FXC (d3dcompiler_47, `ps_5_0`) compiles it.

The card's studio fragment shader is slow to compile on the RTX 5080 machine: Chrome 154,
driver 32.0.16.1714. All figures are the light theme, clean profile,
`--disable-gpu-shader-disk-cache`.

| Build | Loops | Studio program ready |
|---|---|---|
| 20260930-04 | lamps `i < 12` + break, samples `< 8` + break, brushing `< 7`, chamfer `< 8`, parallax `< 40` + break | **42.1 s** |
| experiment on -04 | samples, brushing, chamfer cut to 1 iteration (wrong image) | **4.2 s** |
| 20260930-07 (live now) | lamps `< uLightCount`, samples `< samples`, parallax `< int(layers)`; brushing 7 and chamfer 8 constant | **30.5 s** |
| **this commit** (not deployed) | every loop to a uniform: `uLoopCounts = (8, 7, 8, 40)`, lamps `< uLightCount` | not measured on Windows |

For comparison:
- the light-3D shader (`lite.js`) compiles in about 0.1 s there;
- the studio shader compiles in under 1 s on a Mac (Metal) and on Android.

**What users see now.**
- Auto mode (clean storage) starts the card on light 3D after `COMPILE_LIMIT` = 8 s, about 8.4 s after `card:create`.
- `?render=full`, or a saved `card-render=full`, skips that guard. It waits, and after 20 s of visible time the watchdog opens `/plain/?why=timeout&at=create`.

**Target.** The studio program compiles in about 2 s or less on that machine, in both themes. The frames stay identical and the frame time doesn't regress.

## Working hypothesis

FXC unrolls every loop whose trip count it can work out or bound, and it inlines every function into each copy.

- `samples` is `!nearInk ? 1 : footprint > .4 ? 8 : footprint > .15 ? 4 : 1`, so FXC can bound it at 8.
- `int(layers)` is clamped to 40.

`roomFor()` is the room's light: a bounce panel, the key, the strip, a loop over the lamps, and the orbit panel. It is inlined wherever a material is lit:
- `metal()`, `clearCoat()` and `gloss()` (two lookups);
- `tinted()`: gloss + anodised metal + clear coat;
- each letter process (`letteringCode`);
- the diamond cut;
- 7 times inside `brushed()`;
- 8 times in the chamfer loop.

Inside one lettering sample there are roughly 25–30 such copies. The 4.2 s experiment fits this picture: it removed the multiplication by the unrolled sample, brushing and chamfer loops.

This commit makes every loop run to a uniform count, so FXC cannot bound any of them. Check that first. If it isn't enough, cut the number of inlined `roomFor` copies (see "Candidate fixes").

## Code map (`webgl/`)

**`variants/renderer.js`** generates the GLSL at module init from the edition's look (`direction.look`) and the baked preset. Search by name, as line numbers move.
- `fragmentSource`, the studio shader:
  - `roomFor()`: the lamp loop;
  - `brushed()`: 7 taps;
  - `metal()`, `clearCoat()`, `tinted()`, `gloss()`;
  - in `main()`: the parallax march (`uLoopCounts.w`), the chamfer loop (`uLoopCounts.z`), and the lettering loop (`uLoopCounts.x`, `if (sampleIndex >= samples) break;`).
- `letteringCode()`: GLSL for each letter process.
- `uLoopCounts`: the comment above it explains the rule.
- `LOOP_COUNTS` (JS) sets it, in `uploadLights()`.
- `CardRenderer.create()`: compiles the passes and the card program, races the card against `COMPILE_LIMIT`, falls back to light 3D.
- `compilePrograms()`: polls `KHR_parallel_shader_compile`.
- `uniformSetter()`: supports float, vec2–4, mat3/4, int, ivec4 and samplers. Add a type there if you add one.

**`variants/lite.js`**: the light-3D shader, emitted as `card-lite-<hash>.js`.

**`variants/build.mjs`** builds:
- `dist/home/` (RU `/`, EN `/en/`; both themes in one page);
- `dist/lab/`.

**Themes.** An inline head script sets `data-theme` from localStorage `card-theme` (`light`, `dark` or `auto`), else from the system.
- Dark theme = Noir (`HOME_LOOK`); light theme = Steel (`LIGHT_LOOK` in `build.mjs`).
- The two themes generate different shaders: constants and letter processes differ. **Measure both.**

**Render mode.**
- `?render=full|lite` forces a mode for the load.
- localStorage `card-render` = the visitor's choice, which also skips the guard.
- localStorage `card-performance` = the probe's remembered decision.

**Start-up marks.**
- `card:create` → `card:compiled`: the compile stage;
- then `card:relief`, `card:probed`, `card:warm`, `card:ready`.
- `?stats=1` shows `compile N ms` in an overlay (top left).

## Getting the code and running it

### What you need

- **Git and Node.js 20 or later** with npm. The build was last run with Node 22.22 and npm 10.9.
- **Google Chrome.** The retest used Chrome 154.
- **For the offline compile** (see "Looking at what FXC gets"): `fxc.exe` from the Windows 10/11 SDK. It lives in `C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64\`. If it's missing, install the Windows SDK from the Visual Studio Installer (Individual components → Windows SDK), or find it with `winget search "Windows SDK"`.

### Get the code

The repository is public; no credentials are needed.

```powershell
git clone https://github.com/sbmaxx/ya-card.git
cd ya-card
git checkout codex/webgl-snapshot-20260924
git log --oneline -3      # the newest commit adds this file, or a later one
cd webgl
npm ci                    # esbuild, html-minifier-terser; acorn comes with them
```

Later, `git pull` in `ya-card` brings the owner's changes.

Work in `ya-card\webgl`:
- the shaders are `variants\renderer.js` and `variants\lite.js`;
- the build is `variants\build.mjs`;
- `dist\` is generated and ignored by git.

### Build and serve

```powershell
node variants/build.mjs                    # writes dist\home and dist\lab
npx --yes http-server dist -p 8765 -c-1    # or: python -m http.server 8765 --directory dist
```

There is no watcher: run the build again after every edit. The server picks up the new files at once, since `-c-1` turns its caching off.

Pages:
- `http://localhost:8765/home/` — the homepage, RU;
- `http://localhost:8765/home/en/` — EN;
- `http://localhost:8765/lab/` — the lab, not needed here.

Locally the language paths don't match production's `/` and `/en/`, so both pages start on the RU side. That doesn't matter here.

### Open it for a measurement

Use a fresh profile for every run, with the browser's shader cache off, as in your retest:

```powershell
$dir = "$env:TEMP\card-run-$(Get-Date -Format yyyyMMdd-HHmmss)"   # not $profile: that one is PowerShell's own
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="$dir" `
    --disable-gpu-shader-disk-cache --enable-privileged-webgl-extensions `
    "http://localhost:8765/home/?render=full&stats=1"
```

- **Mode.** `?render=full` measures the studio program: it skips the 8 s guard that would switch to light 3D.
- **Watchdog.** For runs longer than 20 s, disable it as in your retest (override `window.cardBootTimeout`). Otherwise the page leaves for `/plain/?why=timeout&at=create`.
- **Theme.** A fresh profile follows Windows' app mode (light or dark). To pick one, set `localStorage.setItem('card-theme', 'light')` (or `'dark'`) in DevTools and reload, or set it in the Playwright init script before load. **Measure both themes**: their shaders differ.
- **Compile time.** The overlay (top left, from `?stats=1`) shows `compile N ms`. Or in DevTools:
  ```js
  performance.getEntriesByName('card:compiled')[0].startTime - performance.getEntriesByName('card:create')[0].startTime
  ```
- **Your harness.** The Playwright scripts from your retest (`reproduce.cjs`) work against this server too: point them at `http://localhost:8765/home/` instead of the live site.

## Looking at what FXC gets

1. **Get the HLSL.** Launch Chrome with `--enable-privileged-webgl-extensions`. Then `gl.getExtension('WEBGL_debug_shaders').getTranslatedShaderSource(shader)` returns the HLSL that ANGLE generated. Save it for each variant.
2. **Compile it offline** with FXC from the Windows SDK. Match ANGLE's flags (optimization level, `ps_5_0`), and time it:
   ```powershell
   Measure-Command { fxc /T ps_5_0 /E main /O1 /Fc listing.asm shader.hlsl }
   ```
   The listing shows whether loops survive as `loop`/`endloop` or are unrolled into repeated blocks, and the instruction count. This loop takes seconds, not a browser round-trip.
3. **Check for retries.** ANGLE retries a failed compile with other flags ("skip optimization", "avoid/prefer flow control"), which multiplies the time. Look for it in Chrome's log: `--enable-logging=stderr --v=1`.

## Candidate fixes (in order)

**1. Loops to uniform counts (this commit).** Measure both themes first.

**2. Fewer inlined copies of the room light in the lettering loop.** Today one sample can emit, per region:
- the region's letter process (`letteringCode`);
- `tinted()` (gloss: two `roomFor`; anodised metal + clear coat: two more);
- the diamond cut: `metal()`.

On top of that:
- the wordmark evaluates two tints (the red Я and the rest);
- links use the body text's process in any region: the logo is a link, so its focus ring and underline need it.

A way to emit the code once: work out, per sample, a short list of materials to shade (the region's own; the Я's tint where `firstLetter > 0`; the link's where `linkMark > 0`). Then run one shared shading block in a loop to that list's length, and combine the results as the code does now. For the homepage looks all three regions use the same letter process (Noir: `ablate`, Steel: `vcut`, since the name and body are raised and take `look.logo`), so one process block with per-region parameters is exact.

**3. `brushed()` and the chamfer.** With uniform counts they are emitted once per call site. Check the listing.

**4. `if` flattening.** If FXC flattens the region branches (computes every region's code for every sample), restructure so they're real branches: uniform-per-pixel conditions, fewer live values across them.

**Hard rules:**
- GLSL ES 3.00.
- No derivatives inside loops: no `texture()` without Lod/Grad, no `dFdx`/`dFdy`/`fwidth`. They force FXC to unroll again, or fail.
- **No visual changes.** Don't lower samples, lamps, taps or quality without the owner's approval.
- Keep the code style: English, explanatory comments like the surrounding ones.
- Don't deploy or touch the server; commit on a branch.

## Checking that the frames are identical

Run in the page, after `webgl-ready`, with a seeded `Math.random`:
- the init script seeds it before load;
- the pose and the lights' phase come from `Math.random`.

Hash both faces in both themes, before and after a change, on the same machine. Windows hashes differ from the Mac's: compare Windows with Windows.

```js
// init script (before load):
localStorage.setItem('card-theme', 'light'); // or 'dark'
(() => { let s = 12345; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();

// after load (page opened with ?render=full):
async () => {
  for (let i = 0; i < 300 && !document.documentElement.classList.contains('webgl-ready'); i++) await new Promise(r => setTimeout(r, 200));
  await new Promise(r => setTimeout(r, 3000));
  const r = globalThis.__cardRenderer, gl = r.gl;
  const grab = async flipped => {
    r.time = 5; r.introTime = 10; r.intro = 1;
    r.draw({ rx: 0, ry: 0, rz: 0, zoom: 1, flipped, animate: false, reduced: true, delta: 1 / 60 });
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', px))].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  return [document.documentElement.dataset.theme, await grab(false), await grab(true)];
}
```

**Reference hashes on the Mac** (M3 Pro, Chrome, viewport 1728×1117 at DPR 2, so a 3456×2234 canvas) at this commit:
- light: `96ba624a047d84d3` / `b269b32445848676`;
- dark: `77910f6464a6c9ee` / `0c8e11a830d89096`.

Releases -05 to -07 give the same. The owner can re-check a fix on the Mac.

## Checking the frame time

Time the card's draw on the GPU (`EXT_disjoint_timer_query_webgl2`) over about 12 frames. Compare medians and minimums: GPU clocks make single frames noisy.

```js
async () => {
  const r = globalThis.__cardRenderer, gl = r.gl, ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const orig = Object.getPrototypeOf(r).drawCard, pending = [];
  r.drawCard = function (bloom, f, card) {
    if (bloom || pending.length >= 12) return orig.call(this, bloom, f, card);
    const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); orig.call(this, bloom, f, card); gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q);
  };
  for (let i = 0; i < 40 && pending.length < 12; i++) await new Promise(res => setTimeout(res, 120));
  await new Promise(res => setTimeout(res, 500));
  r.drawCard = orig;
  const ms = pending.map(q => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) ? gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 : null)
    .filter(v => v != null).sort((a, b) => a - b);
  return { median: ms[ms.length >> 1], min: ms[0] };
}
```

On the Mac this commit is within noise of -07: a median of 14–15 ms against 14 ms, while the machine was in use.

## What to deliver

1. Commits on a new branch (e.g. `windows-compile`) with the fix in `variants/renderer.js` (and `lite.js`, if needed). Rebuild with `node variants/build.mjs`; don't commit `dist/`.
2. A short report in this file or next to it:
   - the compile time per variant, both themes, clean profile;
   - the frame hashes before and after on Windows (both themes, both faces);
   - the frame time before and after;
   - what the FXC listings showed.

The owner reviews it, checks it on the Mac and phones, and publishes it. The server is not yours to change.

## Not in scope, for later

**Start on light 3D and crossfade to the studio when its shader is ready.** Then a slow compile never delays the first paint. It needs relief maps built in the background, a probe that doesn't draw into the visible frame, and a two-program crossfade (the second card drawn with `depthFunc(LEQUAL)` at a rising `uOpacity`). Only if the owner asks.
