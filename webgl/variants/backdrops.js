// Backdrops: a graphite cyclorama rendered with the card, lit by the same key
// light and receiving the card's real, blurred shadow. Colours are linear,
// except the page's own: `css` fills the page before the first frame, `edge`
// is the touch screen's flat frame and Safari's bars, `loader` is the colour
// of the loader's light. Plain data, so the build bakes them into the page.
export const BACKDROPS = {
    studio: { title: 'Графит', wall: [.052, .055, .062], floor: [.020, .021, .024], pool: [.15, .152, .158],
        grain: .022, shadow: .78, roomBase: .025, bounce: 1.15, css: '#15181d', edge: '#0e1014', loader: '#e8eef6' },
    dark: { title: 'Тёмный графит', wall: [.016, .017, .020], floor: [.006, .0065, .008], pool: [.075, .077, .082],
        grain: .02, shadow: .8, roomBase: .012, bounce: 1.0, css: '#0b0c0f', edge: '#07080a', loader: '#e6ecf4' },
    // A dark room with one warm spotlight behind the card, as jewellery is shown:
    // a black card stands out against the pool, its silver and edge lit.
    velvet: { title: 'Бархат', wall: [.008, .0074, .0068], floor: [.0025, .0023, .0021], pool: [.13, .112, .092], poolFalloff: 4.2,
        grain: .016, shadow: .88, roomBase: .008, bounce: .9, css: '#0a0908', edge: '#050404', loader: '#f6e3c4' },
    // Honed dark stone: the slab's soft clouds of lighter and darker stone and
    // a fine grit, still behind the moving card like a wall.
    stone: { title: 'Камень', wall: [.028, .0275, .027], floor: [.009, .009, .009], pool: [.085, .083, .08], stone: 1,
        grain: .018, shadow: .82, roomBase: .016, bounce: 1.0, css: '#121212', edge: '#0a0a0a', loader: '#eeedea' },
    // The studio, darker and warmer: richer against silver and red.
    warm: { title: 'Тёплый графит', wall: [.040, .036, .033], floor: [.014, .012, .011], pool: [.14, .128, .115],
        grain: .02, shadow: .8, roomBase: .02, bounce: 1.1, css: '#16130f', edge: '#0e0c0b', loader: '#f3e8d8' }
};

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
