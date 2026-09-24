// Demo stand: one page, every edition and relief, live light and exposure.
// Edition and relief rebuild the shader, so they reload; the rest is live.
// All settings live in the URL, so a particular look can be shared as a link.
import { directions, direction } from './directions.js';
import { currentLogoShape, currentNameShape, currentLayout, BACKDROPS } from './renderer.js';

const params = new URLSearchParams(location.search);
const number = (key, fallback) => {
    const value = Number.parseFloat(params.get(key));
    return Number.isFinite(value) ? value : fallback;
};
const lab = globalThis.__cardLab = {
    exposure: number('exposure', 1),
    bloom: number('bloom', .45),
    idle: number('idle', 1),
    gyro: number('gyro', 1),
    logoDepth: number('logoDepth', 1),
    nameDepth: number('nameDepth', 1),
    backdrop: Object.hasOwn(BACKDROPS, params.get('backdrop')) ? params.get('backdrop') : 'studio',
    manualLight: params.get('light') === 'manual',
    yaw: number('yaw', 0),
    pitch: number('pitch', 0)
};

const style = document.createElement('style');
style.textContent = direction.css + `
.lab { position: fixed; top: calc(16px + env(safe-area-inset-top, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); z-index: 30;
  width: 300px; max-height: calc(100svh - 32px); overflow: auto; padding: 14px 14px 12px; border-radius: 14px;
  background: #0b0d12d9; border: 1px solid #ffffff1c; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  color: #e8ebf0; font: 12px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; box-shadow: 0 12px 40px #0008; }
.lab[hidden] { display: none; }
.lab h2 { margin: 0 0 10px; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #9aa3b0;
  display: flex; justify-content: space-between; align-items: center; }
.lab h2 output { letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; color: #cfd6df; }
.lab fieldset { border: 0; margin: 0 0 12px; padding: 0; }
.lab legend { padding: 0; margin-bottom: 6px; color: #9aa3b0; }
.lab .segments { display: flex; flex-wrap: wrap; gap: 2px; padding: 2px; border-radius: 8px; background: #ffffff10; }
.lab .segments button { flex: 1 1 auto; white-space: nowrap; }
.lab .segments button { appearance: none; border: 0; border-radius: 6px; padding: 7px 4px; background: transparent; color: #c2c9d3; font: inherit; cursor: pointer; }
.lab .segments button:hover { background: #ffffff12; }
.lab .segments button[aria-pressed="true"] { background: #ffffff2b; color: #fff; }
.lab label.range { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; margin-bottom: 8px; color: #9aa3b0; }
.lab label.range input { grid-column: 1 / -1; width: 100%; accent-color: #d9dee6; }
.lab label.range output { color: #e8ebf0; font-variant-numeric: tabular-nums; }
.lab .check { display: flex; gap: 8px; align-items: center; margin: 2px 0 8px; cursor: pointer; }
.lab .actions { display: flex; gap: 6px; margin-top: 4px; }
.lab .actions button { flex: 1; appearance: none; border: 1px solid #ffffff22; border-radius: 8px; padding: 7px 6px; background: #ffffff0d; color: #e8ebf0; font: inherit; cursor: pointer; }
.lab .actions button:hover { background: #ffffff1c; }
.lab p { margin: 8px 0 0; color: #7d8794; font-size: 11px; }
.lab .close { appearance: none; border: 0; background: #ffffff14; color: #cfd6df; width: 26px; height: 26px; border-radius: 50%;
  font: 16px/26px -apple-system, sans-serif; cursor: pointer; margin-left: 10px; padding: 0; }
.lab .close:hover { background: #ffffff26; }
.lab h2 .meta { display: flex; align-items: center; }
.backdrop-light .edition-link, .backdrop-light .links-overlay, .backdrop-light .links-overlay a { color: #1b1d22b3; }
.backdrop-light .languages { border-color: #0000001f; background: #ffffff66; }
.backdrop-light .languages a { color: #1b1d2299; }
.backdrop-light .languages a + a { border-color: #0000001f; }
.backdrop-light .languages a[aria-current] { background: #0000001a; color: #111; }
.lab-toggle { position: fixed; top: calc(16px + env(safe-area-inset-top, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); z-index: 29;
  appearance: none; border: 1px solid #ffffff22; border-radius: 10px; padding: 8px 12px; background: #0b0d12cc; color: #e8ebf0; font: 12px -apple-system, sans-serif; cursor: pointer; }
/* Phones: a compact bottom sheet, collapsed until asked for, so the card stays visible. */
@media (max-width: 700px) {
  .lab { top: auto; left: 0; right: 0; bottom: 0; width: auto; max-height: 48svh; border-radius: 16px 16px 0 0;
    border-width: 1px 0 0; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); }
  .lab h2 { margin-bottom: 6px; }
  .lab fieldset { margin-bottom: 8px; }
  .lab legend { margin-bottom: 4px; }
  .lab .segments button { padding: 8px 2px; font-size: 11.5px; }
  .lab .tuning { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
  .lab .check { font-size: 11px; }
  .lab label.range { margin-bottom: 4px; }
  .lab .actions [data-action="hide"], .lab p { display: none; }
  .lab-toggle { top: auto; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); padding: 10px 14px; font-size: 13px; }
  /* With the sheet open, the card moves into the free upper half. */
  .scene, .card-shadow { transition: transform .35s cubic-bezier(.3,0,.2,1); }
  .lab-sheet-open .scene, .lab-sheet-open .card-shadow { transform: translateY(-21svh) scale(.78); }
}
`;
document.head.append(style);
document.title = `Lab · ${direction.title}`;

