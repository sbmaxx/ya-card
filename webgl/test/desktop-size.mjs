// Fixed CSS-pixel size and perspective across real viewport resizes.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('../', import.meta.url), html = await readFile(new URL('dist/index.html', root));
const modules = new Set(['renderer.js', 'data.js', 'engraving.js', 'art-direction.js']);
const server = createServer(async (request, response) => {
    const name = new URL(request.url, 'http://local').pathname.slice(1);
    response.writeHead(200, { 'content-type': modules.has(name) ? 'text/javascript' : 'text/html' });
    response.end(modules.has(name) ? await readFile(new URL(name, root)) : html);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { Math.random = () => .5; });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    await page.evaluate(async () => {
        const { CardRenderer } = await import('./renderer.js');
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;opacity:0;pointer-events:none';
        document.body.append(canvas);
        window.sizeProbe = await CardRenderer.create(canvas);
    });
    const reports = [];
    for (const [width, height] of [[1024, 768], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160], [900, 500], [800, 600], [500, 900], [600, 1200]]) {
        await page.setViewportSize({ width, height });
        const report = await page.evaluate(() => {
            const r = sizeProbe;
            r.resize();
            const measure = (rx, ry, zoom = 1) => {
                r.rotationX = rx * Math.PI / 180; r.rotationY = ry * Math.PI / 180;
                r.rotationZ = r.velocityX = r.velocityY = r.velocityZ = r.lift = r.idleWeight = 0;
                r.zoom = zoom; r.zoomVelocity = 0;
                r.draw({ rx, ry, zoom, flipped: false, animate: false, idle: false, reduced: false, delta: .05 });
                const m = r.model, p = r.projection;
                const project = (x, y, z = r.halfThickness) => {
                    const w = [0, 1, 2].map(i => m[i] * x + m[i + 4] * y + m[i + 8] * z + m[i + 12]);
                    return [(w[0] * p[0] / (7 - w[2]) + 1) * innerWidth / 2,
                        (1 - w[1] * p[5] / (7 - w[2])) * innerHeight / 2];
                };
                const points = r.outline.map(([x, y]) => project(x, y));
                const xs = points.map(v => v[0]), ys = points.map(v => v[1]);
                const s = r.surfaces[0], link = s.links[1];
                const point = project(((link.x + link.width / 2) / s.width - .5) * r.width,
                    (.5 - (link.y + link.height / 2) / s.height) * r.height);
                return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
                    minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys),
                    points: points.map(([x, y]) => [x - innerWidth / 2, y - innerHeight / 2]),
                    hit: r.hitTest(...point) };
            };
            return { flat: measure(0, 0), tilted: measure(12, -18), zoomed: measure(0, 0, 1.25), error: r.gl.getError() };
        });
        assert.equal(report.error, 0);
        for (const pose of ['flat', 'tilted', 'zoomed']) assert.equal(report[pose].hit, 'mailto:sbmaxx@yandex-team.ru');
        assert.ok(report.flat.minX >= 20 && report.flat.maxX <= width - 20);
        assert.ok(report.flat.minY >= 50 && report.flat.maxY <= height - 50);
        assert.ok(report.zoomed.width > report.flat.width * 1.24, 'manual zoom remains available');
        reports.push({ viewport: `${width}x${height}`, ...report });
        if (width === 1440 || width === 2560) await page.screenshot({ path: `/tmp/ya-card-fixed-${width}.png` });
    }
    const regular = reports.slice(0, 5), baseline = regular[0];
    for (const report of regular) {
        assert.ok(report.flat.width >= 758 && report.flat.width <= 764, 'readable desktop width is approximately 760 CSS pixels');
        for (const pose of ['flat', 'tilted']) for (let i = 0; i < report[pose].points.length; i++) {
            report[pose].points[i].forEach((value, axis) => assert.ok(Math.abs(value - baseline[pose].points[i][axis]) < .1, 'size and perspective remain constant as the window grows'));
        }
    }
    assert.ok(reports[5].flat.width < 760 && reports[6].flat.width < 760, 'only constrained windows shrink');
    assert.ok(Math.abs(reports[7].flat.width - reports[8].flat.width) < .1, 'narrow desktop portrait size also stays fixed');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(reports.map(r => ({ viewport: r.viewport, width: +r.flat.width.toFixed(2), height: +r.flat.height.toFixed(2) })), null, 2));
    console.log('PASS: stable desktop size/perspective, small-window fit, manual zoom and accurate ray hits after resize.');
} finally { await browser.close(); await new Promise(done => server.close(done)); }
