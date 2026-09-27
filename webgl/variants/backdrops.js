// Backdrops: a graphite cyclorama rendered with the card, lit by the same key
// light and receiving the card's real, blurred shadow. Colours are linear,
// except the page's own: `css` fills the page before the first frame, `edge`
// is the touch screen's flat frame and Safari's bars, `loader` is the colour
// of the loader's light. Plain data, so the build bakes them into the page.
export const BACKDROPS = {
    // A dark room with one warm spotlight behind the card, as jewellery is shown:
    // a black card stands out against the pool, its silver and edge lit.
    velvet: { title: 'Бархат', wall: [.008, .0074, .0068], floor: [.0025, .0023, .0021], pool: [.13, .112, .092], poolFalloff: 4.2,
        grain: .016, shadow: .88, roomBase: .008, bounce: .9, css: '#0a0908', edge: '#050404', loader: '#f6e3c4' }
};
// The only backdrop now: every edition and every old link opens on it.
export const DEFAULT_BACKDROP = 'velvet';

// The page's colours for a backdrop as CSS custom properties (see the page
// CSS in build.mjs): baked into the page for its own backdrop, set at start
// for another one (the lab, exported files).
export const pageColours = backdrop => ({
    '--page': backdrop.css,
    '--edge': backdrop.edge,
    '--loader': backdrop.loader.match(/\w\w/g).map(hex => parseInt(hex, 16)).join(' ')
});
export const applyPageColours = backdrop => {
    for (const [name, value] of Object.entries(pageColours(backdrop))) document.documentElement.style.setProperty(name, value);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', backdrop.edge);
};
