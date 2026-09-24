// Studio diagram: every lighting setup drawn from the renderer's own data.
// `node variants/studio-map.mjs` from `webgl/` writes dist/review/studio.html.
// Two views per setup: the studio from above, and the map of every direction
// the plate can reflect, with how far a phone tilt or a hand turn reaches.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const source = readFileSync(new URL('./renderer.js', import.meta.url), 'utf8');
// The setups are plain data between `const ring` and the loop that follows them.
const block = source.slice(source.indexOf('const ring ='), source.indexOf('for (const setup of Object.values(LIGHT_SETUPS))'))
    .replace('export const LIGHT_SETUPS', 'const LIGHT_SETUPS');
const LIGHT_SETUPS = new Function(`${block}; return LIGHT_SETUPS;`)();
const keyShapes = new Function(`${source.slice(source.indexOf('export const KEY_SHAPES'), source.indexOf('for (const shape of Object.values(KEY_SHAPES))')).replace('export const', 'const')}; return KEY_SHAPES;`)();

const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const clamp01 = x => Math.max(0, Math.min(1, x));
const faceSees = c => { const t = clamp01((c[2] - .4226) / (.6428 - .4226)); return t * t * (3 - 2 * t); };
const deg = r => r * 180 / Math.PI;
const tones = { key: '#ffd79a', fill: '#9fc9ff' };
const colorOf = color => typeof color === 'string' || !color ? tones[color || 'key']
    : `rgb(${color.map(v => Math.round(Math.min(1, v) * 255)).join(',')})`;
// Azimuth 0 = towards the camera, positive = to the viewer's right; elevation up.
const angles = c => { const [x, y, z] = unit(c); return [deg(Math.atan2(x, z)), deg(Math.asin(y))]; };

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function lampsOf(setup) {
    const key = { ...setup.key, size: keyShapes.round.size, color: setup.key.color || 'key', role: 'key' };
    return [key, ...setup.lights.map(light => ({ ...light, role: 'lamp' }))].map(lamp => ({
        ...lamp, face: lamp.role === 'key' ? 1 : lamp.face ?? faceSees(unit(lamp.c)), angle: angles(lamp.c)
    }));
}

const styleFor = lamp => lamp.face >= .99 ? '' : lamp.face <= .01 ? 'stroke-dasharray="4 3"' : 'stroke-dasharray="1.5 2.5"';
const fillOpacity = lamp => lamp.face <= .01 ? .35 : lamp.face < .99 ? .6 : .95;

