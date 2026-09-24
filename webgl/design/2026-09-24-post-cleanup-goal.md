# Visual work after contact cleanup

## Published starting point

The user's requested cleanup is published as release `20260924-13`:
no website row on either face, no GitHub corner link, and vertical balance
measured through the final Telegram row. Email, Telegram and the logo remain
the three card links on every layout. Contact and mobile checks passed, and
public Brotli bytes matched the build. A live browser confirmed both languages.

- Commit: `32b5261`.
- Tag: `ya-card-clean-layout-2026-09-24`.
- Exact build/source archive: `snapshots/2026-09-24-clean-layout/`.
- Public HTML SHA-256: `26e78505f7fa88042e2e6ebf0c92589429cdbb7862cac118edcc462ad48dbec0`.

This round continues the visual work through successive comparisons. No agents
were used.

## First comparison: portrait proportions

Compared 300×545, 300×500 and 300×460 after removal of the website row.
The compact version removes unused plate area while preserving the displayed
size and position of the text on a tall phone. Selected 300×460 as the default.
The old sizes remain available through `?proportion=tall` and
`?proportion=balanced` for comparison.

Evidence: `snapshots/2026-09-24-proportions/`, RU and EN.

## Second comparison: thickness and bevel

The old edge looks like a thick slab at a 76° yaw. Compared half-thickness/bevel
0.055/0.018, 0.032/0.012 and 0.022/0.008. Selected the thinnest candidate:
the rim retains its highlight while the face loses the heavy border.
Old alternatives are accessible with `?edge=standard` and `?edge=soft`.

Evidence: `snapshots/2026-09-24-edge-studies/`, normal/detail/side/back views.
The browser link test now reads actual mesh dimensions instead of assuming
the previous portrait width and thickness.

## Third comparison: logo optics

Compared `milled`, `etched` and `satin-etch` on ordinary and DPR-2 rendering,
including a short phone, English lettering and another light position. Selected
`etched`: a darker floor, a narrower 0.90px bevel at 0.36px depth, and a more
concentrated polished reflection. The ordinary-size mark stays clear, without
the earlier pronounced light outline. The name remains quieter and matte-filled.

Evidence: `snapshots/2026-09-24-logo-optics-1x/`,
`snapshots/2026-09-24-logo-optics-2x/`, and
`snapshots/2026-09-24-optics-final/`. DPR-2 captures use CSS-scale screenshots
to compare the same visible size. Also inspected a strong tilt and the back rim.
These are browser-emulated densities, not physical-device measurements.

## Build correction discovered during validation

The first built-page run failed to reach WebGL. Diagnostic parsing found
`</body>` inside the minified JavaScript: string replacement interpreted the
`$&` prefix of a minified `$&&` expression as its own replacement token.
Generated CSS, JavaScript and license text are now inserted with callbacks,
and every inline JavaScript block is parsed after final HTML minification.
The failed artifact was never published. The corrected artifact was checked
again in the browser; the initial failure remains in the task history.

## Final verification and publication

The cleanup tag/archive remains the rollback point. The selected compact/thin
geometry passed mobile bounds, both language margins, links, touch flip and
core browser checks. The final logo passed the engraving masks, signed-depth,
front/back normals, light-response and no-derivatives checks. The corrected
single-file artifact passed contact, built-browser and four mobile-layout
checks, and is published as release `20260924-14`. Public Brotli bytes match
the tested local file. HTML SHA-256:
`d86a8afb9d9c415de5fad5ee08dbbadca35c948ac2e0c8b2b3d9a4a2be48f6eb`.
