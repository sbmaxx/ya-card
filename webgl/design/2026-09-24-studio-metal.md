# Studio silver and a deeper background

Implemented the approved studio-metal plan without agents or regression suites.

- Portrait RU/EN wordmarks are centered at x95 in the 300-unit card. The logo
  mask and link share that position; name, role and contacts stay left-aligned.
  HTML fallback centers the brand only in its portrait layout.
- Plane brushing is horizontal, capped below 1% contrast and filtered out at
  small pixel footprints. Plate, engraved walls and rim use progressively
  narrower reflection lobes. Engraving depths and all type sizes are unchanged.
- Both bevels use two quarter-circle segments with shared endpoint normals.
  Half-thickness 0.022, bevel radius 0.008 and three WebGL draw calls are retained.
- The background uses the approved graphite palette, one broad light field,
  compositor translation bounded to 3vw/2vh and 4% brightness breathing.
  A static embedded SVG noise tile has 0.9% opacity. No external assets are used.
- The cool rim fill follows the background light. One projected SVG shadow
  uses a continuous height-direction gradient: 28% near, 10% far, 18% when flat,
  with a single 20px blur. Its filter bounds include 60px padding to avoid clipping.
- The touch safe-area mask stays on the stationary viewport container. All
  moving values come from the renderer's existing reduced-motion-aware clock.

One visual pass covered desktop/mobile RU/EN and changed light/tilt states.
Images: `snapshots/2026-09-24-studio-metal/`. The normal single-file build completed;
no test sets, new dependencies or extra controls were added.
