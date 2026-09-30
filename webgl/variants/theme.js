// The homepage's theme: light, dark, or the system's (auto). The page's head
// picks it before anything is drawn (themeScript in build.mjs) and sets
// `data-theme` (what is shown) and `data-theme-choice` (what was chosen); the
// choice is kept in localStorage `card-theme`. Each theme is its own look (an
// edition and a backdrop) built into the card's shaders at load, so a new
// theme fades the scene out into the new page colour and reloads in it.
const KEY = 'card-theme';
const CHOICES = ['light', 'dark', 'auto'];
const root = document.documentElement;
const system = matchMedia('(prefers-color-scheme: light)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const LABELS = {
    ru: { group: 'Тема', light: 'Светлая тема', dark: 'Тёмная тема', auto: 'Тема как в системе' },
    en: { group: 'Theme', light: 'Light theme', dark: 'Dark theme', auto: 'Theme as in the system' }
};
const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
    light: svg('<circle cx="12" cy="12" r="3.6"/>' + Array.from({ length: 8 }, (_, i) => {
        const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a), f = n => (12 + n).toFixed(2);
        return `<path d="M${f(c * 6.4)} ${f(s * 6.4)}L${f(c * 8.4)} ${f(s * 8.4)}"/>`;
    }).join('')),
    dark: svg('<path d="M18.5 14.6A7 7 0 0 1 9.4 5.5a7 7 0 1 0 9.1 9.1z"/>'),
    // Half light, half dark: whichever the system asks for.
    auto: svg('<circle cx="12" cy="12" r="7"/><path d="M12 5a7 7 0 0 0 0 14z" fill="currentColor" stroke="none"/>')
};

const stored = () => {
    try { return CHOICES.includes(localStorage.getItem(KEY)) ? localStorage.getItem(KEY) : 'auto'; } catch { return 'auto'; }
};
const shown = choice => choice === 'auto' ? (system.matches ? 'light' : 'dark') : choice;

const group = document.createElement('div');
group.className = 'theme-switch';
group.setAttribute('role', 'radiogroup');
const buttons = CHOICES.map(choice => {
    const button = Object.assign(document.createElement('button'), { type: 'button', innerHTML: ICONS[choice] });
    button.dataset.choice = choice;
    button.setAttribute('role', 'radio');
    button.addEventListener('click', () => choose(choice));
    group.append(button);
    return button;
});
// Arrow keys move within the group, as in any radio group.
group.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = buttons[(buttons.indexOf(document.activeElement) + step + buttons.length) % buttons.length];
    next.focus();
    choose(next.dataset.choice);
});

function mark(choice) {
    for (const button of buttons) {
        const on = button.dataset.choice === choice;
        button.setAttribute('aria-checked', String(on));
        button.tabIndex = on ? 0 : -1;
    }
}
// Labels in the language of the side shown (app.js sets the root's lang).
function label() {
    const words = LABELS[root.lang === 'en' ? 'en' : 'ru'];
    group.setAttribute('aria-label', words.group);
    for (const button of buttons) {
        button.setAttribute('aria-label', words[button.dataset.choice]);
        button.title = words[button.dataset.choice];
    }
}

let leaving = false;
function choose(choice) {
    try { localStorage.setItem(KEY, choice); } catch {}
    root.dataset.themeChoice = choice;
    mark(choice);
    apply();
}
// Show the theme the choice asks for: nothing to do if it is already shown.
// Otherwise the page takes the new theme's colours at once (they are custom
// properties per `data-theme`), the scene fades into them, and the page reloads.
function apply() {
    const next = shown(stored());
    if (leaving || next === root.dataset.theme) return;
    leaving = true;
    root.dataset.theme = next;
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

mark(root.dataset.themeChoice || stored());
label();
new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ['lang'] });
// Auto follows the system as it changes; a choice made in another tab applies here too.
system.addEventListener('change', apply);
window.addEventListener('storage', event => {
    if (event.key !== KEY) return;
    root.dataset.themeChoice = stored();
    mark(stored());
    apply();
});
// Back from the back/forward cache after a choice made elsewhere.
window.addEventListener('pageshow', event => { if (event.persisted) { mark(stored()); apply(); } });
document.body.append(group);
