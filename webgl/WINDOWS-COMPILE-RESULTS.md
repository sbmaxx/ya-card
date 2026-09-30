# Windows studio shader compilation

Starting point: `da7c6fa`, `codex/webgl-snapshot-20260924`, with all existing loops already bounded by uniforms. Work is on `windows-compile`. No deployment or live-server changes. The owner accepted a 5–10 s checkpoint and asked to continue optimizing.

Final: **4.480 s light / 2.351 s dark**, versus **18.647 s / 16.574 s** for this source baseline. Both faces in both themes match the Windows baseline byte for byte at the tested pose. Paired GPU draw time improves by about 30% light and 50% dark. The original ~2 s goal has not been reached in both themes; these are measured results, not an upper bound.

## Changes and commits

`6d0214d` saves the intermediate point: a uniform-bounded four-job loop shares `tinted()` across body, wordmark, initial and name. It measured 5.675 s light / 8.820 s dark. Subsequent paired measurements of descendants revealed extra GPU work from this broad loop, so it is not the final approach.

The subsequent renderer change replaces that broad loop with:

1. GLSL constants for immutable home/export preset tint, finish, opacity and plate finish. Editable lab settings remain uniforms. Float literals use the same float32 rounding as uniform upload. Tint conversion is shared with runtime settings. Theme changes already reload the page.
2. One `room(n, 1.0)` diffuse-light evaluation before the lettering sample loop. The face normal and lookup do not vary between samples. Gloss, ablation and annealing reuse it, retaining their arithmetic order.
3. A uniform-bounded two-job loop for the wordmark and initial only. Body and name retain direct tint evaluation. Predicates and the final blend are kept.

No lights, samples, brushing taps, parallax layers or quality levels were reduced. `lite.js` is unchanged. `dist/` is rebuilt and not committed.

## Clean-profile compile measurements

Times are `card:compiled - card:create`, not whole-page readiness. `KHR_parallel_shader_compile` polling has approximately 16 ms granularity. The card program's link-to-observed-ready interval differs by less than 2 ms. All runs used local files and fresh Chrome processes/profiles.

| Variant / artifact labels | Light, s | Dark, s |
| --- | ---: | ---: |
| Baseline (`baseline-*-01`) | 18.647 | 16.574 |
| Baseline repeat (`diffuse-light-01`; edit had not applied) | 18.865 | — |
| Diffuse hoist alone (`diffuse-light-02`) | 11.069 | — |
| Saved four-tint checkpoint (`tint-loop-*-01`) | 5.675 | 8.820 |
| Checkpoint + shared brushed (`brush-loop-*-01`) | 4.997 | 8.019 |
| Shared material process (`material-loop-*-01`) | 4.570 | 5.121 |
| Shared panel loop (`panel-loop-light-01`) | 7.232 | — |
| Shared anodised reflection (`anod-light-01`) | 4.673 | — |
| Shared dark ablation (`ablate-dark-01`) | — | 4.134 |
| Fixed preset + broad jobs (`fixed-light`) | 3.413 | — |
| Fixed preset, direct calls (`fixed-only-*`) | 8.730 | 4.323 |
| Fixed preset + shared brushed (`fixed-brush-light`) | 8.860 | — |
| Fixed preset + constant gloss (`fixed-gloss-light`; rejected) | 8.502 | — |
| Fixed preset + wordmark loop (`logo-loop-light`) | 7.446 | — |
| Fixed preset + diffuse hoist (`fixed-diffuse-light`) | 4.783 | — |
| Final combination, first light run (`fixed-diffuse-logo-light`) | 4.429 | — |
| Final verification (`candidate-*-01`) | **4.480** | **2.351** |

`run-summary.json` includes every run, including additional active-job/opaque-path experiments and paired repeats. Each run contains exact GLSL/HLSL and input HTML. The 3.413 s broad-job candidate had about 5% higher paired GPU time than baseline and was not selected. Constant gloss failed paired pixel equality on both light faces and was rejected. Shared brushed/panel changes did not offer a useful additional reduction in the selected approach.

## Windows frame hashes

SHA-256 of the full 1440×900 RGBA framebuffer, DPR 1, seed 12345, time=5, intro=1, introTime=10, reduced motion, front/back. Baseline and final match as standalone captures and when switched in the same GL context.

| Theme / face | Baseline = final |
| --- | --- |
| Light / front | `b244ae0ada73427b8bff65465e702789d68486bdeeb0e24894535c9365051b99` |
| Light / back | `0d2a267231e3dece160eb4f825a2a6392ef3c16a9f23dcf4cd6df159145a1f45` |
| Dark / front | `e7b6fa0803d7802275bc667e21bfac3f901b4a982f8b6b60b5762a471cbd052f` |
| Dark / back | `85419b517541e18f098fd7a16956134f9b3e87e336cbf6011ab29b87a7891758` |

