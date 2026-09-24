// Light check across poses (lab only). A metal plate is a mirror: what it
// shows is the room in the directions it reflects, and a hand turn or a phone
// tilt swings those directions far from the ones seen at rest. This renders the
// card at every pose a visitor can reach, lays the frames out on one sheet and
// measures the face of the plate in each:
//   brightness — mean face luminance relative to rest (linear);
//   band       — the deepest dark band across the plate between brighter parts,
//                across (↔) and along (↕), relative to the mean;
//   white      — the share of the face that is blown out.
// `__cardPoses()` in the console returns the numbers; `?poses=1` opens the sheet.

export const POSES = [
    { name: 'покой' },
    { name: 'поворот −15°', ry: -15 }, { name: 'поворот +15°', ry: 15 },
    { name: 'поворот −30°', ry: -30 }, { name: 'поворот +30°', ry: 30 },
    { name: 'поворот −42°', ry: -42 }, { name: 'поворот +42°', ry: 42 },
    { name: 'наклон −12°', rx: -12 }, { name: 'наклон +12°', rx: 12 },
    { name: 'наклон −25°', rx: -25 }, { name: 'наклон +25°', rx: 25 },
    { name: 'диагональ ↗', rx: -18, ry: 30 }, { name: 'диагональ ↙', rx: 18, ry: -30 },
    { name: 'телефон от себя', gyro: [-22, 0] }, { name: 'телефон на себя', gyro: [22, 0] },
    { name: 'телефон влево', gyro: [0, -22] }, { name: 'телефон вправо', gyro: [0, 22] },
    // Mid hand spin: the plate held part way through a turn over.
    { name: 'вращение 45°', spin: 45 }, { name: 'вращение 70°', spin: 70 }
];

// What counts as a problem; shown in red on the sheet.
export const LIMITS = { dark: .4, bright: 2.2, band: .12, white: .04 };

const linear = c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
const LUMA = new Float32Array(256).map((_, i) => linear(i));

function project(renderer, x, y, z) {
    const m = renderer.model, focal = renderer.projection[5];
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    const depth = 7 - wz;
    const canvas = renderer.canvas;
    return [(wx / depth * focal / renderer.aspect + 1) / 2 * canvas.width, (1 - wy / depth * focal) / 2 * canvas.height];
}

// Distance from a point to the outline, negative outside (convex, counter-clockwise).
function inside(outline, px, py) {
    let nearest = Infinity;
    for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        const ex = b[0] - a[0], ey = b[1] - a[1], length = Math.hypot(ex, ey) || 1;
        nearest = Math.min(nearest, -(ex * (py - a[1]) - ey * (px - a[0])) / length);
    }
    return nearest;
}

// Deepest dip of a profile below the brighter values on both sides of it.
function band(profile) {
    const values = profile.filter(Number.isFinite);
    let deepest = 0;
    for (let i = 1; i < values.length - 1; i++) {
        const left = Math.max(...values.slice(0, i)), right = Math.max(...values.slice(i + 1));
        deepest = Math.max(deepest, Math.min(left, right) - values[i]);
    }
    return deepest;
}

function measure(renderer, pixels, width, back, side) {
    const surface = renderer.surfaces[side];
    const pad = .03;
    const text = [surface.logoRelief, surface.titleRelief, surface.textRelief];
    // A coarse grid over the face. Bands are measured inside each row (↔) and
    // each column (↕), so a row cut short by the lettering cannot fake one.
    const columns = 16, rows = 10;
    const sum = new Float64Array(columns * rows), count = new Uint32Array(columns * rows);
    const samples = [];
    let white = 0;
    const z = back ? -renderer.halfThickness : renderer.halfThickness;
    for (let j = 0; j < 60; j++) for (let i = 0; i < 96; i++) {
        const u0 = (i + .5) / 96, v0 = (j + .5) / 60;
        const px = (u0 - .5) * renderer.width, py = (.5 - v0) * renderer.height;
        // Clear of the chamfer and of the lettering.
        if (inside(renderer.outline, px, py) < .08) continue;
        let u = u0, v = v0;
        if (back) { if (renderer.vertical) u = 1 - u; else v = 1 - v; }
        if (text.some(r => r && u > r[0] - pad && u < r[2] + pad && v > r[1] - pad && v < r[3] + pad)) continue;
        const [sx, sy] = project(renderer, px, py, z);
        const k = (Math.round(sy) * width + Math.round(sx)) * 4;
        if (k < 0 || k >= pixels.length) continue;
        const r = pixels[k], g = pixels[k + 1], b = pixels[k + 2];
        const luma = .2126 * LUMA[r] + .7152 * LUMA[g] + .0722 * LUMA[b];
        if (Math.max(r, g, b) >= 250) white++;
        samples.push(luma);
        const cell = Math.min(rows - 1, Math.floor(v0 * rows)) * columns + Math.min(columns - 1, Math.floor(u0 * columns));
        sum[cell] += luma; count[cell]++;
    }
    if (!samples.length) return null;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    const cell = (i, j) => count[j * columns + i] > 2 ? sum[j * columns + i] / count[j * columns + i] : NaN;
    const median = values => values.length ? [...values].sort((a, b) => a - b)[values.length >> 1] : 0;
    const bands = lines => median(lines.filter(line => line.filter(Number.isFinite).length >= 5).map(line => band(line) / mean));
    const across = Array.from({ length: rows }, (_, j) => Array.from({ length: columns }, (_, i) => cell(i, j)));
    const along = Array.from({ length: columns }, (_, i) => Array.from({ length: rows }, (_, j) => cell(i, j)));
    return {
        mean, low: sorted[Math.floor(sorted.length * .05)], high: sorted[Math.floor(sorted.length * .95)],
        bandAcross: bands(across), bandAlong: bands(along), white: white / samples.length
    };
}

