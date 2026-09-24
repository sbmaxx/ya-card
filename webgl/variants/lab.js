// Demo stand: one page, every edition and relief, live light and exposure.
// Edition and relief rebuild the shader, so they reload; the rest is live.
// All settings live in the URL, so a particular look can be shared as a link.
import { directions, direction } from './directions.js';
import { encodePreset } from './preset.js';
import { currentLogoShape, currentNameShape, currentBodyShape, currentLayout, BACKDROPS, KEY_SHAPES, LIGHT_SETUPS } from './renderer.js';
import { exported, params, textFields, lab } from './settings.js';

if (!exported) {
const style = document.createElement('style');
style.textContent = direction.css + `
.lab { position: fixed; top: calc(16px + env(safe-area-inset-top, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); z-index: 30;
  width: 312px; max-height: calc(100svh - 32px); overflow: hidden auto;
  /* A thin scrollbar in its own gutter never covers the controls. */
  scrollbar-gutter: stable; scrollbar-width: thin; scrollbar-color: #ffffff38 transparent; padding: 14px 14px 12px; border-radius: 14px;
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
.lab::-webkit-scrollbar { width: 6px; }
.lab::-webkit-scrollbar-thumb { background: #ffffff38; border-radius: 3px; }
.lab::-webkit-scrollbar-track { background: transparent; }
.lab .group { margin: 0 0 10px; padding: 10px 10px 4px; border-radius: 10px; background: #ffffff08; border: 1px solid #ffffff0f; }
.lab .group h3 { margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #e8ebf0; }
.lab .group .segments { margin-bottom: 8px; }
.lab .group label.range { margin-bottom: 8px; }
.lab .group .caption { margin: 2px 2px 6px; color: #9aa4b2; }
.lab .group .hint { margin: -2px 2px 12px; color: #9aa4b2; font-size: 11px; line-height: 1.4; min-height: 2.8em; }
.lab .tint-row { margin-bottom: 9px; }
.lab .tint-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; color: #9aa3b0; }
.lab .mini { display: flex; gap: 1px; padding: 1px; border-radius: 6px; background: #ffffff10; }
.lab .mini button { appearance: none; border: 0; border-radius: 5px; padding: 3px 7px; background: transparent; color: #aab2bd; font: 11px -apple-system, sans-serif; cursor: pointer; }
.lab .mini button[aria-pressed="true"] { background: #ffffff2b; color: #fff; }
.lab .tint-row .swatches { margin-bottom: 0; }
.lab .swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 7px; }
.lab .swatches button { appearance: none; flex: none; width: 16px; height: 16px; border-radius: 50%; border: 1px solid #ffffff33; background: var(--swatch); cursor: pointer; padding: 0; }
.lab .swatches button[aria-pressed="true"] { outline: 2px solid #fff; outline-offset: 2px; }
.lab .swatches .break { flex-basis: 100%; height: 0; }
.lab details.text-fields { margin: 0 0 12px; }
.lab details.text-fields summary { cursor: pointer; color: #9aa3b0; margin-bottom: 6px; }
.lab .field { display: grid; gap: 3px; margin-bottom: 7px; color: #9aa3b0; }
.lab .field input { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 7px; border: 1px solid #ffffff22;
  background: #ffffff0d; color: #e8ebf0; font: 12px/1.3 -apple-system, BlinkMacSystemFont, sans-serif; }
.lab .field input:focus { outline: none; border-color: #ffffff55; background: #ffffff14; }
.lab .close { appearance: none; border: 0; background: #ffffff14; color: #cfd6df; width: 26px; height: 26px; border-radius: 50%;
  font: 16px/26px -apple-system, sans-serif; cursor: pointer; margin-left: 10px; padding: 0; }
.lab .close:hover { background: #ffffff26; }
.lab h2 .meta { display: flex; align-items: center; }
.lab-dock { position: fixed; top: calc(16px + env(safe-area-inset-top, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); z-index: 29;
  display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.lab-dock[hidden] { display: none; }
.lab-toggle, .lab-download { appearance: none; border: 1px solid #ffffff22; border-radius: 10px; padding: 8px 12px; background: #0b0d12cc; color: #e8ebf0; font: 12px -apple-system, sans-serif; cursor: pointer; }
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
  .lab-dock { top: auto; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }
  .lab-toggle, .lab-download { padding: 10px 14px; font-size: 13px; }
  /* With the sheet open, the card moves into the free upper half. */
  .scene, .card-shadow { transition: transform .35s cubic-bezier(.3,0,.2,1); }
  .lab-sheet-open .scene, .lab-sheet-open .card-shadow { transform: translateY(-21svh) scale(.78); }
}
`;
document.head.append(style);
document.title = `Lab · ${direction.title}`;

// Two rows: neutrals light to dark, then the reds used on ya.ru, light to dark.
const BREAK = ['break'];
const swatches = [['', 'Металл'],
    ['f2f1ee', 'Белый'], ['f1e9d6', 'Молочный'], ['e1e6ec', 'Холодный белый'], ['cfd2d6', 'Жемчужный'], ['b4b8bd', 'Светло-серый'],
    ['8a8e94', 'Серый'], ['5d6168', 'Тёмно-серый'], ['3b3f45', 'Графит'], ['25282c', 'Антрацит'], ['111214', 'Чёрный'], BREAK,
    ['fa7e6c', 'Светлый коралл'], ['f8604a', 'Коралловый'], ['fc3f1d', 'Яндекс-красный'], ['ff3333', 'Ярко-красный'],
    ['e00009', 'Красный'], ['ba2528', 'Гранатовый'], ['9d204e', 'Малиновый'], ['890006', 'Тёмно-красный']];
const labels = { vcut: 'V-резка', deboss: 'Углублённый', raised: 'Выпуклый' };
const panel = document.createElement('aside');
panel.className = 'lab';
panel.setAttribute('aria-label', 'Демо-стенд');
// Panel building blocks: one group per lettering object with everything about it.
// Round softboxes, or a long key strip with capsule lamps.
const LAMP_SHAPES = {
    round: { title: 'Круглые', settings: { keyShape: 'round', lamps: 'round' } },
    long: { title: 'Вытянутые', settings: { keyShape: 'strip', lamps: 'capsule' } }
};
const lampShape = () => Object.keys(LAMP_SHAPES).find(id =>
    Object.entries(LAMP_SHAPES[id].settings).every(([key, value]) => lab[key] === value));
const group = (title, body) => `<section class="group"><h3>${title}</h3>${body}</section>`;
const shapeRow = (param, options, current) => `<div class="segments" data-param="${param}">
    ${Object.entries(options).map(([id, label]) => `<button type="button" data-value="${id}" aria-pressed="${id === current}">${label}</button>`).join('')}
  </div>`;
const depthRow = (key, label) => `<label class="range">${label} <output data-for="${key}"></output><input type="range" name="${key}" min="0" max="3" step=".05" value="${lab[key]}"></label>`;
const tintRow = (object, label) => `<div class="tint-row">
    <div class="tint-head"><span>${label}</span><div class="mini" data-finish="${object}">
      <button type="button" data-value="enamel" aria-pressed="${lab.finish[object] === 'enamel'}">Эмаль</button><button type="button" data-value="anod" aria-pressed="${lab.finish[object] === 'anod'}">Анод</button>
    </div></div>
    <div class="swatches" data-tint="${object}Tint">
    ${(object === 'logoFirst' ? [['same', 'Как логотип'], ...swatches] : swatches).map(([hex, title]) => hex === 'break' ? '<span class="break"></span>' : `<button type="button" title="${title}" data-value="${hex}" aria-pressed="${hex === lab[object + 'Tint']}" style="--swatch:${hex === 'same' ? 'conic-gradient(#fff 0 25%,#0000 0 50%,#fff 0 75%,#0000 0) 0 0/8px 8px,#555' : hex ? '#' + hex : 'linear-gradient(135deg,#eee,#777)'}"></button>`).join('')}
  </div></div>`;
panel.innerHTML = `
  <h2>Демо-стенд <span class="meta"><output class="fps">— fps</output><button type="button" class="close" data-action="hide" aria-label="Скрыть панель">×</button></span></h2>
  <fieldset><legend>Материал</legend><div class="segments" data-param="edition">
    ${Object.values(directions).map(d => `<button type="button" data-value="${d.id}" aria-pressed="${d.id === direction.id}">${d.title}</button>`).join('')}
  </div></fieldset>
  <fieldset><legend>Фон</legend><div class="segments" data-live="backdrop">
    ${Object.entries(BACKDROPS).map(([id, b]) => `<button type="button" data-value="${id}" aria-pressed="${id === lab.backdrop}">${b.title}</button>`).join('')}
  </div></fieldset>
  <fieldset><legend>Композиция</legend><div class="segments" data-param="layout">
    <button type="button" data-value="classic" aria-pressed="${currentLayout === 'classic'}">Классика</button>
    <button type="button" data-value="accent" aria-pressed="${currentLayout === 'accent'}">Акцент на имени</button>
  </div></fieldset>
  ${group('Логотип', `
    ${shapeRow('relief', labels, currentLogoShape)}
    ${depthRow('logoDepth', 'Глубина')}
    ${tintRow('logo', 'Цвет')}
    ${tintRow('logoFirst', 'Первая буква')}`)}
  ${group('Имя', `
    ${shapeRow('name', { edition: 'Материал', vcut: 'V-резка', deboss: 'Вглубь', raised: 'Выпуклое' }, currentNameShape)}
    <label class="range">Размер имени <output data-for="nameScale"></output><input type="range" name="nameScale" min=".8" max="1.8" step=".05" value="${lab.nameScale}"></label>
    ${depthRow('nameDepth', 'Глубина')}
    ${tintRow('name', 'Цвет')}`)}
  ${group('Должность и контакты', `
    ${shapeRow('body', { edition: 'Материал', vcut: 'V-резка', deboss: 'Вглубь', raised: 'Выпуклое' }, currentBodyShape)}
    ${depthRow('bodyDepth', 'Глубина')}
    ${tintRow('body', 'Цвет')}
    <label class="range">Приглушение <output data-for="textMute"></output><input type="range" name="textMute" min="0" max=".8" step=".02" value="${lab.textMute}"></label>`)}
  <details class="text-fields"><summary>Текст карточки</summary>
    ${textFields.map(([key, label, placeholder]) => `<label class="field">${label}<input type="text" name="${key}" value="${(params.get(key) || '').replace(/"/g, '&quot;')}" placeholder="${placeholder}" autocomplete="off" spellcheck="false"></label>`).join('')}
  </details>
  ${group('Свет', `
    <div class="caption">Схема</div>
    <div class="segments" data-live="lightSetup">
      ${Object.entries(LIGHT_SETUPS).map(([id, setup]) => `<button type="button" data-value="${id}" aria-pressed="${id === lab.lightSetup}">${setup.title}</button>`).join('')}
    </div>
    <p class="hint" data-hint="lightSetup">${LIGHT_SETUPS[lab.lightSetup].hint}</p>
    <div class="caption">Форма бликов</div>
    <div class="segments" data-live="lampShape">
      ${Object.entries(LAMP_SHAPES).map(([id, shape]) => `<button type="button" data-value="${id}" aria-pressed="${id === lampShape()}">${shape.title}</button>`).join('')}
    </div>
    <label class="range">Размер бликов <output data-for="lampSize"></output><input type="range" name="lampSize" min=".3" max="1.5" step=".05" value="${lab.lampSize}"></label>
    <label class="range">Мягкость <output data-for="keySoft"></output><input type="range" name="keySoft" min="0" max=".35" step=".01" value="${lab.keySoft}"></label>
    <label class="range">Яркость <output data-for="keyGain"></output><input type="range" name="keyGain" min="0" max="1.5" step=".05" value="${lab.keyGain}"></label>`)}
  <div class="tuning"><fieldset><legend>Движение света</legend>
    <label class="check"><input type="checkbox" name="manual" ${lab.manualLight ? 'checked' : ''}> Стоп-кадр света</label>
    <label class="range">Поворот <output data-for="yaw"></output><input type="range" name="yaw" min="-1.2" max="1.2" step=".01" value="${lab.yaw}"></label>
    <label class="range">Высота <output data-for="pitch"></output><input type="range" name="pitch" min="-.6" max=".6" step=".01" value="${lab.pitch}"></label>
  </fieldset>
  <fieldset><legend>Картинка</legend>
    <label class="range">Экспозиция <output data-for="exposure"></output><input type="range" name="exposure" min=".4" max="2" step=".01" value="${lab.exposure}"></label>
    <label class="range">Свечение всего <output data-for="bloom"></output><input type="range" name="bloom" min="0" max="1.5" step=".01" value="${lab.bloom}"></label>
    <label class="range">Свечение букв <output data-for="letterGlow"></output><input type="range" name="letterGlow" min="0" max="2" step=".05" value="${lab.letterGlow}"></label>
    <label class="range">Покачивание <output data-for="idle"></output><input type="range" name="idle" min="0" max="2" step=".05" value="${lab.idle}"></label>
    <label class="range">Гироскоп <output data-for="gyro"></output><input type="range" name="gyro" min="0" max="3" step=".05" value="${lab.gyro}"></label>
  </fieldset></div>
  <div class="actions"><button type="button" data-action="export">Скачать HTML</button><button type="button" data-action="share">Короткая ссылка</button></div>
  <div class="actions"><button type="button" data-action="intro">Интро заново</button><button type="button" data-action="reset">Сбросить</button><button type="button" data-action="hide">Скрыть</button></div>
  <p>H — скрыть/показать панель. Колесо — зум, перетаскивание — поворот, клик — переворот.</p>`;
const toggle = document.createElement('button');
toggle.className = 'lab-toggle';
toggle.type = 'button';
toggle.textContent = 'Стенд';
toggle.hidden = false;
toggle.setAttribute('aria-label', 'Показать панель демо-стенда');
// Collapsed dock: the panel toggle (with fps) and, under it, the export.
const download = Object.assign(document.createElement('button'), { className: 'lab-download', type: 'button', textContent: 'Скачать HTML' });
download.addEventListener('click', () => exportHtml());
const share = Object.assign(document.createElement('button'), { className: 'lab-download', type: 'button', textContent: 'Короткая ссылка' });
share.addEventListener('click', () => copyShortLink(share));
const dock = document.createElement('div');
dock.className = 'lab-dock';
dock.hidden = true;
dock.append(toggle, download, share);
document.body.append(panel, dock);
// Pointer movement over the panel must not tilt the card.
for (const type of ['pointermove', 'pointerdown', 'wheel']) panel.addEventListener(type, event => event.stopPropagation());

const writeUrl = () => {
    const next = new URLSearchParams(location.search);
    next.set('edition', direction.id);
    next.set('relief', currentLogoShape);
    next.set('layout', currentLayout);
    next.set('name', currentNameShape);
    next.set('body', currentBodyShape);
    next.set('backdrop', lab.backdrop);
    for (const key of ['exposure', 'bloom', 'letterGlow', 'keyGain', 'keySoft', 'lampSize', 'idle', 'gyro', 'logoDepth', 'nameDepth', 'nameScale', 'bodyDepth', 'textMute', 'yaw', 'pitch']) next.set(key, String(lab[key]));
    if (lab.manualLight) next.set('light', 'manual'); else next.delete('light');
    for (const key of ['logoTint', 'nameTint', 'bodyTint']) if (lab[key]) next.set(key, lab[key]); else next.delete(key);
    if (lab.logoFirstTint === 'same') next.delete('logoFirstTint');
    else next.set('logoFirstTint', lab.logoFirstTint || 'metal');
    next.set('panel', panel.hidden ? '0' : '1');
    next.set('keyShape', lab.keyShape);
    next.set('lamps', lab.lamps);
    next.set('lightSetup', lab.lightSetup);
    for (const [key] of textFields) if (lab.text[key]) next.set(key, lab.text[key]); else next.delete(key);
    next.delete('tintFinish');
    for (const [key, value] of Object.entries(lab.finish)) next.set(`${key}Finish`, value);
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
// Backdrops are uniforms: they switch live, together with the page colour.
const applyBackdrop = id => {
    lab.backdrop = id;
    const backdrop = BACKDROPS[id];
    // Page colour before the first frame; the renderer then matches the edges.
    document.documentElement.style.backgroundColor = backdrop ? backdrop.css : '';
    panel.querySelectorAll('[data-live="backdrop"] button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === id)));
};
panel.querySelector('[data-live="backdrop"]').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) { applyBackdrop(button.dataset.value); writeUrl(); }
});
applyBackdrop(lab.backdrop);
// Text edits rebuild textures after a short pause in typing.
let textTimer = 0;
panel.querySelectorAll('.text-fields input').forEach(input => input.addEventListener('input', () => {
    lab.text[input.name] = input.value;
    clearTimeout(textTimer);
    textTimer = setTimeout(() => { globalThis.__cardRenderer?.refreshText(); writeUrl(); }, 200);
}));
panel.addEventListener('keydown', event => event.stopPropagation());
panel.querySelectorAll('[data-tint]').forEach(row => row.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    lab[row.dataset.tint] = button.dataset.value;
    row.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    writeUrl();
}));
panel.querySelector('[data-live="lightSetup"]').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    lab.lightSetup = button.dataset.value;
    panel.querySelectorAll('[data-live="lightSetup"] button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    panel.querySelector('[data-hint="lightSetup"]').textContent = LIGHT_SETUPS[lab.lightSetup].hint;
    writeUrl();
});
// One switch for the shape of every highlight: the key softbox and the other lamps.
panel.querySelector('[data-live="lampShape"]').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    Object.assign(lab, LAMP_SHAPES[button.dataset.value].settings);
    panel.querySelectorAll('[data-live="lampShape"] button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    writeUrl();
});
panel.querySelectorAll('[data-finish]').forEach(group => group.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    lab.finish[group.dataset.finish] = button.dataset.value;
    group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    writeUrl();
}));
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
        // Name size redraws the text and its relief; debounced like typing.
        if (input.name === 'nameScale') {
            clearTimeout(textTimer);
            textTimer = setTimeout(() => globalThis.__cardRenderer?.refreshText(), 60);
        }
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
    dock.hidden = !hidden;
    // Hit testing reads the canvas's live screen rect, so the CSS move is safe.
    document.documentElement.classList.toggle('lab-sheet-open', !hidden);
    sessionStorage.setItem('card-lab-open', hidden ? '0' : '1');
    writeUrl();
};
panel.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'intro') { writeUrl(); location.reload(); }
    if (action === 'reset') location.search = `edition=${direction.id}`;
    if (action === 'hide') setHidden(true);
    if (action === 'export') exportHtml();
    if (action === 'share') copyShortLink(event.target.closest('button'));
});
toggle.addEventListener('click', () => setHidden(false));
// On phones the panel starts collapsed; the choice is kept across reloads within the session.
const phone = matchMedia('(max-width: 700px)').matches;
// `?panel=0|1` wins, then the session's last choice, then the device default.
const fromUrl = params.get('panel');
const remembered = sessionStorage.getItem('card-lab-open');
setHidden(fromUrl === '0' || fromUrl === '1' ? fromUrl === '0' : remembered === null ? phone : remembered === '0');
window.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'h' && !event.metaKey && !event.ctrlKey && !event.target.closest('input')) setHidden(!panel.hidden);
});

// Export: this page's own self-contained HTML with the current settings baked
// in as a preset, without the panel, navigation or noindex; the accessible HTML
// copy of the card gets the edited text and serves as the no-WebGL fallback.
// Every setting as one short code; custom card text travels as plain parameters.
async function copyShortLink(button) {
    writeUrl();
    const params = new URLSearchParams(location.search);
    const extra = new URLSearchParams();
    for (const [key] of textFields) if (lab.text[key]) extra.set(key, lab.text[key]);
    const url = `${location.origin}${location.pathname}?c=${encodePreset(params)}${extra.size ? `&${extra}` : ''}${location.hash}`;
    const label = button.textContent;
    try {
        await navigator.clipboard.writeText(url);
        button.textContent = 'Скопировано';
    } catch {
        prompt('Короткая ссылка', url);
    }
    setTimeout(() => { button.textContent = label; }, 1600);
}

async function exportHtml() {
    writeUrl();
    const source = await (await fetch(location.pathname, { cache: 'no-store' })).text();
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const preset = new URLSearchParams(location.search);
    preset.delete('panel');
    doc.querySelector('meta[name="robots"]')?.remove();
    const boot = [...doc.head.querySelectorAll('script')].find(script => script.textContent.includes('cardBootTimeout'));
    if (boot) {
        boot.textContent = boot.textContent
            .replace(/location\.replace\([^)]*\)/, 'document.documentElement.classList.remove("webgl-loading")')
            .replace(/,?\s*window\.cardFallbackUrl\s*=\s*["'][^"']*["']/, '');
        boot.insertAdjacentHTML('beforebegin', `<script>window.__cardPreset=${JSON.stringify(preset.toString())}<\/script>`);
    }
    const text = lab.text;
    for (const lang of ['ru', 'en']) {
        const face = doc.querySelector(`.face--${lang}`);
        if (!face) continue;
        const name = text[`name_${lang}`], role = text[`role_${lang}`];
        if (name) face.querySelector('h1').innerHTML = name.trim().split(/\s+/).map(word => `<span>${word.replace(/</g, '&lt;')}</span>`).join(' ');
        if (role) face.querySelector('.position').textContent = role.trim().replace(/^./, c => c.toUpperCase());
        const login = (text.email || '').trim();
        if (login) {
            const email = login.includes('@') ? login : `${login}@yandex-team.ru`;
            const link = face.querySelector('.email');
            link.href = `mailto:${email}`;
            link.firstChild.textContent = `${email} `;
        }
        const telegram = (text.telegram || '').trim().replace(/^(https?:\/\/)?t\.me\//, '').replace(/^@/, '');
        if (telegram) {
            const link = face.querySelector('.telegram');
            link.href = `https://t.me/${telegram}`;
            link.firstChild.textContent = `t.me/${telegram} `;
        }
    }
    if (text.name_ru) doc.title = text.name_ru.trim();
    const html = '<!doctype html>\n' + doc.documentElement.outerHTML;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const anchor = Object.assign(document.createElement('a'), { href: url, download: `card-${direction.id}.html` });
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    globalThis.__cardLastExport = html;
}

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
        const warm = globalThis.__cardRenderer?.settleStats;
        if (warm) fps.title = `Прогрев до показа: ${warm.frames} кадров, ${Math.round(warm.total)} мс; интервал ${warm.last.toFixed(1)} мс`;
        frames = 0; since = now;
    }
    requestAnimationFrame(count);
})(since);
writeUrl();
}
