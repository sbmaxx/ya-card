// Build a shallow recessed profile once per layout. RG stores the tangent-space
// normal, B the cavity depth, A the original coverage of the engraved glyphs.
// Ordinary text is never included. No image readback or map generation per frame.
import { art } from './art-direction.js';

export function createEngravingMap(surface, profiles = art) {
    const { canvas, width, height, titleRelief, logoRelief } = surface;
    const map = new Uint8Array(canvas.width * canvas.height * 4);
    for (let i = 0; i < map.length; i += 4) { map[i] = 128; map[i + 1] = 128; }
    const pixelX = width / canvas.width, pixelY = height / canvas.height;
    const diagonal = Math.hypot(pixelX, pixelY);
    const context = canvas.getContext('2d');
    for (const [rect, profile] of [[titleRelief, profiles.name], [logoRelief, profiles.logo]]) {
        const { raised } = profile;
        // Keep the bevel proportional to the smaller portrait wordmark.
        const scale = profile.machined && width < height ? 100 / 145 : 1;
        const depth = profile.depth * scale, bevel = profile.bevel * scale;
        const x0 = Math.max(0, Math.floor(rect[0] * canvas.width));
        const y0 = Math.max(0, Math.floor(rect[1] * canvas.height));
        const w = Math.min(canvas.width, Math.ceil(rect[2] * canvas.width)) - x0;
        const h = Math.min(canvas.height, Math.ceil(rect[3] * canvas.height)) - y0;
        const ink = context.getImageData(x0, y0, w, h).data;
        const distance = new Float32Array(w * h);
        for (let i = 0; i < distance.length; i++) distance[i] = ink[i * 4 + 3] > 8 ? 1000 : 0;
        // Two chamfer passes in layout units, including the unequal texel aspect.
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (x) distance[i] = Math.min(distance[i], distance[i - 1] + pixelX);
            if (y) {
                distance[i] = Math.min(distance[i], distance[i - w] + pixelY);
                if (x) distance[i] = Math.min(distance[i], distance[i - w - 1] + diagonal);
                if (x + 1 < w) distance[i] = Math.min(distance[i], distance[i - w + 1] + diagonal);
            }
        }
        for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
            const i = y * w + x;
            if (x + 1 < w) distance[i] = Math.min(distance[i], distance[i + 1] + pixelX);
            if (y + 1 < h) {
                distance[i] = Math.min(distance[i], distance[i + w] + pixelY);
                if (x) distance[i] = Math.min(distance[i], distance[i + w - 1] + diagonal);
                if (x + 1 < w) distance[i] = Math.min(distance[i], distance[i + w + 1] + diagonal);
            }
        }
        const heights = new Float32Array(w * h);
        for (let i = 0; i < heights.length; i++) {
            const t = Math.max(0, Math.min(1, (distance[i] - Math.min(pixelX, pixelY) * .5) / bevel));
            // Signed height selects recess or emboss; the depth channel keeps
            // the absolute profile for the material's cavity shading.
            heights[i] = (raised ? 1 : -1) * depth * t * t * (3 - 2 * t) * ink[i * 4 + 3] / 255;
        }
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
            const i = y * w + x, alpha = ink[i * 4 + 3];
            if (!alpha) continue;
            const gx = (heights[i + 1] - heights[i - 1]) / (2 * pixelX);
            const gy = (heights[i + w] - heights[i - w]) / (2 * pixelY);
            const length = Math.hypot(gx, gy, 1);
            const out = ((y0 + y) * canvas.width + x0 + x) * 4;
            map[out] = Math.round(128 - gx / length * 127);
            map[out + 1] = Math.round(128 - gy / length * 127);
            map[out + 2] = Math.round(Math.abs(heights[i]) / depth * 255);
            map[out + 3] = alpha;
        }
    }
    return { data: map, width: canvas.width, height: canvas.height };
}