Early captures were taken immediately after readiness. Several light-back captures differed by six 8-bit channels by one level, including an experiment with unchanged normalized shader code; warmed same-context comparisons matched. The checkpoint report attributed the first discrepancy to the diffuse change; that attribution was not established and is corrected here. Final verification waits the handoff's three seconds, awaits layout, and also performs a paired comparison. Raw early captures are preserved.

## Paired GPU time

`EXT_disjoint_timer_query_webgl2`, main-resolution `drawCard` only, excluding bloom passes. Reference and candidate alternate order in six batches of twelve queries per face: 72 samples per program per face, eight warm-up draws per batch. Same renderer, textures, uniforms and fixed pose; disjoint=false. This controls clock variation better than early spaced sixteen-query runs.

| Theme / face | Baseline median / min, ms | Final median / min, ms |
| --- | ---: | ---: |
| Light / front | .167648 / .146688 | .117728 / .102272 |
| Light / back | .155424 / .141280 | .107424 / .095808 |
| Dark / front | .164096 / .146016 | .082208 / .076640 |
| Dark / back | .161088 / .142080 | .078912 / .069664 |

These are card draw times at the tested desktop resolution, not end-to-end frame latency or a prediction for phones. Every query and batch order is in `candidate-*/result.json` under `paired`.

## FXC listings and diagnosis

`WEBGL_debug_shaders` exported ANGLE HLSL. `tools/windows-fxc.ps1` extracts the final compiler-input section and invokes installed `d3dcompiler_47.dll` 10.0.26100.9457: `D3DCompile`, entry `main`, target `ps_5_0`, flags 0 (/O1), then `D3DDisassemble`. No SDK installation is required. Chrome does not expose its exact flag list here; this is an explicit offline comparison, not a claim of byte-identical browser flags. Offline compilations ran sequentially.

| Theme / version | Offline /O1, s | Instruction slots | `loop` instructions | DXBC bytes |
| --- | ---: | ---: | ---: | ---: |
| Light baseline | 18.987 | 5803 | 31 | 185116 |
| Light checkpoint | 5.830 | 4506 | 20 | 145312 |
| Light final | 4.491 | 3470 | 17 | 113056 |
| Dark baseline | 15.648 | 6326 | 36 | 201156 |
| Dark final | 2.405 | 3171 | 14 | 103664 |

Loops already survive in the uniform-bounded baseline. The remaining problem is duplicated lighting and irrelevant material paths at inlined call sites, not simply every loop being unrolled. Fewer live branches and repeated room evaluations shrink FXC's optimization problem. Offline times track browser times closely.

All offline compilations succeed in one call. Baselines/checkpoint have the existing X4000 potentially-uninitialized `f_brushed` warning. Final light has no warnings. Final dark emits X4008 for `_c / _l` in `metalTint` when `_l` is constant zero in an unused tint path; the division remains guarded by `_l > 1e-4` in exported HLSL. Diagnostics are preserved verbatim. Chrome verbose logs contain no observed retry diagnostic; that does not prove this Chrome build logs every retry. No retry was needed by the offline API.

## Reproduction and delivery

Chrome 154.0.8037.58, Windows, RTX 5080, ANGLE D3D11, NVIDIA 32.0.16.1714. Node 24.19; locked dependencies installed with npm 10.9.3 `ci`.

```powershell
node variants/build.mjs
# Playwright may be external; PLAYWRIGHT_MODULE can name its absolute path.
# First build the baseline in a separate checkout and retain shader-9.glsl.
$env:WINDOWS_REFERENCE_SHADER = 'C:\results\baseline-light-01\shader-9.glsl'
node tools/windows-profile.cjs unique-light light dist C:\results
$env:WINDOWS_REFERENCE_SHADER = 'C:\results\baseline-dark-01\shader-9.glsl'
node tools/windows-profile.cjs unique-dark dark dist C:\results
./tools/windows-fxc.ps1 -InputHlsl C:\results\unique-light\shader-9.hlsl -OutputPrefix C:\results\unique-light\fxc-o1
```

Each run serves local files on an ephemeral loopback port. Fresh profile, HTTP cache disabled/cleared, shader disk cache disabled, service workers blocked, forced `?render=full`. System-wide driver caches were not deleted. The watchdog is cancelled through its timer property; the local HTML response exposes the renderer. These are instrumentation changes, not product changes. The reference shader for paired testing compiles after the candidate startup timing.

The package retains per-run environment metadata, original HTML, GLSL/HLSL, timestamped events, Chrome logs, raw RGBA, screenshots, GPU samples, and FXC input/listings/bytecode/diagnostics where measured. It also includes this report, experiment source snapshots and a Git bundle.

Final source checks: `node variants/build.mjs`, `git diff --check`. Both home themes and faces pass the described Windows comparison. Arbitrary lab combinations, hover/focus states and all orientations are not exhaustively tested. Owner verification on Mac and phones remains required before publishing, as requested in the handoff. No publication was performed.
