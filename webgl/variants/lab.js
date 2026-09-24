// Demo stand: one page, every edition and relief, live light and exposure.
// Edition and relief rebuild the shader, so they reload; the rest is live.
// All settings live in the URL, so a particular look can be shared as a link.
import { directions, direction } from './directions.js';
import { currentLogoShape } from './renderer.js';

const params = new URLSearchParams(location.search);
const number = (key, fallback) => {
    const value = Number.parseFloat(params.get(key));
    return Number.isFinite(value) ? value : fallback;
};
const lab = globalThis.__cardLab = {
    exposure: number('exposure', 1),
    bloom: number('bloom', .45),
    idle: number('idle', 1),
    manualLight: params.get('light') === 'manual',
    yaw: number('yaw', 0),
    pitch: number('pitch', 0)
};

const style = document.createElement('style');
style.textContent = direction.css + `
.lab { position: fixed; top: calc(16px + env(safe-area-inset-top, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); z-index: 30;
  width: 272px; max-height: calc(100svh - 32px); overflow: auto; padding: 14px 14px 12px; border-radius: 14px;
  background: #0b0d12d9; border: 1px solid #ffffff1c; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  color: #e8ebf0; font: 12px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; box-shadow: 0 12px 40px #0008; }
.lab[hidden] { display: none; }
.lab h2 { margin: 0 0 10px; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #9aa3b0;
  display: flex; justify-content: space-between; align-items: center; }
.lab h2 output { letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; color: #cfd6df; }
.lab fieldset { border: 0; margin: 0 0 12px; padding: 0; }
.lab legend { padding: 0; margin-bottom: 6px; color: #9aa3b0; }
.lab .segments { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 2px; padding: 2px; border-radius: 8px; background: #ffffff10; }
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
.lab-toggle { position: fixed; top: calc(16px + env(safe-area-inset-top, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); z-index: 29;
  appearance: none; border: 1px solid #ffffff22; border-radius: 10px; padding: 8px 12px; background: #0b0d12cc; color: #e8ebf0; font: 12px -apple-system, sans-serif; cursor: pointer; }
`;
document.head.append(style);
document.title = `Lab · ${direction.title}`;

const labels = { vcut: 'V-резка', deboss: 'Углублённый', raised: 'Выпуклый' };
const panel = document.createElement('aside');
panel.className = 'lab';
panel.setAttribute('aria-label', 'Демо-стенд');
panel.innerHTML = `
  <h2>Демо-стенд <output class="fps">— fps</output></h2>
  <fieldset><legend>Материал</legend><div class="segments" data-param="edition">
    ${Object.values(directions).map(d => `<button type="button" data-value="${d.id}" aria-pressed="${d.id === direction.id}">${d.title}</button>`).join('')}
  </div></fieldset>
  <fieldset><legend>Логотип</legend><div class="segments" data-param="relief">
    ${Object.entries(labels).map(([id, label]) => `<button type="button" data-value="${id}" aria-pressed="${id === currentLogoShape}">${label}</button>`).join('')}
  </div></fieldset>
  <fieldset><legend>Свет</legend>
    <label class="check"><input type="checkbox" name="manual" ${lab.manualLight ? 'checked' : ''}> Ручное положение (стоп-кадр)</label>
    <label class="range">Поворот <output data-for="yaw"></output><input type="range" name="yaw" min="-1.2" max="1.2" step=".01" value="${lab.yaw}"></label>
    <label class="range">Высота <output data-for="pitch"></output><input type="range" name="pitch" min="-.6" max=".6" step=".01" value="${lab.pitch}"></label>
  </fieldset>
  <fieldset><legend>Картинка</legend>
    <label class="range">Экспозиция <output data-for="exposure"></output><input type="range" name="exposure" min=".4" max="2" step=".01" value="${lab.exposure}"></label>
    <label class="range">Свечение (bloom) <output data-for="bloom"></output><input type="range" name="bloom" min="0" max="1.5" step=".01" value="${lab.bloom}"></label>
    <label class="range">Покачивание <output data-for="idle"></output><input type="range" name="idle" min="0" max="2" step=".05" value="${lab.idle}"></label>
  </fieldset>
  <div class="actions"><button type="button" data-action="intro">Интро заново</button><button type="button" data-action="reset">Сбросить</button><button type="button" data-action="hide">Скрыть</button></div>
  <p>H — скрыть/показать панель. Колесо — зум, перетаскивание — поворот, клик — переворот.</p>`;
const toggle = document.createElement('button');
toggle.className = 'lab-toggle';
toggle.type = 'button';
toggle.textContent = 'Стенд';
toggle.hidden = true;
document.body.append(panel, toggle);
// Pointer movement over the panel must not tilt the card.
for (const type of ['pointermove', 'pointerdown', 'wheel']) panel.addEventListener(type, event => event.stopPropagation());

const writeUrl = () => {
    const next = new URLSearchParams(location.search);
    next.set('edition', direction.id);
    next.set('relief', currentLogoShape);
    for (const key of ['exposure', 'bloom', 'idle', 'yaw', 'pitch']) next.set(key, String(lab[key]));
    if (lab.manualLight) next.set('light', 'manual'); else next.delete('light');
    history.replaceState(null, '', `?${next}${location.hash}`);
};
const reloadWith = (key, value) => {
    writeUrl();
    const next = new URLSearchParams(location.search);
    next.set(key, value);
    location.search = next.toString();
};
panel.querySelectorAll('.segments').forEach(group => group.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button && button.getAttribute('aria-pressed') !== 'true') reloadWith(group.dataset.param, button.dataset.value);
}));
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
        writeUrl();
    });
});
panel.querySelector('input[name=manual]').addEventListener('change', event => { lab.manualLight = event.target.checked; writeUrl(); });
const setHidden = hidden => { panel.hidden = hidden; toggle.hidden = !hidden; };
panel.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'intro') { writeUrl(); location.reload(); }
    if (action === 'reset') location.search = `edition=${direction.id}`;
    if (action === 'hide') setHidden(true);
});
toggle.addEventListener('click', () => setHidden(false));
window.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'h' && !event.metaKey && !event.ctrlKey && !event.target.closest('input')) setHidden(!panel.hidden);
});

// Display frame rate, measured on the main thread.
const fps = panel.querySelector('.fps');
let frames = 0, since = performance.now();
(function count(now) {
    frames++;
    if (now - since > 1000) { fps.textContent = `${Math.round(frames * 1000 / (now - since))} fps`; frames = 0; since = now; }
    requestAnimationFrame(count);
})(since);
writeUrl();