// Top view: an azimuthal map of the dome, zenith in the middle, the horizon
// on the ring, the floor outside it. The camera is at the bottom.
function planView(setup, lamps) {
    const size = 470, cx = size / 2, cy = size / 2 - 4, R = 132;
    const at = (az, el) => {
        const r = R * (90 - el) / 90, a = az * Math.PI / 180;
        return [cx + r * Math.sin(a), cy + r * Math.cos(a)];
    };
    let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R * 1.62}" fill="#07080b"/>`;
    // The tent: an even lit surround, seen only by the plate's face.
    svg += `<circle cx="${cx}" cy="${cy}" r="${R * 1.33}" fill="none" stroke="#6b7280" stroke-opacity=".25" stroke-width="${R * .5}"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#0e1117" stroke="#3a404a"/>`;
    for (const el of [30, 60]) svg += `<circle cx="${cx}" cy="${cy}" r="${R * (90 - el) / 90}" fill="none" stroke="#272c34" stroke-dasharray="2 4"/>`;
    // The backdrop behind the card.
    svg += `<path d="M ${cx - 120} ${cy - R - 26} Q ${cx} ${cy - R - 52} ${cx + 120} ${cy - R - 26}" fill="none" stroke="#4b5563" stroke-width="7" stroke-linecap="round"/>`;
    svg += `<text x="${cx}" y="${cy - R - 44}" class="small" text-anchor="middle">фон (циклорама)</text>`;
    // The bounce around the camera, ±50°.
    const bounce = [];
    for (let a = -50; a <= 50; a += 5) bounce.push(at(a, 0));
    svg += `<path d="M ${at(-50, 0).join(' ')} ${bounce.map(p => `L ${p.join(' ')}`).join(' ')} L ${at(50, -12).join(' ')} L ${at(-50, -12).join(' ')} Z" fill="#cbd5e1" fill-opacity=".18" stroke="#cbd5e1" stroke-opacity=".5"/>`;
    const [bx, by] = at(0, -6);
    svg += `<text x="${bx}" y="${by + 22}" class="small" text-anchor="middle">экран-отражатель</text>`;
    // Lamps.
    for (const lamp of lamps) {
        const [x, y] = at(...lamp.angle);
        const w = Math.max(5, R * deg(Math.atan(lamp.size[0])) / 90 * 2), h = Math.max(5, R * deg(Math.atan(lamp.size[1])) / 90 * 2);
        const rot = -lamp.angle[0];
        const round = lamp.shape !== 'rect';
        svg += `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${round ? Math.min(w, h) / 2 : 1}"
            fill="${colorOf(lamp.color)}" fill-opacity="${fillOpacity(lamp)}" stroke="#fff" stroke-opacity=".7" ${styleFor(lamp)}/></g>`;
        if (lamp.role === 'key') {
            svg += `<text x="${x - 16}" y="${y + 4}" class="label" text-anchor="end">главный свет</text>`;
            // Its slow travel: ±11° across, ±5° up and down.
            svg += `<path d="M ${at(lamp.angle[0] - 11.5, lamp.angle[1]).join(' ')} A ${R} ${R} 0 0 0 ${at(lamp.angle[0] + 11.5, lamp.angle[1]).join(' ')}" fill="none" stroke="${tones.key}" stroke-dasharray="2 3" marker-end="url(#arrow)"/>`;
        }
    }
    // The card, seen from above, facing the camera; the camera below.
    svg += `<rect x="${cx - 38}" y="${cy - 3}" width="76" height="6" rx="2" fill="#d6dae0"/><path d="M ${cx + 38} ${cy - 3} l 10 3 l -10 3 Z" fill="#d6dae0"/>`;
    svg += `<text x="${cx}" y="${cy - 10}" class="small" text-anchor="middle">визитка</text>`;
    svg += `<g transform="translate(${cx} ${cy + R * 1.62 - 16})"><rect x="-14" y="-8" width="28" height="18" rx="3" fill="#9aa3b0"/><rect x="-6" y="-14" width="12" height="7" rx="2" fill="#9aa3b0"/></g>`;
    svg += `<text x="${cx + 22}" y="${cy + R * 1.62 - 12}" class="small">камера — зритель</text>`;
    svg += `<text x="${cx - 44}" y="${cy + 3}" class="tiny" text-anchor="end">зенит ·</text>`;
    svg += `<text x="${cx + R + 4}" y="${cy - 4}" class="tiny">горизонт</text>`;
    svg += `<text x="${cx + R * 1.2}" y="${cy + R * .75}" class="tiny">пол</text>`;
    return svg + '</svg>';
}

