// Test-only tool: npm install --prefix /tmp/ya-card-browser-check playwright
// PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/browser.mjs
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.CARD_URL || 'http://127.0.0.1:8080';
const errors = [];
const requests = [];
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.addInitScript(() => {
        // Keep gesture assertions reproducible despite per-load art direction.
        Math.random = () => 0.5;
        window.gpu = { draws: 0, model: null, hoverRects: 0 };
        const proto = WebGLRenderingContext.prototype;
        const uniformNames = new WeakMap();
        const location = proto.getUniformLocation;
        proto.getUniformLocation = function (program, name) {
            const result = location.call(this, program, name);
            if (result) uniformNames.set(result, name);
            return result;
        };
        const draw = proto.drawArrays;
        proto.drawArrays = function (...args) { window.gpu.draws++; return draw.apply(this, args); };
        const matrix = proto.uniformMatrix4fv;
        proto.uniformMatrix4fv = function (location, transpose, value) {
            if (value[15] === 1) window.gpu.model = [...value];
            return matrix.call(this, location, transpose, value);
        };
        const rect = proto.uniform4f;
        proto.uniform4f = function (location, x, y, z, w) {
            if (x >= 0 && z > x && w > y) {
                if (uniformNames.get(location) === 'uHoverRect') window.gpu.hoverRects++;
                if (uniformNames.get(location) === 'uFocusRect') window.gpu.focusRect = [x, y, z, w];
            }
            return rect.call(this, location, x, y, z, w);
        };
    });
    await page.goto(base);
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    assert.ok(await page.evaluate(() => document.fonts.check('500 25px "Card Onest"')
        && document.fonts.check('400 12px "Card Onest"')), 'embedded Cyrillic font loaded before the canvas texture');
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('button').count(), 0, 'no additional controls');
    assert.ok(await page.evaluate(() => gpu.draws > 0), 'actual GPU drawing');
    assert.equal(await page.evaluate(() => document.querySelector('canvas').getContext('webgl').getError()), 0);
    await page.screenshot({ path: '/tmp/ya-card-final-desktop.png' });
    await page.mouse.move(1250, 800);
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => gpu.model[2] > 0 && gpu.model[6] < 0), 'right/bottom edges rise toward the pointer instead of receding');
    assert.ok(await page.evaluate(() => gpu.model[1] < -.002), 'diagonal pointer movement adds a gentle roll around Z');
    assert.equal(await page.evaluate(() => gpu.model[12]), 0, 'hover must not translate the whole card horizontally');
    assert.equal(await page.evaluate(() => gpu.model[14]), 0, 'hover must not translate the whole card in depth');
    await page.mouse.click(1250, 800);
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru', 'background click must not flip');
    await page.waitForTimeout(700);
    const yawBefore = await page.evaluate(() => Math.atan2(-gpu.model[2], gpu.model[0]));
    assert.ok(Math.abs(yawBefore) < .01, 'background click resets the tilt');
    const blankPoint = await page.evaluate(() => {
        // Keep the flip target on bare substrate outside the compact desktop text.
        const m = gpu.model, x = (420 / 545 - .5) * 4.235, y = (.5 - 240 / 300) * 2.333, z = .055;
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        const f = 1 / Math.tan(Math.PI / 8);
        return { x: (wx * f / (innerWidth / innerHeight) / (7 - wz) + 1) * innerWidth / 2,
            y: (1 - wy * f / (7 - wz)) * innerHeight / 2 };
    });
    await page.mouse.click(blankPoint.x, blankPoint.y);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'blank card surface flips');
    await page.waitForTimeout(150);
    const yawAfter = await page.evaluate(() => Math.atan2(-gpu.model[2], gpu.model[0]));
    assert.ok(Math.abs(yawAfter - yawBefore) < .015, 'click must not reset hover tilt while flipping');
    await page.waitForTimeout(1800);
    await page.locator('[data-lang=ru]').click();
    await page.waitForTimeout(1800);
    await page.locator('[data-lang=en]').click();
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.screenshot({ path: '/tmp/ya-card-final-desktop-en.png' });
    assert.equal(await page.title(), 'Roman Rozhdestvenskiy');
    assert.equal(await page.locator('#favicon').getAttribute('href'), await page.locator('#favicon').getAttribute('data-en'));
    await page.goBack();
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    await page.locator('.scene').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1900);
    await page.mouse.move(60, 150);
    await page.mouse.down();
    await page.mouse.move(180, 220, { steps: 8 });
    await page.waitForTimeout(500);
    const held = await page.evaluate(() => gpu.model.slice(0, 12));
    await page.mouse.up();
    await page.waitForTimeout(500);
    const released = await page.evaluate(() => gpu.model.slice(0, 12));
    assert.ok(held.every((value, index) => Math.abs(value - released[index]) < .002), 'released drag retains its angle without rocking');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru', 'drag must not flip');
    await page.locator('.scene').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const lockedAxis = await page.evaluate(() => gpu.model.slice(0, 3));
    await page.mouse.move(1300, 100);
    await page.waitForTimeout(350);
    const stillLocked = await page.evaluate(() => gpu.model.slice(0, 3));
    assert.ok(lockedAxis.every((value, index) => Math.abs(value - stillLocked[index]) < .0001), 'pointer movement cannot steer tilt during a flip');
    await page.waitForTimeout(1600);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1900);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(200);
    const beforeZoom = await page.evaluate(() => gpu.model[0]);
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(100);
    assert.ok((await page.evaluate(() => gpu.model[0])) > beforeZoom, 'wheel zoom');
    await page.locator('.scene').focus();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const stopped = await page.evaluate(() => gpu.draws);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => gpu.draws), stopped, 'reduced motion stops rendering');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: '/tmp/ya-card-final-mobile.png' });
    await page.locator('[data-lang=en]').click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: '/tmp/ya-card-final-mobile-en.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 844);
    // Same physical tilt on both sides, in both layouts; no inverted back-face pitch.
    if (!process.env.ARTIFACT) for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
        const orientation = await browser.newPage({ viewport });
        await orientation.goto(base);
        const alignment = await orientation.evaluate(async () => {
            const { CardRenderer } = await import('./renderer.js');
            const testCanvas = document.createElement('canvas');
            testCanvas.style.cssText = 'position:fixed;width:300px;height:500px;visibility:hidden';
            document.body.append(testCanvas);
            const renderer = await CardRenderer.create(testCanvas);
            renderer.resize();
            const state = { rx: 18, ry: 12, zoom: 1, animate: false, reduced: false, delta: .05 };
            for (let i = 0; i < 60; i++) renderer.draw({ ...state, flipped: false });
            const front = [...renderer.model].slice(8, 11);
            for (let i = 0; i < 60; i++) renderer.draw({ ...state, flipped: true });
            const back = [...renderer.model].slice(8, 11).map(value => -value);
            const dot = front.reduce((sum, value, index) => sum + value * back[index], 0);
            const cosine = dot / (Math.hypot(...front) * Math.hypot(...back));
            renderer.destroy();
            testCanvas.remove();
            return cosine;
        });
        assert.ok(alignment > .99999, `front/back tilt alignment at ${viewport.width}px: ${alignment}`);
        await orientation.close();
    }
    // Verify an actual on-card link through the same model matrix used by the GPU.
    await page.locator('.face--en .telegram').focus();
    await page.waitForFunction(() => gpu.focusRect);
    const linkPoint = await page.evaluate(() => {
        const m = gpu.model;
        const [u0, v0, u1, v1] = gpu.focusRect;
        // Project the actual focused glyph bounds; back-side portrait UV reverses X.
        const x = (.5 - (u0 + u1) / 2) * 2.333, y = (.5 - (v0 + v1) / 2) * 4.235, z = -.055;
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        const f = 1 / Math.tan(Math.PI / 8);
        return { x: (wx * f / (innerWidth / innerHeight) / (7 - wz) + 1) * innerWidth / 2, y: (1 - wy * f / (7 - wz)) * innerHeight / 2 };
    });
    await page.route('https://t.me/sbmaxx', route => route.fulfill({ body: '<p>Link target test</p>', contentType: 'text/html' }));
    await page.evaluate(() => { gpu.hoverRects = 0; });
    await page.mouse.move(linkPoint.x, linkPoint.y);
    await page.waitForTimeout(150);
    assert.equal(await page.locator('canvas').evaluate(canvas => canvas.style.cursor), 'pointer');
    assert.ok(await page.evaluate(() => gpu.hoverRects > 0), 'on-card link hover is underlined on the GPU');
    await page.mouse.click(linkPoint.x, linkPoint.y);
    await page.waitForURL('https://t.me/sbmaxx');
    await page.goto(base);
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    await page.evaluate(() => {
        window.loseExtension = document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context');
        loseExtension.loseContext();
    });
    await page.waitForFunction(() => !document.documentElement.classList.contains('webgl-ready'));
    assert.ok(await page.locator('.face--ru').isVisible());
    await page.evaluate(() => loseExtension.restoreContext());
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    assert.equal(await page.evaluate(() => document.querySelector('canvas').getContext('webgl').getError()), 0);
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    touch.on('pageerror', error => errors.push(error.message));
    await touch.goto(base);
    await touch.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    const cdp = await touch.context().newCDPSession(touch);
    const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await send('touchStart', [{ x: 110, y: 190, id: 1 }, { x: 230, y: 190, id: 2 }]);
    await send('touchMove', [{ x: 70, y: 190, id: 1 }, { x: 270, y: 190, id: 2 }]);
    await send('touchEnd', []);
    assert.equal(await touch.locator('html').getAttribute('lang'), 'ru', 'pinch must not flip');
    await touch.locator('.scene').focus();
    await touch.keyboard.press('Escape');
    await touch.waitForTimeout(100);
    await touch.touchscreen.tap(20, 750);
    assert.equal(await touch.locator('html').getAttribute('lang'), 'ru', 'background tap must not flip');
    await touch.touchscreen.tap(195, 160);
    assert.equal(await touch.locator('html').getAttribute('lang'), 'en', 'tap flips after pinch');
    const nojs = await browser.newPage({ javaScriptEnabled: false });
    await nojs.goto(base);
    assert.ok(await nojs.locator('.face--ru').isVisible());
    assert.ok(await nojs.locator('.face--en').isVisible());
    const nogpu = await browser.newPage();
    await nogpu.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl' ? null : original.call(this, type, ...args); };
    });
    await nogpu.goto(base);
    await nogpu.waitForTimeout(100);
    assert.equal(await nogpu.evaluate(() => document.documentElement.classList.contains('webgl-loading')), false);
    assert.ok(await nogpu.locator('.face--ru').isVisible());
    if (!process.env.ARTIFACT) {
    // Slow module loading must not flash the fallback layout or a scrollbar.
    const loading = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let releaseModule;
    const moduleGate = new Promise(resolve => { releaseModule = resolve; });
    await loading.route('**/app.js', async route => { await moduleGate; await route.continue(); });
    await loading.goto(base, { waitUntil: 'commit' });
    await loading.waitForFunction(() => document.documentElement.classList.contains('webgl-loading'));
    await loading.waitForTimeout(200);
    assert.equal(await loading.evaluate(() => document.documentElement.scrollHeight), 844);
    assert.equal(await loading.evaluate(() => document.documentElement.scrollWidth), 390);
    assert.equal(await loading.locator('canvas').isVisible(), false);
    releaseModule();
    await loading.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    assert.equal(await loading.evaluate(() => document.documentElement.scrollHeight), 844);
    assert.ok(await loading.locator('canvas').isVisible());
    }
    assert.deepEqual(errors, []);
    const external = requests.filter(url => !url.startsWith(base) && !url.startsWith('data:') && url !== 'https://t.me/sbmaxx');
    assert.deepEqual(external, [], 'no external runtime resources');
    console.log('PASS: native WebGL, RU/EN, history, keyboard, drag, wheel, pinch/tap, reduced motion, raycast links, context recovery, no-JS/no-GPU fallback, no CDN; desktop/mobile screenshots saved to /tmp.');
} finally {
    await browser.close();
}
