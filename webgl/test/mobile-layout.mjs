// Built-page touch checks plus source renderer geometry/ink measurements.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('dist/index.html', root));
const modules = new Set(['renderer.js', 'data.js', 'engraving.js', 'art-direction.js']);
const server = createServer(async (request, response) => {
    const name = new URL(request.url, 'http://local').pathname.slice(1);
    response.writeHead(200, { 'content-type': modules.has(name) ? 'text/javascript' : 'text/html' });
    response.end(modules.has(name) ? await readFile(new URL(name, root)) : html);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
    for (const [width, height, portraitHeight] of [[390, 844, 545], [320, 568, 460], [844, 390, 0], [568, 320, 0]]) {
        const page = await browser.newPage({ viewport: { width, height }, screen: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => { Math.random = () => .5; });
        await page.goto(url);
        await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
        assert.equal(await page.locator('.face a[href*="rozhdestvenskiy.ru"]').count(), 0);
        assert.equal(await page.locator('.links-overlay a[href*="github.com"]').count(), 0);
        const report = await page.evaluate(async () => {
            const { CardRenderer } = await import('./renderer.js');
            const canvas = document.createElement('canvas');
            canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;opacity:0;pointer-events:none';
            document.body.append(canvas);
            const renderer = await CardRenderer.create(canvas);
            renderer.resize();
            renderer.draw({ rx: 0, ry: 0, zoom: 1, animate: false, flipped: false, reduced: true, delta: 1 });
            const surface = renderer.surfaces[0], m = renderer.model;
            const project = (x, y, z = .055) => {
                const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
                const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
                const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
                const f = 1 / Math.tan(Math.PI / 8);
                return { x: (wx * f / (innerWidth / innerHeight) / (7 - wz) + 1) * innerWidth / 2,
                    y: (1 - wy * f / (7 - wz)) * innerHeight / 2 };
            };
            const point = (x, y) => project((x / surface.width - .5) * renderer.width, (.5 - y / surface.height) * renderer.height);
            const links = surface.links.map(link => {
                const p = point(link.x + link.width / 2, link.y + link.height / 2);
                return { url: link.url, hit: renderer.hitTest(p.x, p.y) };
            });
            const inkBounds = renderer.surfaces.map(s => {
                const { width: w, height: h } = s.canvas;
                const pixels = s.canvas.getContext('2d').getImageData(0, 0, w, h).data;
                let left = w, top = h, right = 0, bottom = 0;
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                    if (pixels[(y * w + x) * 4 + 3] < 128) continue;
                    left = Math.min(left, x); right = Math.max(right, x);
                    top = Math.min(top, y); bottom = Math.max(bottom, y);
                }
                return { left: left / w * s.width, right: right / w * s.width,
                    top: top / h * s.height, bottomMargin: (h - bottom) / h * s.height };
            });
            const edge = renderer.outline.map(([x, y]) => project(x, y));
            const blank = point(surface.width * .5, surface.height * .87);
            const result = { vertical: renderer.vertical, layoutHeight: surface.height, inkBounds, links, blank,
                outside: renderer.surfacePoint(5, 5), blankLink: renderer.hitTest(blank.x, blank.y),
                left: Math.min(...edge.map(p => p.x)), right: Math.max(...edge.map(p => p.x)),
                top: Math.min(...edge.map(p => p.y)), bottom: Math.max(...edge.map(p => p.y)),
                footerTop: Math.min(...[...document.querySelectorAll('.languages, .links-overlay')].map(el => el.getBoundingClientRect().top)),
                nativeLinks: [...document.querySelectorAll('.face--ru a')].filter(el => el.getClientRects().length).length };
            renderer.destroy(); canvas.remove();
            return result;
        });
        assert.equal(report.vertical, Boolean(portraitHeight));
        assert.equal(report.layoutHeight, portraitHeight || 300);
        assert.equal(report.nativeLinks, report.links.length);
        assert.equal(report.links.length, 3);
        for (const link of report.links) assert.equal(link.hit, link.url, 'projected link agrees with ray hit');
        for (const ink of report.inkBounds) {
            assert.ok(ink.left >= (portraitHeight ? 32 : 54));
            assert.ok(ink.right <= (portraitHeight ? 276 : 521), 'both language glyphs stay inside horizontal margins');
            assert.ok(Math.abs(ink.top - ink.bottomMargin) < 2, 'actual glyphs have balanced top and bottom margins');
        }
        assert.ok(report.left >= 18 && report.right <= width - 18);
        assert.ok(report.top >= 20 && report.bottom <= report.footerTop - 10, 'card clears the bottom controls');
        assert.equal(report.outside, null);
        assert.equal(report.blankLink, null);
        await page.touchscreen.tap(5, 5);
        assert.equal(await page.locator('html').getAttribute('lang'), 'ru', 'background tap does not flip');
        await page.touchscreen.tap(report.blank.x, report.blank.y);
        assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'touch on actual card flips');
        await page.screenshot({ path: `/tmp/ya-card-mobile-${width}x${height}.png` });
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}x${height}: both language bounds, margins, footer clearance, links and touch flip`);
        await page.close();
    }
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
        const fallback = await browser.newPage({ viewport, javaScriptEnabled: false });
        await fallback.goto(url);
        assert.equal(await fallback.locator('.face:visible').count(), 2);
        assert.equal(await fallback.locator('.face--ru .position').textContent(), 'Руководитель отдела поисковых интерфейсов');
        assert.equal(await fallback.locator('.face--en .position').textContent(), 'Head of search interfaces department');
        assert.ok(await fallback.locator('.face').evaluateAll(faces => faces.every(face => face.scrollWidth <= face.clientWidth)));
        await fallback.screenshot({ path: `/tmp/ya-card-fallback-${viewport.width}.png`, fullPage: true });
        await fallback.close();
    }
    console.log('PASS: no-JS desktop/mobile fallback has both readable, unclipped cards.');
} finally {
    await browser.close();
    await new Promise(done => server.close(done));
}
