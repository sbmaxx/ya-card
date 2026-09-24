# Perceptible idle movement and deeper engraving

The preceding version is commit `36b2273`; source and exact HTML are retained
in `snapshots/2026-09-24-before-idle-relief/`. This work uses no agents.

## Causes and changes

- The previous idle angles were small and slow. Overlapping smooth X/Y arcs,
  stronger roll and vertical float make the plate visibly move without input.
  Portrait and landscape amplitudes are bounded separately; the portrait fit
  reserves four more pixels on each side for the larger motion.
- A stationary mouse over a link used to freeze the pose indefinitely. Hover
  now holds it for 1.8 seconds after the last mouse movement, then idle resumes.
  Keyboard focus remains a stable click target until focus leaves.
- Holding a link no longer writes the current idle angle into the user's base
  rotation, avoiding accumulated pose offsets after repeated hover/focus.
- The studio source travels farther, including depth, over 14–20 seconds.
  Its reflection and cast shadow still use the same position.
- `sculpted` increases the name's bevel/depth to 0.70/0.38 layout pixels and
  the logo's to 1.20/0.72. The inner facets have stronger light/dark separation;
  the role and contact text remain flat. The glyph silhouette is unchanged.

## Evidence

`test/idle-motion.mjs` measures the running single-file app with no input and
compares the optional saved baseline. At a fixed random seed, during the first
4.5 seconds, yaw range increased from about 3.7° to 10.2° on desktop, 8.7° on
portrait phones and 6.2° in landscape. The test also checks all three rotation
axes, light travel, actual mesh bounds during that interval, pointer-hold expiry,
continued keyboard hold, and stopped rendering with reduced motion.

Contact, built-browser, engraving and four-size mobile suites passed. The
touch regression fixture's former y=160 tap was on the old top border; it now
taps the roomy blank interior at y=210. Outside-card taps still reset rather
than flip. Geometry-based link and boundary checks remain in the mobile suite.

Visual comparison: `snapshots/2026-09-24-sculpted-study/`, including mobile,
enlarged tilted views and a second light position. Relief remains a normal-map
approximation inside the existing lettering. No per-frame texture updates,
additional draw passes or runtime requests were added.
