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
    ['backdrop', ['studio', 'dark']],
    ['layout', ['classic', 'accent']],
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
    ['idle', 0, .05, 1], ['gyro', 0, .05, 1],
    ['logoDepth', 0, .05, 1], ['nameDepth', 0, .05, 1], ['bodyDepth', 0, .05, 1],
    ['nameScale', .8, .05, 1.2], ['textMute', 0, .02, .3],
    ['yaw', -1.2, .01, 0], ['pitch', -.6, .01, 0]
];
// Colours: one digit for the kind, then four digits for a 24-bit colour.
// Kinds: 0 — not set (edition default, or «same as logo» for the first letter),
// 1 — bare metal, 2 — a colour.
const TINTS = ['logoTint', 'nameTint', 'bodyTint', 'logoFirstTint'];

export function encodePreset(params) {
    let code = VERSION;
    const digit = value => DIGITS[Math.max(0, Math.min(63, value))];
    for (const [key, options] of CHOICES) code += digit(Math.max(0, options.indexOf(params.get(key) ?? options[0])));
    for (const [key, min, step, fallback] of NUMBERS) {
        const value = Number.parseFloat(params.get(key));
        const index = Math.max(0, Math.min(4095, Math.round(((Number.isFinite(value) ? value : fallback) - min) / step)));
        code += digit(index >> 6) + digit(index & 63);
    }
    for (const key of TINTS) {
        const value = params.get(key) || '';
        if (/^[0-9a-f]{6}$/i.test(value)) {
            const rgb = Number.parseInt(value, 16);
            code += digit(2) + [18, 12, 6, 0].map(shift => digit((rgb >> shift) & 63)).join('');
        } else code += digit(value === 'metal' ? 1 : 0);
    }
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
            if (kind === 1) params.set(key, 'metal');
            if (kind === 2) params.set(key, (read() << 18 | read() << 12 | read() << 6 | read()).toString(16).padStart(6, '0'));
        }
    } catch {
        return null;
    }
    return params;
}

// Expand `?c=` before anything else reads the query. Other parameters (the
// card text) and the hash stay as they are.
if (typeof location !== 'undefined' && typeof globalThis.__cardPreset !== 'string') {
    const query = new URLSearchParams(location.search);
    const expanded = decodePreset(query.get('c'));
    if (expanded) {
        query.delete('c');
        for (const [key, value] of expanded) query.set(key, value);
        history.replaceState(null, '', `?${query}${location.hash}`);
    }
}