const labels = { vcut: 'V-резка', deboss: 'Углублённый', raised: 'Выпуклый' };
const panel = document.createElement('aside');
panel.className = 'lab';
panel.setAttribute('aria-label', 'Демо-стенд');
panel.innerHTML = `
  <h2>Демо-стенд <span class="meta"><output class="fps">— fps</output><button type="button" class="close" data-action="hide" aria-label="Скрыть панель">×</button></span></h2>
  <fieldset><legend>Материал</legend><div class="segments" data-param="edition">
    ${Object.values(directions).map(d => `<button type="button" data-value="${d.id}" aria-pressed="${d.id === direction.id}">${d.title}</button>`).join('')}
  </div></fieldset>
  <fieldset><legend>Фон</legend><div class="segments" data-live="backdrop">
    ${Object.entries(BACKDROPS).map(([id, b]) => `<button type="button" data-value="${id}" aria-pressed="${id === lab.backdrop}">${b ? b.title : 'Пустота'}</button>`).join('')}
  </div></fieldset>
  <fieldset><legend>Композиция</legend><div class="segments" data-param="layout">
    <button type="button" data-value="classic" aria-pressed="${currentLayout === 'classic'}">Классика</button>
    <button type="button" data-value="accent" aria-pressed="${currentLayout === 'accent'}">Акцент на имени</button>
  </div></fieldset>
  <fieldset><legend>Логотип</legend><div class="segments" data-param="relief">
    ${Object.entries(labels).map(([id, label]) => `<button type="button" data-value="${id}" aria-pressed="${id === currentLogoShape}">${label}</button>`).join('')}
  </div>
    <label class="range" style="margin-top:8px">Глубина логотипа <output data-for="logoDepth"></output><input type="range" name="logoDepth" min="0" max="3" step=".05" value="${lab.logoDepth}"></label>
  </fieldset>
  <fieldset><legend>Имя <span style="color:#6f7884">· «Материал» — эмаль или лазер из пресета</span></legend><div class="segments" data-param="name">
    ${Object.entries({ edition: 'Материал', vcut: 'V-резка', deboss: 'Вглубь', raised: 'Выпуклое' }).map(([id, label]) => `<button type="button" data-value="${id}" aria-pressed="${id === currentNameShape}">${label}</button>`).join('')}
  </div>
    <label class="range" style="margin-top:8px">Глубина имени <output data-for="nameDepth"></output><input type="range" name="nameDepth" min="0" max="3" step=".05" value="${lab.nameDepth}"></label>
  </fieldset>
  <div class="tuning"><fieldset><legend>Свет</legend>
    <label class="check"><input type="checkbox" name="manual" ${lab.manualLight ? 'checked' : ''}> Стоп-кадр света</label>
    <label class="range">Поворот <output data-for="yaw"></output><input type="range" name="yaw" min="-1.2" max="1.2" step=".01" value="${lab.yaw}"></label>
    <label class="range">Высота <output data-for="pitch"></output><input type="range" name="pitch" min="-.6" max=".6" step=".01" value="${lab.pitch}"></label>
  </fieldset>
  <fieldset><legend>Картинка</legend>
    <label class="range">Экспозиция <output data-for="exposure"></output><input type="range" name="exposure" min=".4" max="2" step=".01" value="${lab.exposure}"></label>
    <label class="range">Свечение (bloom) <output data-for="bloom"></output><input type="range" name="bloom" min="0" max="1.5" step=".01" value="${lab.bloom}"></label>
    <label class="range">Покачивание <output data-for="idle"></output><input type="range" name="idle" min="0" max="2" step=".05" value="${lab.idle}"></label>
    <label class="range">Гироскоп <output data-for="gyro"></output><input type="range" name="gyro" min="0" max="3" step=".05" value="${lab.gyro}"></label>
  </fieldset></div>
  <div class="actions"><button type="button" data-action="intro">Интро заново</button><button type="button" data-action="reset">Сбросить</button><button type="button" data-action="hide">Скрыть</button></div>
  <p>H — скрыть/показать панель. Колесо — зум, перетаскивание — поворот, клик — переворот.</p>`;
