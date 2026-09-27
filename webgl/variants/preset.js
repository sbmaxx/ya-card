// Short links: every lab setting packed into one URL-safe code, `?c=…`.
// This module has no imports, so it runs before any module reads the query:
// it expands the code back into the full query string in place.
//
// The schema is append-only. Never reorder or remove entries or options, or
// links already shared change meaning; add new fields at the end instead.
const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const VERSION = 'A';
const FINISHES = ['enamel', 'anod'];
const SHAPES = ['edition', 'vcut', 'deboss', 'raised'];
// [key, options] — one digit each.
const CHOICES = [
    ['edition', ['steel', 'noir', 'gold', 'aurora']],
    // Only velvet is left; the others stay listed so old codes keep their positions.
    ['backdrop', ['studio', 'dark', 'velvet', 'stone', 'warm']],
    ['layout', ['classic', 'accent', 'grid']],
    ['relief', ['vcut', 'deboss', 'raised']],
    ['name', SHAPES],
    ['body', SHAPES],
    ['lightSetup', ['studio', 'softbox', 'drama', 'rim', 'ring', 'window', 'neon']],
    ['keyShape', ['round', 'strip']],
    ['lamps', ['round', 'capsule']],
    ['logoFirstFinish', FINISHES],
    ['logoFinish', FINISHES],
    ['nameFinish', FINISHES],
    ['bodyFinish', FINISHES],
    ['panel', ['1', '0']],
    ['light', ['', 'manual']]
];
// [key, min, step, default] — two digits each: up to 4096 slider steps.
const NUMBERS = [
    ['exposure', .4, .01, 1], ['bloom', 0, .01, .3], ['letterGlow', 0, .05, 1],
    ['keyGain', 0, .05, .7], ['keySoft', 0, .01, .05], ['lampSize', .3, .05, 1],
    // 'gyro' is gone (the phone's tilt was removed); its two digits stay, so
    // older codes still decode.
    ['idle', 0, .05, 1], ['gyro', 0, .05, 1],
    ['logoDepth', 0, .05, 1], ['nameDepth', 0, .05, 1], ['bodyDepth', 0, .05, 1],
    ['nameScale', .8, .05, 1.2], ['textMute', 0, .02, .3],
    ['yaw', -1.2, .01, 0], ['pitch', -.6, .01, 0]
];
// Colours: one digit for the kind, then four digits for a 24-bit colour.
// Kinds: 0 — not set (edition default, or «same as logo» for the first letter),
// 1 — bare metal, 2 — a colour, 3 — the plate's material.
const TINTS = ['logoTint', 'nameTint', 'bodyTint', 'logoFirstTint'];
// Added later, so read only if present: codes made before them still decode,
// with these settings at their defaults. [key, min, step, default] as above.
const LATER = [
    ['cardSize', .5, .01, .8], ['logoGloss', 0, .05, 1], ['nameGloss', 0, .05, 1], ['bodyGloss', 0, .05, 1],
    ['logoFirstSheer', 0, .05, 0], ['logoSheer', 0, .05, 0], ['nameSheer', 0, .05, 0], ['bodySheer', 0, .05, 0],
    ['orbit', 0, .05, 0], ['bodyWeight', 400, 100, 400], ['bodySize', 0, .5, 0], ['plateFinish', 0, 1, 0], ['font', 0, 1, 0],
    ['strip', 0, .05, 0], ['surface', 0, .05, 1], ['sparkle', 0, .05, 0], ['warmth', 0, .05, 0],
    ['typography', 0, 1, 0], ['nameWeight', 400, 100, 500], ['logoMute', 0, .02, 0], ['nameMute', 0, .02, 0],
    ['bevel', 0, 1, 0], ['wide', 0, .05, 0], ['hdr', 0, .05, 0]
];

const encodeNumbers = (params, fields, digit) => fields.map(([key, min, step, fallback]) => {
    const value = Number.parseFloat(params.get(key));
    const index = Math.max(0, Math.min(4095, Math.round(((Number.isFinite(value) ? value : fallback) - min) / step)));
    return digit(index >> 6) + digit(index & 63);
}).join('');

export function encodePreset(params) {
    let code = VERSION;
    const digit = value => DIGITS[Math.max(0, Math.min(63, value))];
    for (const [key, options] of CHOICES) code += digit(Math.max(0, options.indexOf(params.get(key) ?? options[0])));
    code += encodeNumbers(params, NUMBERS, digit);
    for (const key of TINTS) {
        const value = params.get(key) || '';
        if (/^[0-9a-f]{6}$/i.test(value)) {
            const rgb = Number.parseInt(value, 16);
            code += digit(2) + [18, 12, 6, 0].map(shift => digit((rgb >> shift) & 63)).join('');
        } else code += digit(value === 'metal' ? 1 : value === 'plate' ? 3 : 0);
    }
    code += encodeNumbers(params, LATER, digit);
    return code;
}

export function decodePreset(code) {
    if (!code || code[0] !== VERSION) return null;
    let at = 1;
    const read = () => {
        const value = DIGITS.indexOf(code[at++]);
        if (value < 0) throw new Error('bad preset');
        return value;
    };
    const params = new URLSearchParams();
    try {
        for (const [key, options] of CHOICES) {
            const value = options[read()];
            if (value) params.set(key, value);
        }
        for (const [key, min, step] of NUMBERS) {
            const index = read() * 64 + read();
            // Round to the slider step so the panel shows clean numbers.
            params.set(key, String(Number((min + index * step).toFixed(4))));
        }
        for (const key of TINTS) {
            const kind = read();
            // «Not set» is written out too: left out, the lab's default look
            // (the homepage's colours) would fill it in on the next load.
            if (kind === 0) params.set(key, key === 'logoFirstTint' ? 'same' : '');
            if (kind === 1) params.set(key, 'metal');
            if (kind === 3) params.set(key, 'plate');
            if (kind === 2) params.set(key, (read() << 18 | read() << 12 | read() << 6 | read()).toString(16).padStart(6, '0'));
        }
        for (const [key, min, step] of LATER) {
            if (at >= code.length) break;
            const index = read() * 64 + read();
            params.set(key, String(Number((min + index * step).toFixed(4))));
        }
    } catch {
        return null;
    }
    return params;
}

// Expand `?c=` before anything else reads the query. Parameters written next
// to the code (the card text, `panel=1`) win over it; the hash stays. Without
// a code the lab starts from the look live on the homepage (`HOME_LOOK`, baked
// in at build), and the link's own settings go on top of it.
if (typeof location !== 'undefined' && typeof globalThis.__cardPreset !== 'string') {
    const query = new URLSearchParams(location.search);
    const live = typeof __LAB_DEFAULT__ === 'string' ? __LAB_DEFAULT__ : null;
    const expanded = decodePreset(query.get('c') || live);
    if (expanded) {
        query.delete('c');
        for (const [key, value] of expanded) if (!query.has(key)) query.set(key, value);
        history.replaceState(null, '', `?${query}${location.hash}`);
    }
}
