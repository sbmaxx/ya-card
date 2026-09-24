// Material-only studies: the original contour, thickness, size and layout are shared.
// The existing homepage is not part of this build.
const directions = {
    ivory: {
        id: 'ivory', title: 'Ivory / титан и шампань',
        finish: { metal: [.89, .85, .76], edge: [.62, .53, .38], ink: '#322b24', secondary: '#494037' },
        markLow: [.21, .14, .07], markHigh: [.93, .77, .49],
        relief: { nameSize: 22, name: { depth: .50, bevel: .65, raised: true, wall: .72 },
            logo: { depth: 1.30, bevel: 1.10, raised: true, wall: .98, machined: true } },
        background: '#e9e3d9', shadow: '#493b29',
        css: `
            :root { color-scheme: light; }
            :root, body, .ambient { background-color: #e9e3d9; color: #302921; }
            .ambient::before { background: radial-gradient(ellipse at 44% 32%, #fffdf4 0%, #f7f0de88 40%, transparent 72%), linear-gradient(125deg,#ded4c3,#f2eee5 52%,#d8ccba); }
            .ambient::after { background: radial-gradient(ellipse at 50% 42%, transparent 35%, #9e896632 100%); }
            .languages { border-color: #493b2929; background: #ffffff70; }
            .languages a { color: #4d413599; }
            .languages a + a { border-color: #493b2929; }
            .languages a[aria-current] { color: #31271e; background: #bbaa8f55; }
            .languages a:hover { color: #30251b; background: #bbaa8f33; }
            .links-overlay, .edition-link { color: #5a4d3ecc; }
            .links-overlay a:hover { color: #30251b; }
            a:focus-visible, .scene:focus-visible { outline-color: #73512b; }
            .face { background: linear-gradient(145deg,#ece6d6,#c5bba4); color: #322b24; }
            .face .logo path { fill: #73532c !important; }
            .face h1 { color: #73532c; text-shadow: 0 1px #f9e3b7, 0 -1px #302415; }
        `
    },
    obsidian: {
        id: 'obsidian', title: 'Obsidian / чёрный хром',
        finish: { metal: [.078, .091, .11], edge: [.24, .29, .36], ink: '#c4cdd5', secondary: '#a4b0ba' },
        markLow: [.23, .28, .34], markHigh: [.93, .97, 1],
        relief: { nameSize: 22, name: { depth: .65, bevel: .75, raised: true, wall: .85 },
            logo: { depth: 1.60, bevel: 1.15, raised: true, wall: 1, machined: true } },
        background: '#030609', shadow: '#000000',
        css: `
            :root, body, .ambient { background-color: #030609; }
            .ambient::before { background: radial-gradient(ellipse at 48% 42%, #596b8055 0%, #26354422 40%, transparent 68%), linear-gradient(135deg,#020406,#111a23,#030609); }
            .ambient::after { background: radial-gradient(ellipse at 50% 45%,transparent 25%,#000b 100%); }
            .languages { border-color: #bad5ec33; background: #0a101c99; }
            .languages a[aria-current] { color: #e4f5ff; background: #a9cfee24; }
            .links-overlay, .edition-link { color: #c7d8ebaa; }
            .face { background: radial-gradient(ellipse at 40% 25%,#354554,#151d25 75%); color: #c4cdd5; border-color: #c2daed44; }
            .face .logo path { fill: #a9bbc9 !important; }
            .face h1 { color: #a9bbc9; text-shadow: 0 1px #000, 0 -1px #ddeeff99; }
            .face a:focus-visible { outline-color: #e4f5ff; }
        `
    },
    prism: {
        id: 'prism', title: 'Prism / интерференционный титан',
        finish: { metal: [.52, .67, .83], edge: [.24, .34, .55], ink: '#15152b', secondary: '#27263c' },
        markLow: [.07, .04, .16], markHigh: [.54, .58, .78],
        relief: { nameSize: 22, cavity: true, name: { depth: .60, bevel: .75, raised: false, wall: .75 },
            logo: { depth: 1.40, bevel: 1.20, raised: false, wall: .98, machined: true } },
        background: '#10123a', shadow: '#060821',
        css: `
            :root, body, .ambient { background-color: #10123a; }
            .ambient::before { background: radial-gradient(ellipse at 48% 40%,#b281ff88 0%,#7065e644 36%,transparent 70%), linear-gradient(125deg,#054669,#30228d 50%,#5a174c); }
            .ambient::after { background: radial-gradient(ellipse at 50% 44%,transparent 22%,#070b3099 100%); }
            .languages { border-color: #cbc9ff44; background: #27225c88; }
            .languages a[aria-current] { background: #c8bcff3b; }
            .links-overlay, .edition-link { color: #eee5ffbb; }
            .face { background: linear-gradient(125deg,#6de1df,#a79aef 48%,#ecc1dc); color: #15152f; border-color: #dddbff99; }
            .face .logo path { fill: #34234f !important; }
            .face h1 { color: #34234f; text-shadow: 0 1px #e4dcff99, 0 -1px #21133199; }
        `
    }
};

export const direction = directions[typeof __CARD_VARIANT__ === 'string' ? __CARD_VARIANT__ : 'ivory'];
export { directions };
