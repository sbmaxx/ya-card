# Stable desktop readability

Desktop sizing used a fixed vertical field of view, so the card's pixel size
grew with viewport height. The desktop camera now has a fixed CSS-pixel focal
length: the wide card is approximately 760×420 px, with 18px contacts and a
31px name. A narrow desktop layout uses a 400px portrait card. Touch devices
retain the responsive fit. Constrained desktop windows scale down only to
fit the available space and leave room for idle motion and the footer.

The same projection is used by drawing, pointer rays and shadow projection.
Manual zoom still multiplies the base size. HTML fallback uses larger desktop
type and a flow layout so wrapping cannot overlap the contact block.

`test/desktop-size.mjs` measured 760.28×419.99 CSS px at 1024×768, 1440×900,
1920×1080, 2560×1440 and 3840×2160. Center-relative vertices in a tilted pose
also matched within 0.1px. The 900×500 and 800×600 cases shrink to fit; narrow
desktop windows 500×900 and 600×1200 keep the same approximately 400px width.
The test also checks actual ray hits and manual zoom after each resize.

Contact, built-browser, mobile-layout and idle-motion checks cover interaction
and footer clearance with the changed camera. Screenshots are retained locally
at `/tmp/ya-card-fixed-1440.png` and `/tmp/ya-card-fixed-2560.png`.
