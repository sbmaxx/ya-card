// Relief maps for the studio editions. Built once per layout from the glyph
// coverage: the distance to the outline, found to a fraction of a texel from
// the antialiased edge, shaped into a profile and smoothed before normals are
// taken. RG = tangent-space normal, B = |height| / depth, A = coverage.
//
// Shapes (heights in layout px):
// - `vcut`   — linear walls up to the stroke's centre line: a chiselled V groove.
// - `deboss` — narrow chamfer down to a flat floor.
// - `raised` — a rounded shoulder up to a flat, polished top.

// Distance (layout px) from every covered texel to the glyph outline. The
// outline is the coverage's 50% contour, by marching squares: the antialiased
// edge places it between texels, along a diagonal or a curve as well as along
// a straight edge. Measured to the texel grid's staircase instead, a diagonal
// or curved stroke rippled its bevel, and a lit shoulder showed the ripple as
// a row of glints. Exact up to `reach`, the width of the profile: deeper in
// it is flat, and `reach` stands in for the distance.
function outlineDistance(alpha, w, h, stepX, stepY, reach) {
    // Squared while searching, one square root at the end.
    const distance = new Float32Array(w * h);
    for (let i = 0; i < distance.length; i++) distance[i] = alpha[i] >= 128 ? reach * reach : -1;
    const spanX = Math.ceil(reach / stepX) + 1, spanY = Math.ceil(reach / stepY) + 1;
    // Texel centres at integer coordinates; segment ends in texels.
    const segment = (ax, ay, bx, by) => {
        const px = ax * stepX, py = ay * stepY, dx = (bx - ax) * stepX, dy = (by - ay) * stepY;
        const length2 = dx * dx + dy * dy;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx)) - spanX), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx)) + spanX);
        const y0 = Math.max(0, Math.floor(Math.min(ay, by)) - spanY), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by)) + spanY);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const i = y * w + x;
            if (alpha[i] < 128) continue;
            const cx = x * stepX - px, cy = y * stepY - py;
            const t = length2 > 0 ? Math.max(0, Math.min(1, (cx * dx + cy * dy) / length2)) : 0;
            const ex = cx - dx * t, ey = cy - dy * t, d2 = ex * ex + ey * ey;
            if (d2 < distance[i]) distance[i] = d2;
        }
    };
    const level = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -.5 : alpha[y * w + x] / 255 - .5);
    const at = (a, b) => a / (a - b);
    for (let y = -1; y < h; y++) for (let x = -1; x < w; x++) {
        // Corners clockwise from the top left; crossings on the edges between them.
        const a = level(x, y), b = level(x + 1, y), c = level(x + 1, y + 1), d = level(x, y + 1);
        const p = [];
        if ((a >= 0) !== (b >= 0)) p.push(x + at(a, b), y);
        if ((b >= 0) !== (c >= 0)) p.push(x + 1, y + at(b, c));
        if ((c >= 0) !== (d >= 0)) p.push(x + 1 - at(c, d), y + 1);
        if ((d >= 0) !== (a >= 0)) p.push(x, y + 1 - at(d, a));
        if (p.length === 4) segment(p[0], p[1], p[2], p[3]);
        else if (p.length === 8) {
            // A saddle: the cell's mean decides which pair of corners is joined.
            if ((a + b + c + d >= 0) === (a >= 0)) { segment(p[0], p[1], p[2], p[3]); segment(p[4], p[5], p[6], p[7]); }
            else { segment(p[6], p[7], p[0], p[1]); segment(p[2], p[3], p[4], p[5]); }
        }
    }
    for (let i = 0; i < distance.length; i++) if (distance[i] > 0) distance[i] = Math.sqrt(distance[i]);
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
        const distance = outlineDistance(alpha, w, h, stepX, stepY, bevel);
        const heights = new Float32Array(w * h);
        for (let i = 0; i < heights.length; i++) {
            const t = Math.max(0, Math.min(1, distance[i] / bevel));
            // Raised letters get a quarter-round shoulder, steep at the plate and
            // flat on top, as on a struck coin: some part of it always faces a
            // light, so every letter carries a bright edge and a dark one. A
            // straight chamfer is one tilt, and glints only at one angle.
            // The soft profile starts and ends level (smootherstep): no crease at
            // the plate or the top. The 45° edge is straight.
            const raised = profile.curve === 1 ? t * t * t * (t * (t * 6 - 15) + 10) : profile.curve === 2 ? t : Math.sin(t * Math.PI / 2);
            heights[i] = sign * depth * (sign > 0 ? raised : t);
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
