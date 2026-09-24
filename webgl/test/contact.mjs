// Contact interaction regression checks against the built single-file artifact.
// PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs node webgl/test/contact.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifact = resolve(fileURLToPath(new URL('../dist/index.html', import.meta.url)));
const html = await readFile(artifact);
assert.equal(/(?:Россия, Москва|Ulitsa Lva Tolstogo|739-70-00|tel:\+74957397000)/.test(html.toString()), false, 'built HTML contains no address or phone content');
const sourceModules = new Set(['renderer.js', 'data.js', 'engraving.js', 'art-direction.js']);
const server = createServer(async (request, response) => {
    const module = new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
    if (sourceModules.has(module)) {
        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
        response.end(await readFile(resolve(fileURLToPath(new URL(`../${module}`, import.meta.url)))));
        return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
const base = `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.addInitScript(() => {
        Math.random = () => 0.5;
        window.gpu = { model: null, focusRects: [] };
        const proto = WebGLRenderingContext.prototype;
        const getLocation = proto.getUniformLocation;
        proto.getUniformLocation = function (program, name) {
            const location = getLocation.call(this, program, name);
            if (name === 'uFocusRect') window.gpu.focusLocation = location;
            return location;
        };
        const matrix = proto.uniformMatrix4fv;
        proto.uniformMatrix4fv = function (location, transpose, value) {
            if (value[15] === 1) window.gpu.model = [...value];
            else window.gpu.projection = [...value];
            return matrix.call(this, location, transpose, value);
        };
        const rect = proto.uniform4f;
        proto.uniform4f = function (location, x, y, z, w) {
            if (location === window.gpu.focusLocation && x >= 0 && y >= 0 && z > x && w > y) window.gpu.focusRects.push([x, y, z, w]);
            return rect.call(this, location, x, y, z, w);
        };
        window.nativeClicks = [];
        document.addEventListener('click', event => {
            const anchor = event.target.closest?.('.face a');
            if (!anchor) return;
            window.nativeClicks.push({ href: anchor.getAttribute('href'), isTrusted: event.isTrusted });
            event.preventDefault();
        }, true);
    });
    await page.goto(base);
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    const orderPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await orderPage.goto(base);
    await orderPage.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    const tabState = async () => page.evaluate(() => Object.fromEntries(['ru', 'en'].map(lang => [lang,
        [...document.querySelector(`#${lang}`).querySelectorAll('a')].filter(link => link.getClientRects().length > 0)
            .map(link => ({ tabIndex: link.tabIndex, inert: Boolean(link.closest('[inert]')) }))])));
    let state = await tabState();
    assert.equal(state.ru.length, 3, 'Russian desktop face exposes logo and two contact anchors');
    assert.equal(state.en.length, 3, 'English desktop face exposes logo and two contact anchors');
    const faceHrefs = await page.locator('.face--ru a').evaluateAll(links => links.filter(link => link.getClientRects().length > 0).map(link => link.getAttribute('href')));
    assert.deepEqual(faceHrefs, ['https://yandex.ru/company', 'mailto:sbmaxx@yandex-team.ru', 'https://t.me/sbmaxx']);
    const surfaceHrefs = await orderPage.evaluate(async () => {
        const { CardRenderer } = await import('./renderer.js');
        const renderer = await CardRenderer.create(document.createElement('canvas'));
        renderer.resize();
        const hrefs = renderer.surfaces[0].links.map(link => link.url);
        renderer.destroy();
        return hrefs;
    });
    assert.deepEqual(surfaceHrefs, faceHrefs, 'GPU link order matches native face anchor order');
    const enFaceHrefs = await page.locator('.face--en a').evaluateAll(links => links.filter(link => link.getClientRects().length > 0).map(link => link.getAttribute('href')));
    const enSurfaceHrefs = await orderPage.evaluate(async () => {
        const { CardRenderer } = await import('./renderer.js');
        const renderer = await CardRenderer.create(document.createElement('canvas'));
        renderer.resize();
        const hrefs = renderer.surfaces[1].links.map(link => link.url);
        renderer.destroy();
        return hrefs;
    });
    assert.deepEqual(enSurfaceHrefs, enFaceHrefs, 'English GPU link order matches native face anchor order');
    assert.deepEqual(enFaceHrefs, ['https://yandex.com/company', 'mailto:sbmaxx@yandex-team.ru', 'https://t.me/sbmaxx']);
    await orderPage.close();
    assert.deepEqual(state.ru.map(link => link.tabIndex), [0, 0, 0]);
    assert.deepEqual(state.en.map(link => link.tabIndex), [-1, -1, -1]);
    assert.ok(state.en.every(link => link.inert), 'inactive face is inert');

    // Native Tab follows the document order into the logo anchor, then Shift+Tab returns.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'brand');
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => gpu.focusRects.length > 0), 'GPU receives a visible focus outline rectangle');
    await page.screenshot({ path: '/tmp/ya-card-contact-focus-desktop.png' });
    const modelAtFocus = await page.evaluate(() => [...gpu.model]);
    await page.waitForTimeout(500);
    const modelHeld = await page.evaluate(() => [...gpu.model]);
    assert.ok(modelAtFocus.every((value, index) => Math.abs(value - modelHeld[index]) < 1e-5), 'focused anchor holds the card pose');
    const expectedHrefs = await page.locator('.face--ru a').evaluateAll(links => links.filter(link => link.getClientRects().length > 0).map(link => link.getAttribute('href')));
    for (const href of expectedHrefs) {
        if (href !== expectedHrefs[0]) {
            await page.evaluate(() => { gpu.focusRects = []; });
            await page.keyboard.press('Tab');
        }
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), href, `Tab reaches ${href} in face order`);
        await page.waitForFunction(() => gpu.focusRects.length > 0);
    }
    await page.locator('.face--ru a.brand').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'scene');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'brand');

    // Enter dispatches a trusted native anchor click; cancel its default in-page.
    for (const href of ['mailto:sbmaxx@yandex-team.ru', 'https://t.me/sbmaxx']) {
        await page.locator(`.face--ru a[href="${href}"]`).focus();
        const clicksBefore = await page.evaluate(() => nativeClicks.length);
        await page.keyboard.press('Enter');
        const activation = await page.evaluate(count => nativeClicks[count], clicksBefore);
        assert.deepEqual(activation, { href, isTrusted: true }, `Enter performs native trusted activation of ${href}`);
    }

    // Language changes and browser history update the active anchor set.
    await page.locator('[data-lang="en"]').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    state = await tabState();
    assert.deepEqual(state.en.map(link => link.tabIndex), [0, 0, 0]);
    assert.ok(state.ru.every(link => link.tabIndex === -1 && link.inert));
    await page.goBack();
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    await page.goForward();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');

    // A mouse hovering a real GPU link holds the complete card matrix steady;
    // moving away resumes pointer tilt through the renderer's eased pose.
    await page.locator('[data-lang="ru"]').click();
    await page.waitForTimeout(1850);
    const linkPoint = await page.evaluate(() => {
        const m = gpu.model, x = (100 / 545 - 0.5) * 4.235, y = (0.5 - 205 / 300) * 2.333, z = 0.055;
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        const f = gpu.projection[5];
        return { x: (wx * f / (innerWidth / innerHeight) / (7 - wz) + 1) * innerWidth / 2,
            y: (1 - wy * f / (7 - wz)) * innerHeight / 2 };
    });
    await page.mouse.move(linkPoint.x, linkPoint.y);
    await page.waitForFunction(() => document.querySelector('canvas').style.cursor === 'pointer');
    await page.waitForTimeout(150);
    const modelAtHover = await page.evaluate(() => [...gpu.model]);
    await page.waitForTimeout(450);
    const modelHeldAtHover = await page.evaluate(() => [...gpu.model]);
    assert.ok(modelAtHover.every((value, index) => Math.abs(value - modelHeldAtHover[index]) < 1e-5), 'hovering a card link holds its pose');
    await page.mouse.move(1300, 100);
    await page.waitForTimeout(450);
    const modelAfterHover = await page.evaluate(() => [...gpu.model]);
    assert.ok(modelAfterHover.some((value, index) => Math.abs(value - modelHeldAtHover[index]) > 1e-4), 'card motion resumes after leaving a link');

    // A real pointerleave from a hovered link clears the lock even when no
    // further pointermove reaches the document; motion continues on its own.
    const secondLinkPoint = await page.evaluate(() => {
        const m = gpu.model, x = (100 / 545 - 0.5) * 4.235, y = (0.5 - 205 / 300) * 2.333, z = 0.055;
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        const f = gpu.projection[5];
        return { x: (wx * f / (innerWidth / innerHeight) / (7 - wz) + 1) * innerWidth / 2,
            y: (1 - wy * f / (7 - wz)) * innerHeight / 2 };
    });
    await page.mouse.move(secondLinkPoint.x, secondLinkPoint.y);
    await page.waitForFunction(() => document.querySelector('canvas').style.cursor === 'pointer');
    const modelBeforePointerLeave = await page.evaluate(() => [...gpu.model]);
    await page.mouse.move(-50, -50);
    await page.waitForTimeout(1800);
    const modelAfterPointerLeave = await page.evaluate(() => [...gpu.model]);
    assert.ok(modelAfterPointerLeave.some((value, index) => Math.abs(value - modelBeforePointerLeave[index]) > 1e-4), 'pointerleave clears link hold and idle motion resumes without another pointermove');

    // Window blur also clears pointer hover while preserving an actual keyboard
    // focus lock if one exists.
    const thirdLinkPoint = await page.evaluate(() => {
        const m = gpu.model, x = (100 / 545 - 0.5) * 4.235, y = (0.5 - 205 / 300) * 2.333, z = 0.055;
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        const f = gpu.projection[5];
        return { x: (wx * f / (innerWidth / innerHeight) / (7 - wz) + 1) * innerWidth / 2,
            y: (1 - wy * f / (7 - wz)) * innerHeight / 2 };
    });
    await page.mouse.move(thirdLinkPoint.x, thirdLinkPoint.y);
    await page.waitForFunction(() => document.querySelector('canvas').style.cursor === 'pointer');
    await page.locator('.face--ru a.email').focus();
    const modelBeforeWindowBlur = await page.evaluate(() => [...gpu.model]);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(500);
    const modelWithKeyboardFocus = await page.evaluate(() => [...gpu.model]);
    assert.ok(modelWithKeyboardFocus.every((value, index) => Math.abs(value - modelBeforeWindowBlur[index]) < 1e-5), 'window blur clears pointer lock but preserves keyboard focus hold');
    await page.locator('.face--ru a.email').evaluate(anchor => anchor.blur());
    await page.waitForTimeout(1800);
    const modelAfterBlur = await page.evaluate(() => [...gpu.model]);
    assert.ok(modelAfterBlur.some((value, index) => Math.abs(value - modelWithKeyboardFocus[index]) > 1e-4), 'clearing keyboard focus after window blur lets card motion resume');
    await page.locator('[data-lang="en"]').click();
    await page.waitForTimeout(1800);
    const email = page.locator('.face--en a.email');
    await email.focus();
    await page.evaluate(() => { gpu.focusRects = []; });
    await page.waitForFunction(() => gpu.focusRects.length > 0);
    const desktopEmailRect = await page.evaluate(() => gpu.focusRects.at(-1));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    const mobileEmailRect = await page.evaluate(() => gpu.focusRects.at(-1));
    const expectedMobileEmailRect = await page.evaluate(async () => {
        await document.fonts.ready;
        const context = document.createElement('canvas').getContext('2d');
        context.textAlign = 'left';
        context.font = '400 12.5px "Card Onest"';
        const metrics = context.measureText('sbmaxx@yandex-team.ru');
        const x = 34;
        const width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
        const lastDescent = context.measureText('t.me/sbmaxx').actualBoundingBoxDescent;
        const height = 460;
        const baseline = 290 + (height - 76 - 312 - lastDescent) / 2;
        return [x / 300, (baseline - 12.5) / height, (x + width) / 300, (baseline + 7) / height];
    });
    assert.ok(mobileEmailRect.every((value, index) => Math.abs(value - expectedMobileEmailRect[index]) < 0.002), `portrait email UV bounds ${JSON.stringify(mobileEmailRect)} should match ${JSON.stringify(expectedMobileEmailRect)}`);
    assert.ok(desktopEmailRect.some((value, index) => Math.abs(value - mobileEmailRect[index]) > 0.05), 'focus UV bounds change when card layout changes');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(150);
    const restoredDesktopEmailRect = await page.evaluate(() => gpu.focusRects.at(-1));
    assert.ok(restoredDesktopEmailRect.every((value, index) => Math.abs(value - desktopEmailRect[index]) < 0.002), 'resizing back restores the focused email bounds');

    // No-GPU fallback keeps only the selected face visible, native links tabbable,
    // history language changes coherent, and wheel events uncancelled.
    const noGpu = await browser.newPage({ viewport: { width: 390, height: 450 }, hasTouch: true, isMobile: true });
    await noGpu.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl' ? null : getContext.call(this, type, ...args); };
    });
    await noGpu.goto(base);
    await noGpu.waitForFunction(() => document.documentElement.classList.contains('webgl-fallback'));
    assert.equal(await noGpu.locator('.face--ru').isVisible(), true);
    assert.equal(await noGpu.locator('.face--en').isVisible(), false);
    assert.deepEqual(await noGpu.locator('.face--ru a').evaluateAll(links => links.map(link => link.tabIndex)), [0, 0, 0]);
    assert.equal(await noGpu.evaluate(() => {
        const event = new WheelEvent('wheel', { deltaY: 80, bubbles: true, cancelable: true });
        document.querySelector('.scene').dispatchEvent(event);
        return event.defaultPrevented;
    }), false, 'fallback wheel remains native and uncancelled');
    assert.equal(await noGpu.locator('.scene').evaluate(scene => getComputedStyle(scene).touchAction), 'auto', 'fallback restores native touch scrolling');
    const touchCdp = await noGpu.context().newCDPSession(noGpu);
    await touchCdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 420, id: 1 }] });
    await touchCdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 130, id: 1 }] });
    await touchCdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await noGpu.waitForTimeout(100);
    assert.ok(await noGpu.evaluate(() => scrollY > 0), 'fallback touch swipe scrolls the HTML document');
    await noGpu.evaluate(() => scrollTo(0, 0));
    await noGpu.locator('[data-lang="en"]').click();
    assert.equal(await noGpu.locator('.face--en').isVisible(), true);
    assert.equal(await noGpu.locator('.face--ru').isVisible(), false);
    assert.deepEqual(await noGpu.locator('.face--en a').evaluateAll(links => links.map(link => link.tabIndex)), [0, 0, 0]);
    await noGpu.goBack();
    assert.equal(await noGpu.locator('.face--ru').isVisible(), true);
    await noGpu.goForward();
    assert.equal(await noGpu.locator('.face--en').isVisible(), true);

    // With scripts disabled, both printed language faces stay useful and visible.
    const noJs = await browser.newPage({ javaScriptEnabled: false });
    await noJs.goto(base);
    assert.equal(await noJs.locator('.face--ru').isVisible(), true);
    assert.equal(await noJs.locator('.face--en').isVisible(), true);

    // Context loss enters the same native fallback and restoration recovers WebGL.
    await page.goto(base);
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    await page.evaluate(() => {
        window.loseExtension = document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context');
        loseExtension.loseContext();
    });
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-fallback'));
    assert.equal(await page.locator('.face--ru a').evaluateAll(links => links.every(link => link.tabIndex === 0)), true);
    assert.equal(await page.evaluate(() => {
        const event = new WheelEvent('wheel', { deltaY: 80, bubbles: true, cancelable: true });
        document.querySelector('.scene').dispatchEvent(event);
        return event.defaultPrevented;
    }), false, 'context-lost wheel remains native');
    await page.evaluate(() => loseExtension.restoreContext());
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    assert.equal(await page.locator('.face--en').getAttribute('aria-hidden'), 'true');
    assert.deepEqual(errors, []);
    assert.deepEqual(requests.filter(url => !url.startsWith(base) && !url.startsWith('data:')), [], 'built artifact makes no external requests');
    console.log('PASS: desktop and mobile anchors match GPU link order, focus cue and pose hold, Enter mailto/Telegram, RU/EN history, no-GPU/context-loss fallback, native wheel, no-JS faces, no external requests.');
} finally {
    await browser?.close();
    await new Promise(done => server.close(done));
}
