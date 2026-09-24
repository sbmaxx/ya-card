// Measure the real app without pointer input; compare with the optional saved baseline.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = await readFile(new URL('../dist/index.html', import.meta.url));
const before = await readFile(new URL('../snapshots/2026-09-24-before-idle-relief/index.html', import.meta.url)).catch(() => null);
const server = createServer((request, response) => response.writeHead(200, { 'content-type': 'text/html' }).end(request.url === '/before' && before ? before : html));
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = {};
try {
    for (const version of before ? ['before', 'after'] : ['after']) {
        for (const [name, width, height, touch] of [['desktop', 1440, 1000, false], ['touch', 390, 844, true], ['small-touch', 320, 568, true], ['landscape', 844, 390, true]]) {
            const page = await browser.newPage({ viewport: { width, height }, isMobile: touch, hasTouch: touch, reducedMotion: 'no-preference' });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => {
                Math.random = () => .5;
                window.motionProbe = { samples: [], lights: [] };
                const p = WebGLRenderingContext.prototype, names = new WeakMap();
                const buffer = p.bufferData;
                p.bufferData = function (target, data, usage) {
                    if (data instanceof Float32Array && data.length % 8 === 0) {
                        motionProbe.vertices = [];
                        for (let i = 0; i < data.length; i += 8) motionProbe.vertices.push([data[i], data[i + 1], data[i + 2]]);
                    }
                    return buffer.call(this, target, data, usage);
                };
                const location = p.getUniformLocation;
                p.getUniformLocation = function (program, name) { const l = location.call(this, program, name); if (l) names.set(l, name); return l; };
                const matrix = p.uniformMatrix4fv;
                p.uniformMatrix4fv = function (l, transpose, value) {
                    if (names.get(l) === 'uModel') { motionProbe.model = [...value]; motionProbe.samples.push([...value]); }
                    return matrix.call(this, l, transpose, value);
                };
                const vector = p.uniform3f;
                p.uniform3f = function (l, ...v) { if (names.get(l) === 'uKeyPosition') motionProbe.lights.push(v); return vector.call(this, l, ...v); };
                const rect = p.uniform4f;
                p.uniform4f = function (l, ...v) { if (names.get(l) === 'uFocusRect' && v[0] >= 0) motionProbe.focus = v; return rect.call(this, l, ...v); };
            });
            await page.goto(`${base}/${version}`);
            await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
            await page.waitForTimeout(4500);
            const report = await page.evaluate(() => {
                const span = values => Math.max(...values) - Math.min(...values);
                const degrees = 180 / Math.PI;
                const bounds = [Infinity, Infinity, -Infinity, -Infinity], f = 1 / Math.tan(Math.PI / 8);
                for (const m of motionProbe.samples) for (const [x, y, z] of motionProbe.vertices) {
                    const w = [0, 1, 2].map(i => m[i] * x + m[i + 4] * y + m[i + 8] * z + m[i + 12]);
                    const px = (w[0] * f / (innerWidth / innerHeight) / (7 - w[2]) + 1) * innerWidth / 2;
                    const py = (1 - w[1] * f / (7 - w[2])) * innerHeight / 2;
                    bounds[0] = Math.min(bounds[0], px); bounds[1] = Math.min(bounds[1], py);
                    bounds[2] = Math.max(bounds[2], px); bounds[3] = Math.max(bounds[3], py);
                }
                return { frames: motionProbe.samples.length,
                    pitch: span(motionProbe.samples.map(m => Math.atan2(m[6], m[5]) * degrees)),
                    yaw: span(motionProbe.samples.map(m => Math.atan2(-m[2], m[0]) * degrees)),
                    roll: span(motionProbe.samples.map(m => Math.atan2(m[1], m[0]) * degrees)),
                    lightX: span(motionProbe.lights.map(v => v[0])), bounds,
                    footerTop: document.querySelector('.languages').getBoundingClientRect().top };
            });
            reports[`${version}/${name}`] = report;
            if (version === 'after') {
                assert.ok(report.frames > 40 && report.pitch > (name === 'landscape' ? 3 : 4) && report.yaw > (name === 'landscape' ? 5 : 8) && report.roll > .6, 'idle visibly changes all three axes');
                if (before) for (const axis of name === 'landscape' ? ['yaw', 'lightX'] : ['pitch', 'yaw', 'lightX']) assert.ok(report[axis] > reports[`before/${name}`][axis] * 1.35, `${name} ${axis} must be clearly stronger than baseline`);
                assert.ok(report.bounds[0] > 1 && report.bounds[1] > 1 && report.bounds[2] < width - 1 && report.bounds[3] < report.footerTop - 1, 'moving mesh stays clear of screen edges and language controls');
            }
            if (version === 'after' && !touch) {
                await page.locator('.face--ru .email').focus();
                await page.waitForFunction(() => motionProbe.focus);
                const point = await page.evaluate(() => {
                    const m = motionProbe.model, [x0, y0, x1, y1] = motionProbe.focus;
                    const x = ((x0 + x1) / 2 - .5) * 4.235, y = (.5 - (y0 + y1) / 2) * 2.333, z = .022;
                    const w = [0, 1, 2].map(i => m[i] * x + m[i + 4] * y + m[i + 8] * z + m[i + 12]);
                    const f = 1 / Math.tan(Math.PI / 8);
                    return { x: (w[0] * f / (innerWidth / innerHeight) / (7 - w[2]) + 1) * innerWidth / 2,
                        y: (1 - w[1] * f / (7 - w[2])) * innerHeight / 2 };
                });
                await page.mouse.move(point.x, point.y);
                await page.locator('.face--ru .email').evaluate(anchor => anchor.blur());
                await page.waitForTimeout(150);
                const held = await page.evaluate(() => motionProbe.model);
                await page.waitForTimeout(450);
                const early = await page.evaluate(() => motionProbe.model);
                assert.ok(held.every((v, i) => Math.abs(v - early[i]) < 1e-5), 'recent hover holds a stable click target');
                await page.waitForTimeout(2500);
                const resumed = await page.evaluate(() => motionProbe.model);
                assert.ok(held.some((v, i) => Math.abs(v - resumed[i]) > .015), 'parked pointer resumes idle instead of freezing forever');
                await page.locator('.face--ru .email').focus();
                await page.waitForTimeout(100);
                const focused = await page.evaluate(() => motionProbe.model);
                await page.waitForTimeout(2100);
                assert.ok((await page.evaluate(() => motionProbe.model)).every((v, i) => Math.abs(v - focused[i]) < 1e-5), 'keyboard focus keeps the pose stable');
                await page.emulateMedia({ reducedMotion: 'reduce' });
                await page.waitForTimeout(300);
                const stopped = await page.evaluate(() => motionProbe.samples.length);
                await page.waitForTimeout(500);
                assert.equal(await page.evaluate(() => motionProbe.samples.length), stopped, 'reduced motion still stops animation');
            }
            assert.deepEqual(errors, []);
            await page.close();
        }
    }
    console.log(JSON.stringify(reports, null, 2));
    console.log('PASS: no-input motion, stronger light travel, temporary pointer hold, stable keyboard focus and reduced motion.');
} finally { await browser.close(); await new Promise(done => server.close(done)); }