// Map of directions around the card (azimuth × elevation), camera in the middle.
function reflectionMap(setup, lamps) {
    const W = 600, H = 300, X = a => W / 2 + a / 180 * (W / 2), Y = e => H / 2 - e / 90 * (H / 2);
    let svg = `<svg viewBox="-40 -24 ${W + 60} ${H + 64}" width="${W + 60}" height="${H + 64}">`;
    // The tent for the face: brighter on the key's side and above.
    const keySide = Math.sign(setup.key.c[0]) || -1;
    svg += `<defs><linearGradient id="tent-${setup.title}" x1="${keySide < 0 ? 0 : 1}" x2="${keySide < 0 ? 1 : 0}" y1="0" y2="0">
        <stop offset="0" stop-color="#4b5563"/><stop offset="1" stop-color="#1f242c"/></linearGradient></defs>`;
    svg += `<clipPath id="clip-${setup.title}"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>`;
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#tent-${setup.title})"/>`;
    for (let a = -150; a <= 150; a += 30) svg += `<line x1="${X(a)}" x2="${X(a)}" y1="0" y2="${H}" stroke="#ffffff14"/><text x="${X(a)}" y="${H + 14}" class="tiny" text-anchor="middle">${a}°</text>`;
    for (let e = -60; e <= 60; e += 30) svg += `<line x1="0" x2="${W}" y1="${Y(e)}" y2="${Y(e)}" stroke="#ffffff14"/><text x="-6" y="${Y(e) + 3}" class="tiny" text-anchor="end">${e}°</text>`;
    svg += `<text x="${X(0)}" y="${H + 30}" class="small" text-anchor="middle">← влево · к камере · вправо →</text>`;
    svg += `<text x="${X(-180)}" y="${H + 30}" class="small">за карточкой</text><text x="${X(180)}" y="${H + 30}" class="small" text-anchor="end">за карточкой</text>`;
    // Where the chamfer looks: the ring 90° from the camera.
    for (const a of [-90, 90]) svg += `<rect x="${X(a - 12)}" y="0" width="${X(24) - X(0)}" height="${H}" fill="#ffffff" fill-opacity=".05"/>`;
    svg += `<text x="${X(-90)}" y="${H - 6}" class="tiny" text-anchor="middle">кромка</text><text x="${X(90)}" y="${H - 6}" class="tiny" text-anchor="middle">кромка</text>`;
    svg += `<g clip-path="url(#clip-${setup.title})">`;
    // Bounce: ±50° around the camera.
    svg += `<ellipse cx="${X(0)}" cy="${Y(0)}" rx="${X(50) - X(0)}" ry="${Y(0) - Y(45)}" fill="#cbd5e1" fill-opacity=".22" stroke="#cbd5e1" stroke-opacity=".45"/>`;
    // Lamps.
    for (const lamp of lamps) {
        const [a, e] = lamp.angle;
        const round = lamp.shape !== 'rect';
        const k = 1 / Math.max(.45, Math.cos(e * Math.PI / 180));
        const rx = Math.max(3, (X(deg(Math.atan(lamp.size[0]))) - X(0)) * k), ry = Math.max(3, Y(0) - Y(deg(Math.atan(lamp.size[1]))));
        const rr = round ? Math.sqrt(rx * ry) : 0;
        svg += `<g transform="translate(${X(a)} ${Y(e)}) rotate(${deg(-(lamp.roll || 0))})">${round
            ? `<ellipse rx="${Math.max(rr * k * .8, 3)}" ry="${Math.max(rr / k, 3)}"`
            : `<rect x="${-rx}" y="${-ry}" width="${2 * rx}" height="${2 * ry}"`}
            fill="${colorOf(lamp.color)}" fill-opacity="${fillOpacity(lamp)}" stroke="#fff" stroke-opacity=".75" ${styleFor(lamp)}/></g>`;
        if (lamp.role === 'key') {
            svg += `<rect x="${X(a - 11.5)}" y="${Y(e + 4.6)}" width="${X(23) - X(0)}" height="${Y(0) - Y(9.2)}" fill="none" stroke="${tones.key}" stroke-dasharray="2 3"/>`;
            svg += `<text x="${X(a) - 26}" y="${Y(e) + 4}" class="label" text-anchor="end">главный свет</text>`;
        }
    }
    svg += '</g>';
    // How far the plate's reflection reaches.
    const zone = (a, e, label, color, dy) => {
        svg += `<rect x="${X(-a)}" y="${Y(e)}" width="${X(a) - X(-a)}" height="${Y(-e) - Y(e)}" rx="10" fill="none" stroke="${color}" stroke-width="1.6"/>`;
        svg += `<text x="${X(-a) + 6}" y="${Y(e) + 13 + dy}" class="zone" fill="${color}">${label}</text>`;
    };
    zone(15, 9, 'в покое', '#7ee787', 0);
    zone(52, 46, 'наклон телефона', '#f2cc60', 0);
    zone(95, 89, 'поворот рукой', '#ff8f6b', 0);
    return svg + '</svg>';
}

