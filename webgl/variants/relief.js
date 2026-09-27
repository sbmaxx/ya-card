// Relief maps for the studio editions. Built once per layout from the glyph
// coverage, as a distance field: for every texel, how far in from the glyph's
// outline it lies and in which direction the outline is. The shader turns that
// into the bevel (the profile's slope at that distance, along that direction).
// A map of finished normals put each bevel's highlight on the texel grid —
// a line thinner than a texel came out as stair-steps; a distance, bilinearly
// filtered, stays exact between texels, so the highlight follows the outline.
// RG = the direction in from the outline (unit, texture x/y); B = the signed
// distance in bevel widths, (d / width + 1) / 2: 0 a width outside, .5 on the
// outline, 1 from the top on — the letter's own antialiased edge; A = coverage.
//
// Shapes (see reliefProfiles and the shader's reliefSlope):
// - `vcut`   — linear walls up to the stroke's centre line: a chiselled V groove.
// - `deboss` — narrow chamfer down to a flat floor.
// - `raised` — a shoulder up to a flat top: a coin's quarter round, a soft
//   curve or a straight 45° edge.

// Distance (layout px) from every texel the glyphs touch to their outline, with
// the direction to it. The outline is the coverage's 50% contour, by marching
// squares: the antialiased edge places it between texels, along a diagonal or
// a curve as well as along a straight edge. Exact up to `reach`, the width of
// the profile: deeper in it is flat, and `reach` stands in for the distance.
// Outside the outline it is negative, as far out again: the shader draws the
// letter's edge from it.
function outlineDistance(alpha, w, h, stepX, stepY, reach) {
    // Squared while searching, one square root at the end.
    const best = new Float32Array(w * h).fill(reach * reach);
    const toX = new Float32Array(w * h), toY = new Float32Array(w * h);
    const spanX = Math.ceil(reach / stepX) + 1, spanY = Math.ceil(reach / stepY) + 1;
    // Texel centres at integer coordinates; segment ends in texels.
    const segment = (ax, ay, bx, by) => {
        const px = ax * stepX, py = ay * stepY, dx = (bx - ax) * stepX, dy = (by - ay) * stepY;
        const length2 = dx * dx + dy * dy;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx)) - spanX), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx)) + spanX);
        const y0 = Math.max(0, Math.floor(Math.min(ay, by)) - spanY), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by)) + spanY);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const i = y * w + x;
            const cx = x * stepX - px, cy = y * stepY - py;
            const t = length2 > 0 ? Math.max(0, Math.min(1, (cx * dx + cy * dy) / length2)) : 0;
            // From the texel to the nearest point of the segment.
            const ex = px + dx * t - x * stepX, ey = py + dy * t - y * stepY, d2 = ex * ex + ey * ey;
            if (d2 < best[i]) { best[i] = d2; toX[i] = ex; toY[i] = ey; }
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
    // Direction in from the outline: inside, away from the nearest point;
    // outside, towards it. None where the profile is flat or at the outline itself.
    const distance = new Float32Array(w * h), dirX = new Float32Array(w * h), dirY = new Float32Array(w * h);
    for (let i = 0; i < distance.length; i++) {
        const inside = alpha[i] >= 128, d = Math.sqrt(best[i]);
        distance[i] = inside ? d : -d;
        if (alpha[i] && d < reach && d > 1e-6) {
            const k = (inside ? -1 : 1) / d;
            dirX[i] = toX[i] * k; dirY[i] = toY[i] * k;
        }
    }
    // The outline is a polyline, and the direction to its nearest point turns in
    // steps at each vertex: on a curve the bevel showed fine radial streaks. A
    // light blur over the glyph's own texels ([1 4 6 4 1], normalised by them)
    // turns it smoothly; where the directions from two sides of a thin stroke
    // meet they cancel, and the crest comes out rounded. The distance is left exact.
    blurInside(dirX, alpha, w, h);
    blurInside(dirY, alpha, w, h);
    return { distance, dirX, dirY };
}

function blurInside(values, alpha, w, h) {
    const kernel = [1, 4, 6, 4, 1];
    const pass = (source, target, dx, dy) => {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (!alpha[i]) { target[i] = 0; continue; }
            let sum = 0, weight = 0;
            for (let k = -2; k <= 2; k++) {
                const xx = x + k * dx, yy = y + k * dy;
                if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                const j = yy * w + xx;
                if (!alpha[j]) continue;
                sum += source[j] * kernel[k + 2];
                weight += kernel[k + 2];
            }
            target[i] = sum / weight;
        }
    };
    const temp = new Float32Array(values.length);
    pass(values, temp, 1, 0);
    pass(temp, values, 0, 1);
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
        const bevel = profile.bevel * (scaled ? (surface.logoScale ?? 1) : 1);
        // A little margin keeps the bilinear and mip filtering away from the crop edge.
        const pad = 6;
        const x0 = Math.max(0, Math.floor(rect[0] * canvas.width) - pad);
        const y0 = Math.max(0, Math.floor(rect[1] * canvas.height) - pad);
        const w = Math.min(canvas.width, Math.ceil(rect[2] * canvas.width) + pad) - x0;
        const h = Math.min(canvas.height, Math.ceil(rect[3] * canvas.height) + pad) - y0;
        const ink = context.getImageData(x0, y0, w, h).data;
        const alpha = new Uint8Array(w * h);
        for (let i = 0; i < alpha.length; i++) alpha[i] = ink[i * 4 + 3];
        const { distance, dirX, dirY } = outlineDistance(alpha, w, h, stepX, stepY, bevel);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (distance[i] <= -bevel) continue;
            const out = ((y0 + y) * canvas.width + x0 + x) * 4;
            map[out] = Math.round(128 + dirX[i] * 127);
            map[out + 1] = Math.round(128 + dirY[i] * 127);
            map[out + 2] = Math.round(Math.max(0, Math.min(1, (distance[i] / bevel + 1) / 2)) * 255);
            map[out + 3] = alpha[i];
        }
    }
    return { data: map, width: canvas.width, height: canvas.height };
}
