// Homepage: the looks chosen on the lab, baked in as presets by build.mjs, one
// per theme; the page's head has picked the theme (`data-theme`, see
// theme.js). No imports, so this runs before any module reads the settings.
globalThis.__cardPreset = __CARD_PRESETS__[document.documentElement.dataset.theme] || __CARD_PRESETS__.dark;