export function measurePoses(renderer, poses = POSES, { cell = 300 } = {}) {
    // At least two columns, so a phone shows the sheet at a glance.
    cell = Math.min(cell, Math.max(140, Math.floor((innerWidth - 24) / 2) - 8));
    const lab = globalThis.__cardLab;
    const side = ((Math.round(renderer.flipTarget / Math.PI) % 2) + 2) % 2;
    const saved = {
        rotation: [renderer.rotationX, renderer.rotationY, renderer.rotationZ],
        spin: renderer.spin, flip: [renderer.flipAngle, renderer.flipFrom, renderer.flipTarget, renderer.flipProgress],
        gyro: { ...renderer.gyro }, hover: renderer.hoverPointer,
        light: lab && [lab.manualLight, lab.yaw, lab.pitch]
    };
    // The travelling light at the middle of its path, unless set by hand.
    if (lab && !lab.manualLight) Object.assign(lab, { manualLight: true, yaw: 0, pitch: 0 });
    renderer.hoverPointer = null;
    const frame = () => renderer.draw({ rx: 0, ry: 0, rz: 0, zoom: renderer.zoom, flipped: side === 1, animate: false,
        idle: false, freezeTilt: true, freezeHover: true, reduced: false, delta: 1e-4 });
    const canvas = renderer.canvas;
    const copy = Object.assign(document.createElement('canvas'), { width: canvas.width, height: canvas.height });
    const context = copy.getContext('2d', { willReadFrequently: true });
    const [restX, restY, restZ] = renderer.restPose;
    const gain = lab ? lab.gyro : 1;
    const results = [];
    let crop = null, sheet = null, sheetContext = null, cellHeight = 0;
    try {
        for (const pose of poses) {
            const [beta, gamma] = pose.gyro || [0, 0];
            const g = renderer.gyro;
            Object.assign(g, { active: Boolean(pose.gyro), beta, gamma, baseBeta: 0, baseGamma: 0, lastMove: 0,
                x: Math.max(-25, Math.min(25, beta)) * Math.PI / 180, y: Math.max(-25, Math.min(25, gamma)) * Math.PI / 180 });
            // The card itself, and the lean it takes from the phone's tilt.
            renderer.rotationX = restX + (pose.rx || 0) * Math.PI / 180 + g.x * gain * .2 * (pose.gyro ? 1 : 0);
            renderer.rotationY = restY + (pose.ry || 0) * Math.PI / 180 + g.y * gain * .2 * (pose.gyro ? 1 : 0);
            renderer.rotationZ = renderer.vertical ? 0 : restZ;
            // A spin held by the finger: the angle is taken as given.
            renderer.spin = pose.spin ? { dragging: true, angle: saved.flip[2] + pose.spin * Math.PI / 180, velocity: 0 } : null;
            frame();
            context.drawImage(canvas, 0, 0);
            const back = side === 1;
            if (!crop) {
                // The rest pose frames every cell, with room for the turned card.
                const z = back ? -renderer.halfThickness : renderer.halfThickness;
                const points = renderer.outline.map(([x, y]) => project(renderer, x, y, z));
                const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
                const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
                const x0 = Math.max(0, Math.min(...xs) - w * .22), y0 = Math.max(0, Math.min(...ys) - h * .22);
                crop = [x0, y0, Math.min(canvas.width, Math.max(...xs) + w * .22) - x0, Math.min(canvas.height, Math.max(...ys) + h * .22) - y0];
                cellHeight = Math.round(cell * crop[3] / crop[2]);
                const columns = Math.max(1, Math.min(poses.length, Math.floor((innerWidth - 16) / (cell + 8)) || 1));
                const rowsCount = Math.ceil(poses.length / columns);
                sheet = Object.assign(document.createElement('canvas'), { width: columns * (cell + 8) + 8, height: rowsCount * (cellHeight + 60) + 8 });
                sheet.dataset.columns = columns;
                sheetContext = sheet.getContext('2d');
                sheetContext.fillStyle = '#050608';
                sheetContext.fillRect(0, 0, sheet.width, sheet.height);
            }
            const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
            const numbers = measure(renderer, pixels, copy.width, back, side);
            results.push({ ...pose, ...numbers });
            const columns = Number(sheet.dataset.columns), index = results.length - 1;
            const x = 8 + (index % columns) * (cell + 8), y = 8 + Math.floor(index / columns) * (cellHeight + 60);
            sheetContext.drawImage(copy, ...crop, x, y, cell, cellHeight);
        }
    } finally {
        [renderer.rotationX, renderer.rotationY, renderer.rotationZ] = saved.rotation;
        renderer.spin = saved.spin;
        [renderer.flipAngle, renderer.flipFrom, renderer.flipTarget, renderer.flipProgress] = saved.flip;
        Object.assign(renderer.gyro, saved.gyro);
        renderer.hoverPointer = saved.hover;
        if (lab) [lab.manualLight, lab.yaw, lab.pitch] = saved.light;
    }
    const rest = results[0]?.mean || 1;
    for (const result of results) result.brightness = result.mean / rest;
    // Captions: pose, then the numbers; out-of-range values in red.
    const columns = Number(sheet.dataset.columns);
    sheetContext.textBaseline = 'top';
    results.forEach((result, index) => {
        const x = 8 + (index % columns) * (cell + 8), y = 8 + Math.floor(index / columns) * (cellHeight + 60) + cellHeight + 4;
        sheetContext.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
        sheetContext.fillStyle = '#e8ebf0';
        sheetContext.fillText(result.name, x, y);
        sheetContext.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        const parts = [
            [`яркость ${result.brightness.toFixed(2)}×`, result.brightness < LIMITS.dark || result.brightness > LIMITS.bright],
            [`полоса ↔ ${(result.bandAcross * 100).toFixed(0)}%`, result.bandAcross > LIMITS.band],
            [`↕ ${(result.bandAlong * 100).toFixed(0)}%`, result.bandAlong > LIMITS.band],
            [`белое ${(result.white * 100).toFixed(0)}%`, result.white > LIMITS.white]
        ];
        let at = x, line = y + 17;
        for (const [label, bad] of parts) {
            const width = sheetContext.measureText(label).width;
            if (at > x && at + width > x + cell) { at = x; line += 15; }
            sheetContext.fillStyle = bad ? '#ff6b5e' : '#9aa3b0';
            sheetContext.fillText(label, at, line);
            at += width + 8;
        }
    });
    return { results, sheet };
}

