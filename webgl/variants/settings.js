// Card settings: read once from the query (the lab) or from a preset baked
// into the page (the homepage and exported files). The renderer reads them
// from `globalThis.__cardLab`; the lab panel edits them live.
import { direction } from './directions.js';
import { BACKDROPS, KEY_SHAPES, LIGHT_SETUPS } from './renderer.js';

// An exported file carries its settings as a preset and shows no panel.
export const exported = typeof globalThis.__cardPreset === 'string';
export const params = new URLSearchParams(exported ? globalThis.__cardPreset : location.search);
// Editable card text: URL key, label, placeholder (the current card).
export const textFields = [
    ['name_ru', 'Имя (RU)', 'Роман Рождественский'],
    ['name_en', 'Имя (EN)', 'Roman Rozhdestvenskiy'],
    ['role_ru', 'Должность (RU)', 'руководитель отдела поисковых интерфейсов'],
    ['role_en', 'Должность (EN)', 'head of search interfaces department'],
    ['email', 'Почта или логин', 'sbmaxx'],
    ['telegram', 'Telegram', 'sbmaxx']
];
const number = (key, fallback) => {
    const value = Number.parseFloat(params.get(key));
    return Number.isFinite(value) ? value : fallback;
};
export const lab = globalThis.__cardLab = {
    exported,
    exposure: number('exposure', 1),
    bloom: number('bloom', .3),
    letterGlow: number('letterGlow', 1),
    cardSize: number('cardSize', .8),
    logoGloss: number('logoGloss', 1),
    nameGloss: number('nameGloss', 1),
    bodyGloss: number('bodyGloss', 1),
    // Colour transparency per object: 0 — opaque, 1 — the plate shows through.
    logoFirstSheer: number('logoFirstSheer', 0),
    logoSheer: number('logoSheer', 0),
    nameSheer: number('nameSheer', 0),
    bodySheer: number('bodySheer', 0),
    keyGain: number('keyGain', .7),
    keySoft: number('keySoft', .05),
    lampSize: number('lampSize', 1),
    // Light orbit: 0 — the key drifts gently; 1 — it sweeps a wide arc in front
    // and a back light circles the card, catching only its edges and lettering.
    orbit: number('orbit', 0),
    // A strip light over the plate (0 — none) and the key's warmth against a
    // cooler fill (0 — the edition's own tones).
    strip: number('strip', 0),
    warmth: number('warmth', 0),
    keyShape: Object.hasOwn(KEY_SHAPES, params.get('keyShape')) ? params.get('keyShape') : 'round',
    lamps: params.get('lamps') === 'capsule' ? 'capsule' : 'round',
    lightSetup: Object.hasOwn(LIGHT_SETUPS, params.get('lightSetup')) ? params.get('lightSetup') : 'studio',
    idle: number('idle', 1),
    gyro: number('gyro', 1),
    logoDepth: number('logoDepth', 1),
    nameDepth: number('nameDepth', 1),
    nameScale: number('nameScale', 1.2),
    // Role and contacts: 400 Regular, 500 Medium (as the name) or 600 Semibold.
    bodyWeight: [400, 500, 600].reduce((best, w) => Math.abs(w - number('bodyWeight', 400)) < Math.abs(best - number('bodyWeight', 400)) ? w : best, 400),
    // Typeface for all the card's text: an index into FONTS (fonts.js).
    font: Math.max(0, Math.round(number('font', 0))),
    // Role and contacts: px added to their size (12.5–13 px).
    bodySize: number('bodySize', 0),
    // «Тонкая типографика»: 1 — small type tracked out, the name a touch tighter.
    typography: Math.max(0, Math.min(1, Math.round(number('typography', 0)))),
    // Plate finish: 0 brushed, 1 bead-blasted, 2 polished.
    plateFinish: Math.max(0, Math.min(2, Math.round(number('plateFinish', 0)))),
    // How strongly the finish shows (1 — as finished) and the bead-blasted
    // finish's sparkle (0 — none).
    surface: number('surface', 1),
    sparkle: number('sparkle', 0),
    bodyDepth: number('bodyDepth', 1),
    bodyTint: /^([0-9a-f]{6}|plate)$/i.test(params.get('bodyTint') || '') ? params.get('bodyTint') : '',
    textMute: number('textMute', .3),
    logoTint: /^([0-9a-f]{6}|plate)$/i.test(params.get('logoTint') || '') ? params.get('logoTint') : '',
    nameTint: /^([0-9a-f]{6}|plate)$/i.test(params.get('nameTint') || '') ? params.get('nameTint') : '',
    logoFirstTint: /^([0-9a-f]{6}|metal|plate)$/i.test(params.get('logoFirstTint') || '') ? params.get('logoFirstTint').replace('metal', '') : 'same',
    // Finish per object; the old shared `tintFinish` becomes their default.
    finish: Object.fromEntries(['logoFirst', 'logo', 'name', 'body'].map(key => {
        const value = params.get(`${key}Finish`) || params.get('tintFinish');
        return [key, value === 'anod' ? 'anod' : 'enamel'];
    })),
    text: Object.fromEntries(textFields.map(([key]) => [key, params.get(key) || ''])),
    backdrop: Object.hasOwn(BACKDROPS, params.get('backdrop')) ? params.get('backdrop') : (direction.backdrop || 'studio'),
    manualLight: params.get('light') === 'manual',
    yaw: number('yaw', 0),
    pitch: number('pitch', 0)
};

// A baked preset: settings only. The page colour follows the backdrop.
if (exported) {
    const backdrop = BACKDROPS[lab.backdrop];
    if (backdrop) document.documentElement.style.backgroundColor = backdrop.css;
}
