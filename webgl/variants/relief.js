// Relief maps for the studio editions. Built once per layout from the glyph
// coverage: an exact Euclidean distance field (Felzenszwalb & Huttenlocher),
// corrected by the antialiased edge, shaped into a profile and smoothed before
// normals are taken. RG = tangent-space normal, B = |height| / depth, A = coverage.
//
// Shapes (heights in layout px):
// - `vcut`   — linear walls up to the stroke's centre line: a chiselled V groove.
// - `deboss` — narrow chamfer down to a flat floor.
// - `raised` — a rounded shoulder up to a flat, polished top.

const FAR = 1e20;

// 1-D squared distance transform over samples spaced `step` apart.
function transform1d(f, n, step, out, v, z) {
    let k = 0;
    v[0] = 0; z[0] = -FAR; z[1] = FAR;
    for (let q = 1; q < n; q++) {
        const xq = q * step;
        let s;
        for (;;) {
            const xv = v[k] * step;
            s = ((f[q] + xq * xq) - (f[v[k]] + xv * xv)) / (2 * (xq - xv));
            if (s > z[k] || k === 0) break;
            k--;
        }
        if (s <= z[k]) { v[0] = q; z[0] = -FAR; z[1] = FAR; k = 0; continue; }
        k++; v[k] = q; z[k] = s; z[k + 1] = FAR;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
        const xq = q * step;
        while (z[k + 1] < xq) k++;
        const dx = xq - v[k] * step;
        out[q] = dx * dx + f[v[k]];
    }
}

// Distance (layout px) from every covered texel to the nearest uncovered one.
function insideDistance(alpha, w, h, stepX, stepY) {
    const grid = new Float64Array(w * h);
    for (let i = 0; i < grid.length; i++) grid[i] = alpha[i] >= 128 ? FAR : 0;
    const n = Math.max(w, h);
    const f = new Float64Array(n), out = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
        transform1d(f, h, stepY, out, v, z);
        for (let y = 0; y < h; y++) grid[y * w + x] = out[y];
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
        transform1d(f, w, stepX, out, v, z);
        for (let x = 0; x < w; x++) grid[y * w + x] = out[x];
    }
    const texel = (stepX + stepY) / 2;
    const distance = new Float32Array(w * h);
    for (let i = 0; i < distance.length; i++) {
        // The true contour lies inside the edge texels: shift by the coverage.
        distance[i] = alpha[i] >= 128
            ? Math.sqrt(grid[i]) - texel * (1.5 - alpha[i] / 255)
            : (alpha[i] / 255 - .5) * texel;
    }
    return distance;
}

// Separable [1 4 6 4 1] / 16 blur, `passes` times.
function smooth(values, w, h, passes) {
    const temp = new Float32Array(values.length);
    for (let pass = 0; pass < passes; pass++) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const a = values[y * w + Math.max(0, x - 2)], b = values[y * w + Math.max(0, x - 1)];
            const c = values[y * w + Math.min(w - 1, x + 1)], d = values[y * w + Math.min(w - 1, x + 2)];
            temp[i] = (a + 4 * b + 6 * values[i] + 4 * c + d) / 16;
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const a = temp[Math.max(0, y - 2) * w + x], b = temp[Math.max(0, y - 1) * w + x];
            const c = temp[Math.min(h - 1, y + 1) * w + x], d = temp[Math.min(h - 1, y + 2) * w + x];
            values[i] = (a + 4 * b + 6 * temp[i] + 4 * c + d) / 16;
        }
    }
}

export function createReliefMap(surface, profiles) {
    const { canvas, width, height, titleRelief, logoRelief, textRelief } = surface;
    const map = new Uint8Array(canvas.width * canvas.height * 4);
    for (let i = 0; i < map.length; i += 4) { map[i] = 128; map[i + 1] = 128; }
    const stepX = width / canvas.width, stepY = height / canvas.height;
    const context = canvas.getContext('2d');
    const regions = [[titleRelief, profiles.name, false], [logoRelief, profiles.logo, true]];
    // Role and contacts only get a relief when a shape was chosen for them.
    if (profiles.text && textRelief) regions.push([textRelief, profiles.text, false]);
    for (const [rect, profile, scaled] of regions) {
        const scale = scaled ? (surface.logoScale ?? 1) : 1;
        const depth = profile.depth * scale, bevel = profile.bevel * scale;
        const sign = profile.shape === 'raised' ? 1 : -1;
        // A little margin keeps the smoothing kernel away from the crop edge.
        const pad = 6;
        const x0 = Math.max(0, Math.floor(rect[0] * canvas.width) - pad);
        const y0 = Math.max(0, Math.floor(rect[1] * canvas.height) - pad);
        const w = Math.min(canvas.width, Math.ceil(rect[2] * canvas.width) + pad) - x0;
        const h = Math.min(canvas.height, Math.ceil(rect[3] * canvas.height) + pad) - y0;
        const ink = context.getImageData(x0, y0, w, h).data;
        const alpha = new Uint8Array(w * h);
        for (let i = 0; i < alpha.length; i++) alpha[i] = ink[i * 4 + 3];
        const distance = insideDistance(alpha, w, h, stepX, stepY);
        const heights = new Float32Array(w * h);
        for (let i = 0; i < heights.length; i++) {
            const t = Math.max(0, Math.min(1, distance[i] / bevel));
            // Raised letters get a quarter-round shoulder, steep at the plate and
            // flat on top, as on a struck coin: some part of it always faces a
            // light, so every letter carries a bright edge and a dark one. A
            // straight chamfer is one tilt, and glints only at one angle.
            heights[i] = sign * depth * (sign > 0 ? Math.sin(t * Math.PI / 2) : t);
        }
        // Two passes round the V crease and the chamfer shoulders just enough
        // to remove texel steps; one pass is enough for a narrow chamfer.
        smooth(heights, w, h, profile.shape === 'vcut' ? 2 : 1);
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
            const i = y * w + x, a = alpha[i];
            if (!a) continue;
            const gx = (heights[i + 1] - heights[i - 1]) / (2 * stepX);
            const gy = (heights[i + w] - heights[i - w]) / (2 * stepY);
            const length = Math.hypot(gx, gy, 1);
            const out = ((y0 + y) * canvas.width + x0 + x) * 4;
            map[out] = Math.round(128 - gx / length * 127);
            map[out + 1] = Math.round(128 - gy / length * 127);
            map[out + 2] = Math.round(Math.min(1, Math.abs(heights[i]) / depth) * 255);
            map[out + 3] = a;
        }
    }
    return { data: map, width: canvas.width, height: canvas.height };
}