export function showPoseSheet(renderer = globalThis.__cardRenderer) {
    if (!renderer) return null;
    document.querySelector('.lab-poses')?.remove();
    const { results, sheet } = measurePoses(renderer);
    const overlay = document.createElement('div');
    overlay.className = 'lab-poses';
    overlay.title = 'Нажмите, чтобы закрыть';
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: 40, overflow: 'auto', background: '#050608f2', cursor: 'zoom-out' });
    Object.assign(sheet.style, { display: 'block', margin: '0 auto', maxWidth: '100%' });
    overlay.append(sheet);
    overlay.addEventListener('click', () => overlay.remove());
    document.body.append(overlay);
    return results;
}

globalThis.__cardPoses = (poses, options) => {
    const renderer = globalThis.__cardRenderer;
    return renderer ? measurePoses(renderer, poses, options).results : null;
};
globalThis.__cardPoseSheet = showPoseSheet;
// The whole sheet as an image, for saving or comparing releases.
globalThis.__cardPoseImage = (poses = POSES, { type = 'image/jpeg', quality = .88, cell } = {}) => {
    const renderer = globalThis.__cardRenderer;
    return renderer ? measurePoses(renderer, poses, cell ? { cell } : {}).sheet.toDataURL(type, quality) : null;
};

// `?poses=1`: open the sheet once the intro is over.
if (new URLSearchParams(location.search).has('poses')) {
    const wait = () => {
        const renderer = globalThis.__cardRenderer;
        if (renderer && renderer.intro >= 1 && renderer.introTime > 3) showPoseSheet(renderer);
        else setTimeout(wait, 250);
    };
    wait();
}