const toggle = document.createElement('button');
toggle.className = 'lab-toggle';
toggle.type = 'button';
toggle.textContent = 'Стенд';
toggle.hidden = true;
toggle.setAttribute('aria-label', 'Показать панель демо-стенда');
document.body.append(panel, toggle);
// Pointer movement over the panel must not tilt the card.
for (const type of ['pointermove', 'pointerdown', 'wheel']) panel.addEventListener(type, event => event.stopPropagation());

const writeUrl = () => {
    const next = new URLSearchParams(location.search);
    next.set('edition', direction.id);
    next.set('relief', currentLogoShape);
    next.set('layout', currentLayout);
    next.set('name', currentNameShape);
    next.set('backdrop', lab.backdrop);
    for (const key of ['exposure', 'bloom', 'idle', 'gyro', 'logoDepth', 'nameDepth', 'yaw', 'pitch']) next.set(key, String(lab[key]));
    if (lab.manualLight) next.set('light', 'manual'); else next.delete('light');
    history.replaceState(null, '', `?${next}${location.hash}`);
};
const reloadWith = (key, value) => {
    writeUrl();
    const next = new URLSearchParams(location.search);
    next.set(key, value);
    location.search = next.toString();
};
panel.querySelectorAll('.segments[data-param]').forEach(group => group.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button && button.getAttribute('aria-pressed') !== 'true') reloadWith(group.dataset.param, button.dataset.value);
}));
// Backdrops are uniforms: they switch live, together with the page colour and UI tone.
const applyBackdrop = id => {
    lab.backdrop = id;
    const backdrop = BACKDROPS[id];
    document.documentElement.classList.toggle('backdrop-light', Boolean(backdrop && backdrop.light));
    document.documentElement.style.backgroundColor = backdrop ? backdrop.css : '';
    document.body.style.backgroundColor = backdrop ? backdrop.css : '';
    panel.querySelectorAll('[data-live="backdrop"] button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === id)));
};
panel.querySelector('[data-live="backdrop"]').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) { applyBackdrop(button.dataset.value); writeUrl(); }
});
applyBackdrop(lab.backdrop);
let reliefQueued = false;
const showValue = input => { panel.querySelector(`output[data-for="${input.name}"]`).textContent = Number(input.value).toFixed(2); };
panel.querySelectorAll('input[type=range]').forEach(input => {
    showValue(input);
    input.addEventListener('input', () => {
        lab[input.name] = Number(input.value);
        // Moving a light slider implies holding the light where it is set.
        if ((input.name === 'yaw' || input.name === 'pitch') && !lab.manualLight) {
            lab.manualLight = true;
            panel.querySelector('input[name=manual]').checked = true;
        }
        showValue(input);
        // Depth changes rebuild the relief maps (a few ms), once per frame at most.
        if (input.name.endsWith('Depth') && !reliefQueued) {
            reliefQueued = true;
            requestAnimationFrame(() => { reliefQueued = false; globalThis.__cardRenderer?.buildRelief(); });
        }
        writeUrl();
    });
});
panel.querySelector('input[name=manual]').addEventListener('change', event => { lab.manualLight = event.target.checked; writeUrl(); });
const setHidden = hidden => {
    panel.hidden = hidden;
    toggle.hidden = !hidden;
    // Hit testing reads the canvas's live screen rect, so the CSS move is safe.
    document.documentElement.classList.toggle('lab-sheet-open', !hidden);
    sessionStorage.setItem('card-lab-open', hidden ? '0' : '1');
};
panel.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'intro') { writeUrl(); location.reload(); }
    if (action === 'reset') location.search = `edition=${direction.id}`;
    if (action === 'hide') setHidden(true);
});
toggle.addEventListener('click', () => setHidden(false));
// On phones the panel starts collapsed; the choice is kept across reloads within the session.
const phone = matchMedia('(max-width: 700px)').matches;
const remembered = sessionStorage.getItem('card-lab-open');
setHidden(remembered === null ? phone : remembered === '0');
window.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'h' && !event.metaKey && !event.ctrlKey && !event.target.closest('input')) setHidden(!panel.hidden);
});

// Display frame rate, measured on the main thread.
const fps = panel.querySelector('.fps');
let frames = 0, since = performance.now();
(function count(now) {
    frames++;
    if (now - since > 1000) {
        const rate = `${Math.round(frames * 1000 / (now - since))} fps`;
        // Visible in both states: panel header when open, the toggle when collapsed.
        fps.textContent = rate;
        toggle.textContent = `Стенд · ${rate}`;
        frames = 0; since = now;
    }
    requestAnimationFrame(count);
})(since);
writeUrl();
