// Backdrops: a graphite cyclorama rendered with the card, lit by the same key
// light and receiving the card's real, blurred shadow. Colours are linear,
// except the page's own: `css` fills the page before the first frame, `edge`
// is the touch screen's flat frame and Safari's bars, `loader` is the colour
// of the loader's light (`glint` its bright core, white by default); `vignette`
// how far the room darkens towards the screen's edges (.55 by default). Plain
// data, so the build bakes them into the page.
export const BACKDROPS = {
    // A dark room with one warm spotlight behind the card, as jewellery is shown:
    // a black card stands out against the pool, its silver and edge lit.
    velvet: { title: 'Бархат', wall: [.008, .0074, .0068], floor: [.0025, .0023, .0021], pool: [.13, .112, .092], poolFalloff: 4.2,
        grain: .016, shadow: .88, roomBase: .008, bounce: .9, css: '#0a0908', edge: '#050404', loader: '#f6e3c4' },
    // The light theme's room: a warm paper sweep in soft daylight, velvet's
    // mirror. The walls are light, so the metal sees a bright room (roomBase);
    // the card's shadow, not a pool of light, sets it off; the edges darken
    // only a little, so the page stays light to the corners. The loader is a
    // dark line on it.
    paper: { title: 'Бумага', wall: [.60, .585, .555], floor: [.44, .43, .41], pool: [.20, .19, .17], poolFalloff: 2.2,
        grain: .010, shadow: .4, roomBase: .20, bounce: 1.9, vignette: .22,
        css: '#d9d6d0', edge: '#d3d0ca', loader: '#5b5147', glint: '#1d1a17' }
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
