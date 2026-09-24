// Standalone art directions. The existing homepage is not part of this build.
const directions = {
    ivory: {
        id: 'ivory', title: 'Ivory / светлый металл', shape: 'rounded', layout: 'center',
        thickness: .025, bevel: .009, radius: .16,
        finish: { metal: [.96, .93, .85], edge: [.65, .56, .40], ink: '#322b24', secondary: '#5b5145' },
        markLow: [.34, .21, .09], markHigh: [.91, .73, .40],
        relief: { nameSize: 25, studio: true, name: { depth: .16, bevel: .45, raised: false, wall: .24 },
            logo: { depth: .55, bevel: 1.10, raised: true, face: .80, wall: .80, warmth: 0, machined: false } },
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
            .face { background: linear-gradient(145deg,#fffdf4,#e9dfcc); color: #322b24; text-align: center; }
            .face .brand { margin-inline: auto; }
            .face .logo path { fill: #917042 !important; }
        `
    },
    obsidian: {
        id: 'obsidian', title: 'Obsidian / чёрный хром', shape: 'cut', layout: 'bold',
        thickness: .040, bevel: .014, radius: .025,
        finish: { metal: [.16, .20, .26], edge: [.32, .39, .48], ink: '#e8eff6', secondary: '#b9c7d5' },
        markLow: [.48, .57, .68], markHigh: [.98, .99, 1],
        relief: { nameSize: 28, studio: true, name: { depth: .30, bevel: .60, raised: true, wall: .28 },
            logo: { depth: .95, bevel: 1.25, raised: true, face: .9, wall: .98, warmth: 0, machined: false } },
        background: '#030609', shadow: '#000000',
        css: `
            :root, body, .ambient { background-color: #030609; }
            .ambient::before { background: radial-gradient(ellipse at 48% 42%, #596b8055 0%, #26354422 40%, transparent 68%), linear-gradient(135deg,#020406,#111a23,#030609); }
            .ambient::after { background: radial-gradient(ellipse at 50% 45%,transparent 25%,#000b 100%); }
            .languages { border-radius: 2px; border-color: #bad5ec33; background: #0a101c99; }
            .languages a[aria-current] { color: #e4f5ff; background: #a9cfee24; }
            .links-overlay, .edition-link { color: #c7d8ebaa; }
            .face { background: linear-gradient(135deg,#080c12,#253340 48%,#070b10); color: #e8eff6; border-color: #c2daed44; }
            .face .logo path { fill: #dbe9f6 !important; }
            .face a:focus-visible { outline-color: #e4f5ff; }
        `
    },
    prism: {
        id: 'prism', title: 'Prism / анодированный титан', shape: 'arrow', layout: 'split',
        thickness: .026, bevel: .010, radius: .09,
        finish: { metal: [.71, .69, .92], edge: [.34, .39, .68], ink: '#15152f', secondary: '#292642' },
        markLow: [.11, .07, .25], markHigh: [.69, .74, 1],
        relief: { nameSize: 26, studio: true, cavity: true, name: { depth: .45, bevel: .70, raised: false, wall: .45 },
            logo: { depth: .85, bevel: 1.10, raised: false, face: .75, wall: .90, warmth: 0, machined: true,
                broadPower: 9, polishPower: 30, sheen: .30 } },
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
        `
    }
};

export const direction = directions[typeof __CARD_VARIANT__ === 'string' ? __CARD_VARIANT__ : 'ivory'];
export { directions };