const setups = Object.entries(LIGHT_SETUPS);
const sections = setups.map(([id, setup], i) => {
    const lamps = lampsOf(setup);
    const faceCount = lamps.filter(l => l.face >= .99).length, edgeCount = lamps.filter(l => l.face <= .01).length;
    return `<section id="${id}" ${i ? 'hidden' : ''}>
      <p class="hint">${esc(setup.hint)} Ламп: ${lamps.length}; лицо видит ${faceCount}, только кромка и буквы — ${edgeCount}${lamps.length - faceCount - edgeCount ? `, частично — ${lamps.length - faceCount - edgeCount}` : ''}.</p>
      <div class="views">
        <figure>${planView(setup, lamps)}<figcaption>Студия сверху. Центр — над карточкой, кольцо — горизонт, за кольцом — пол.</figcaption></figure>
        <figure>${reflectionMap(setup, lamps)}<figcaption>Что может отражать пластина: все направления вокруг карточки. Рамки — куда уходит отражение лицевой стороны в покое, при наклоне телефона и при повороте рукой.</figcaption></figure>
      </div></section>`;
}).join('\n');

const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Схема студии — визитка</title>
<style>
  body { margin: 0; padding: 24px 28px 40px; background: #050608; color: #e8ebf0; font: 14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 6px; } p { margin: 0 0 10px; color: #b4bcc8; max-width: 1100px; }
  nav { display: flex; gap: 6px; flex-wrap: wrap; margin: 16px 0 12px; }
  nav button { appearance: none; border: 1px solid #ffffff22; border-radius: 8px; padding: 7px 12px; background: #ffffff0d; color: #e8ebf0; font: inherit; cursor: pointer; }
  nav button[aria-pressed="true"] { background: #ffffff2b; }
  .views { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
  figure { margin: 0; width: min-content; } figcaption { color: #8a93a0; font-size: 12px; margin-top: 4px; }
  .hint { color: #cfd6df; }
  svg text { fill: #aeb6c2; font: 11px -apple-system, BlinkMacSystemFont, sans-serif; }
  svg .small { font-size: 11px; } svg .tiny { font-size: 10px; fill: #7d8693; } svg .label { font-size: 12px; fill: #ffe2b0; font-weight: 600; }
  svg .zone { font-size: 11px; font-weight: 600; }
  .legend { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 18px; color: #aeb6c2; font-size: 12px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .sw { display: inline-block; width: 18px; height: 10px; border-radius: 3px; border: 1px solid #fff9; }
</style>
<h1>Схема студии</h1>
<p>Пластина — почти зеркало: она показывает то, что вокруг, в тех направлениях, куда отражается взгляд. Поворот карточки на θ уводит отражение на 2θ. Поэтому важно не только где лампы, но и докуда дотягивается отражение.</p>
<p>Лицевая сторона и кромка освещены по-разному, как «light linking» в предметной съёмке: лицо живёт в мягком «шатре» (ровная светлая стена вокруг, чуть ярче со стороны главного света) и не видит дальних ламп; кромка и рельеф букв видят все лампы — от них блики на гранях.</p>
<nav>${setups.map(([id, s], i) => `<button type="button" data-id="${id}" aria-pressed="${!i}">${esc(s.title)}</button>`).join('')}</nav>
${sections}
<div class="legend">
  <span><i class="sw" style="background:${tones.key}"></i>тёплый (главный) тон</span>
  <span><i class="sw" style="background:${tones.fill}"></i>холодная заливка</span>
  <span><i class="sw" style="background:#fff;border-style:solid"></i>сплошная рамка — видят лицо и кромка</span>
  <span><i class="sw" style="background:#fff6;border-style:dashed"></i>штрих — только кромка и буквы</span>
  <span><i class="sw" style="background:#fffa;border-style:dotted"></i>пунктир — лицо видит частично и мягче</span>
  <span><i class="sw" style="background:#cbd5e1;opacity:.5"></i>экран-отражатель у камеры</span>
  <span><i class="sw" style="background:linear-gradient(90deg,#4b5563,#1f242c)"></i>«шатёр» для лицевой стороны</span>
</div>
<svg width="0" height="0"><defs><marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="${tones.key}"/></marker></defs></svg>
<script>
  document.querySelector('nav').addEventListener('click', e => {
    const id = e.target.dataset.id; if (!id) return;
    document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id));
    document.querySelectorAll('section').forEach(s => { s.hidden = s.id !== id; });
  });
</script></html>`;

const out = new URL('../dist/review/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('studio.html', out), html);
console.log('dist/review/studio.html');
