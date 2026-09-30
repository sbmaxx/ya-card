// Backdrops: an even fill rendered with the card, receiving its real, blurred
// shadow; one per theme. Colours are linear, except the page's own: `css`
// fills the page before the first frame, `edge` is the touch screen's flat
// frame and Safari's bars, `loader` is the colour of the loader's light (`glint` its bright core, white by default), `chip` the
// theme control's backing; `vignette` how far the room darkens towards the
// screen's edges (.55 by default). Plain data, so the build bakes them into
// the page.
export const BACKDROPS = {
    // The dark theme's room: an even warm graphite, a little lighter than the
    // black card, so the card stands on it as a silhouette with its shadow.
    // One flat colour, which the page, Safari's bars and the scene share.
    velvet: { title: 'Тёмный', wall: [.05199, .04352, .03774], floor: [.05199, .04352, .03774], pool: [0, 0, 0], vignette: 0,
        grain: .012, shadow: .88, roomBase: .008, bounce: .9, css: '#2a2623', edge: '#2a2623', loader: '#f6e3c4', chip: '0 0 0 / .22' },
    // The light theme's, velvet's mirror: an even warm paper, a little lighter
    // than the silver card. The metal sees a bright room (roomBase); the loader
    // is a dark line on it.
    paper: { title: 'Светлый', wall: [.80053, .77672, .73037], floor: [.80053, .77672, .73037], pool: [0, 0, 0], vignette: 0,
        grain: .010, shadow: .4, roomBase: .20, bounce: 1.9, css: '#e2dfd9', edge: '#e2dfd9', loader: '#4a4239', glint: '#1d1a17',
        chip: '255 255 255 / .4' }
};
// The lab and old links open on the dark one.
export const DEFAULT_BACKDROP = 'velvet';

// The page's colours for a backdrop as CSS custom properties (see the page
// CSS in build.mjs): baked into the page for its own backdrop, set at start
// for another one (the lab, exported files).
export const pageColours = backdrop => ({
    '--page': backdrop.css,
    '--edge': backdrop.edge,
    '--loader': backdrop.loader.match(/\w\w/g).map(hex => parseInt(hex, 16)).join(' '),
    '--glint': backdrop.glint || '#fff',
    '--chip': backdrop.chip || '0 0 0 / .22'
});
export const applyPageColours = backdrop => {
    for (const [name, value] of Object.entries(pageColours(backdrop))) document.documentElement.style.setProperty(name, value);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', backdrop.edge);
};
