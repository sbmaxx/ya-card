// Studio editions. Every edition shares the card contour, layout, controller
// and studio; only the finish, the lettering process and the room tint differ.
// Colours in `look` are linear reflectances (F0) or linear albedo, not sRGB.
//
// Lettering processes:
// - `vcut`    — diamond V-cut: two polished walls meet at the bottom of the groove.
// - `enamel`  — cut-and-fill: a shallow cut filled with gloss enamel, polished lip.
// - `anneal`  — laser annealing: dark oxide in the metal, no depth, faint sheen.
// - `ablate`  — laser ablation: the coating is removed and bare frosted steel shows.
const directions = {
    steel: {
        id: 'steel', backdrop: 'studio', title: 'Steel', caption: 'Продольная шлифовка · алмазная V-резка · эмаль',
        look: {
            plate: { f0: [.60, .60, .62], rough: .32, aniso: .26, brush: 'linear' },
            chamfer: { f0: [.93, .93, .95], rough: .03 },
            side: { f0: [.62, .62, .64], rough: .22 },
            logo: { process: 'vcut', f0: [.88, .88, .90], rough: .025 },
            name: { process: 'enamel', albedo: [.006, .007, .009], lip: [.90, .90, .92] },
            text: { process: 'anneal', albedo: [.018, .019, .022] },
            studio: { key: [1, .97, .93], fill: [.80, .88, 1], bounce: .62, exposure: .95 }
        },
        relief: { nameSize: 22, logo: 'vcut', name: { depth: .55, bevel: .55 } },
        background: '#0b0d11', shadow: '#000000',
        css: `
            :root, body, .ambient { background-color: #0b0d11; }
            .ambient::before { background: radial-gradient(ellipse at 42% 36%, #8a96a633 0%, #5a667514 38%, transparent 70%), linear-gradient(125deg,#07090c,#161b22 52%,#0a0c10); }
            .ambient::after { background: radial-gradient(ellipse at 50% 46%, transparent 24%, #000a 100%); }
            .face { background: radial-gradient(ellipse at 34% 30%,#f1f3f5,#9aa0a6 80%); color: #111418; }
            .face .logo path { fill: #2a2e33 !important; }
        `
    },
    noir: {
        id: 'noir', backdrop: 'dark', title: 'Noir', caption: 'Чёрный PVD · лазер до голой стали · полированная фаска',
        look: {
            plate: { f0: [.05, .051, .056], rough: .30, aniso: .22, brush: 'linear', coat: .012 },
            chamfer: { f0: [.94, .94, .96], rough: .025 },
            side: { f0: [.05, .05, .055], rough: .30 },
            logo: { process: 'ablate', f0: [.92, .92, .94], rough: .14 },
            name: { process: 'ablate', f0: [.80, .80, .82], rough: .20 },
            text: { process: 'ablate', f0: [.70, .70, .72], rough: .42 },
            studio: { key: [1, .98, .95], fill: [.75, .85, 1], bounce: .70, exposure: 1.2 }
        },
        relief: { nameSize: 22, logo: 'vcut', name: { depth: .35, bevel: .45 } },
        background: '#040506', shadow: '#000000',
        css: `
            :root, body, .ambient { background-color: #040506; }
            .ambient::before { background: radial-gradient(ellipse at 44% 38%, #5d6a7a2e 0%, #2a334010 40%, transparent 70%), linear-gradient(135deg,#020304,#0d1117 52%,#030405); }
            .ambient::after { background: radial-gradient(ellipse at 50% 46%, transparent 22%, #000c 100%); }
            .face { background: radial-gradient(ellipse at 34% 28%,#2a2d31,#0c0d0f 78%); color: #d7dbe0; border: 1px solid #ffffff2a; }
            .face .logo path { fill: #e8ebee !important; }
            .face a:focus-visible { outline-color: #fff; }
        `
    },
    gold: {
        id: 'gold', backdrop: 'studio', title: 'Champagne', caption: 'Шлифованное золото · зеркальная V-резка · чёрная эмаль',
        look: {
            plate: { f0: [.92, .70, .42], rough: .32, aniso: .26, brush: 'linear' },
            chamfer: { f0: [1.0, .82, .52], rough: .03 },
            side: { f0: [.90, .70, .42], rough: .22 },
            logo: { process: 'vcut', f0: [1.0, .80, .50], rough: .025 },
            name: { process: 'enamel', albedo: [.006, .005, .004], lip: [1.0, .82, .52] },
            text: { process: 'anneal', albedo: [.030, .018, .010] },
            studio: { key: [1, .93, .84], fill: [.95, .88, .80], bounce: .55, exposure: .9 }
        },
        relief: { nameSize: 22, logo: 'vcut', name: { depth: .55, bevel: .55 } },
        background: '#0d0a07', shadow: '#000000',
        css: `
            :root, body, .ambient { background-color: #0d0a07; }
            .ambient::before { background: radial-gradient(ellipse at 42% 36%, #a38a6533 0%, #6a553a14 38%, transparent 70%), linear-gradient(125deg,#080604,#1c1610 52%,#0b0906); }
            .ambient::after { background: radial-gradient(ellipse at 50% 46%, transparent 24%, #000b 100%); }
            .face { background: radial-gradient(ellipse at 34% 30%,#f3dfb8,#a88652 80%); color: #1a120a; }
            .face .logo path { fill: #3a2a16 !important; }
        `
    },
    aurora: {
        id: 'aurora', backdrop: 'dark', title: 'Aurora', caption: 'Анодированный титан · интерференция · лазер до металла',
        look: {
            plate: { film: true, rough: .28, aniso: .18, brush: 'linear' },
            chamfer: { f0: [.62, .60, .58], rough: .03 },
            side: { f0: [.55, .53, .52], rough: .25 },
            logo: { process: 'vcut', f0: [.66, .64, .62], rough: .02 },
            name: { process: 'anneal', albedo: [.012, .011, .016] },
            text: { process: 'anneal', albedo: [.016, .014, .022] },
            studio: { key: [1, .97, .95], fill: [.85, .88, 1], bounce: .62, exposure: 1.05 }
        },
        relief: { nameSize: 22, logo: 'vcut', name: { depth: .40, bevel: .50 } },
        background: '#07080f', shadow: '#000000',
        css: `
            :root, body, .ambient { background-color: #07080f; }
            .ambient::before { background: radial-gradient(ellipse at 44% 38%, #5b58a033 0%, #2e3a6a14 40%, transparent 70%), linear-gradient(125deg,#05060c,#141a2c 52%,#0b0712); }
            .ambient::after { background: radial-gradient(ellipse at 50% 46%, transparent 22%, #000b 100%); }
            .face { background: linear-gradient(125deg,#5d8fb0,#7c6bb0 48%,#b7896a); color: #0f0d18; }
            .face .logo path { fill: #1c1a26 !important; }
        `
    }
};

// Edition pages have the id compiled in; the lab page reads `?edition=`.
const compiled = typeof __CARD_VARIANT__ === 'string' ? __CARD_VARIANT__ : null;
const requested = typeof location === 'undefined' ? null : new URLSearchParams(globalThis.__cardPreset ?? location.search).get('edition');
export const direction = directions[compiled && compiled !== 'lab' ? compiled
    : Object.hasOwn(directions, requested) ? requested : 'steel'];
export { directions };
