// The homepage's corner controls: the theme — light, dark, or the system's
// (auto) — and, on a device that got light 3D, the graphics — full or light.
//
// The page's head picks the theme before anything is drawn (themeScript in
// build.mjs) and sets `data-theme` (what is shown) and `data-theme-choice`
// (what was chosen); the choice is kept in localStorage `card-theme`. The
// graphics choice is kept in `card-render` and read by the renderer
// (assessDevice). Each theme's look and each graphics mode are built into the
// card's shaders at load, so a change fades the scene out and reloads.
const THEME_KEY = 'card-theme', RENDER_KEY = 'card-render';
const root = document.documentElement;
const system = matchMedia('(prefers-color-scheme: light)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const LABELS = {
    ru: { theme: 'Тема', light: 'Светлая тема', dark: 'Тёмная тема', auto: 'Тема как в системе',
        render: 'Графика', full: 'Полная графика', lite: 'Облегчённая графика' },
    en: { theme: 'Theme', light: 'Light theme', dark: 'Dark theme', auto: 'Theme as in the system',
        render: 'Graphics', full: 'Full graphics', lite: 'Light graphics' }
};
const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
    light: svg('<circle cx="12" cy="12" r="3.6"/>' + Array.from({ length: 8 }, (_, i) => {
        const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a), f = n => (12 + n).toFixed(2);
        return `<path d="M${f(c * 6.4)} ${f(s * 6.4)}L${f(c * 8.4)} ${f(s * 8.4)}"/>`;
    }).join('')),
    dark: svg('<path d="M18.5 14.6A7 7 0 0 1 9.4 5.5a7 7 0 1 0 9.1 9.1z"/>'),
    // Half light, half dark: whichever the system asks for.
    auto: svg('<circle cx="12" cy="12" r="7"/><path d="M12 5a7 7 0 0 0 0 14z" fill="currentColor" stroke="none"/>'),
    // The studio: a glint on metal. Light 3D: a flat plate.
    full: svg('<path d="M12 4.5l1.7 5.3 5.3 1.7-5.3 1.7L12 18.5l-1.7-5.3L5 11.5l5.3-1.7z"/>'),
    lite: svg('<rect x="5" y="7.5" width="14" height="9" rx="1.5"/>')
};
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const storedTheme = () => ['light', 'dark', 'auto'].includes(read(THEME_KEY)) ? read(THEME_KEY) : 'auto';
const shownTheme = choice => choice === 'auto' ? (system.matches ? 'light' : 'dark') : choice;

const corner = document.createElement('div');
corner.className = 'corner-controls';

// A radio group of icon buttons; arrow keys move within it.
function radioGroup(className, choices, choose) {
    const group = document.createElement('div');
    group.className = className;
    group.setAttribute('role', 'radiogroup');
    const buttons = choices.map(choice => {
        const button = Object.assign(document.createElement('button'), { type: 'button', innerHTML: ICONS[choice] });
        button.dataset.choice = choice;
        button.setAttribute('role', 'radio');
        button.addEventListener('click', () => choose(choice));
        group.append(button);
        return button;
    });
    group.addEventListener('keydown', event => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = buttons[(buttons.indexOf(document.activeElement) + step + buttons.length) % buttons.length];
        next.focus();
        choose(next.dataset.choice);
    });
    return {
        group,
        mark(choice) {
            for (const button of buttons) {
                const on = button.dataset.choice === choice;
                button.setAttribute('aria-checked', String(on));
                button.tabIndex = on ? 0 : -1;
            }
        },
        label(words, name) {
            group.setAttribute('aria-label', words[name]);
            for (const button of buttons) {
                button.setAttribute('aria-label', words[button.dataset.choice]);
                button.title = words[button.dataset.choice];
            }
        }
    };
}

// Leave for the new theme or graphics: the page takes the new theme's
// colours at once (custom properties per `data-theme`), the scene fades into
// them, and the page reloads.
let leaving = false;
function leave(theme = root.dataset.theme) {
    if (leaving) return;
    leaving = true;
    root.dataset.theme = theme;
    const edge = getComputedStyle(root).getPropertyValue('--edge').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', edge);
    // Touch screens: the renderer painted the page and Safari's strips in the
    // old edge colour (applyEdges); they follow the new one.
    for (const element of [root, document.body, document.querySelector('.scene'), ...document.querySelectorAll('.safe-edge')]) {
        if (element?.style.backgroundColor) element.style.backgroundColor = edge;
    }
    root.classList.add('theme-leaving');
    setTimeout(() => location.reload(), reducedMotion.matches ? 0 : 450);
}

// Theme: nothing to do if the choice shows the theme already shown.
const theme = radioGroup('theme-switch', ['light', 'dark', 'auto'], choice => {
    write(THEME_KEY, choice);
    root.dataset.themeChoice = choice;
    theme.mark(choice);
    applyTheme();
});
function applyTheme() {
    const next = shownTheme(storedTheme());
    if (next !== root.dataset.theme) leave(next);
}

// Graphics: shown once the card is on light 3D, or after a choice was made.
const graphics = radioGroup('render-switch', ['full', 'lite'], choice => {
    graphics.mark(choice);
    const current = globalThis.__cardRenderer?.perf?.mode;
    write(RENDER_KEY, choice);
    if (choice !== current) leave();
});
graphics.group.hidden = true;
function showGraphics() {
    const perf = globalThis.__cardRenderer?.perf;
    // `?render=` in the address wins over any choice: nothing to offer.
    if (!perf || perf.reason === 'forced') return;
    if (perf.mode !== 'lite' && perf.reason !== 'chosen') return;
    graphics.mark(perf.mode);
    graphics.group.hidden = false;
}

function label() {
    const words = LABELS[root.lang === 'en' ? 'en' : 'ru'];
    theme.label(words, 'theme');
    graphics.label(words, 'render');
}

theme.mark(root.dataset.themeChoice || storedTheme());
label();
corner.append(graphics.group, theme.group);
new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ['lang'] });
new MutationObserver(() => { if (root.classList.contains('webgl-ready')) showGraphics(); })
    .observe(root, { attributes: true, attributeFilter: ['class'] });
window.addEventListener('card-mode', showGraphics);
// Auto follows the system as it changes; a choice made in another tab applies here too.
system.addEventListener('change', applyTheme);
window.addEventListener('storage', event => {
    if (event.key !== THEME_KEY) return;
    root.dataset.themeChoice = storedTheme();
    theme.mark(storedTheme());
    applyTheme();
});
// Back from the back/forward cache after a choice made elsewhere.
window.addEventListener('pageshow', event => { if (event.persisted) { theme.mark(storedTheme()); applyTheme(); } });
document.body.append(corner);
