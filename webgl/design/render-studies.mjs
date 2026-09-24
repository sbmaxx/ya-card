// Visual comparison only; sources are rendered with a fixed camera/light state.
// No production scripts, agents or external resources are involved.
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/ya-card-browser-check/node_modules/playwright/index.mjs');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, process.env.STUDY_OUTPUT || 'snapshots/2026-09-24-visual-studies');
await mkdir(out, { recursive: true });
const baseline = await mkdtemp(resolve(tmpdir(), 'ya-card-baseline-'));
execFileSync('tar', ['-xzf', resolve(root, process.env.STUDY_BASELINE || 'snapshots/2026-09-24-balanced-baseline/source.tar.gz'), '-C', baseline], { env: { ...process.env, LC_ALL: 'C' } });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer(async (request, response) => {
    try {
        const path = new URL(request.url, 'http://local').pathname;
        const isBaseline = path.startsWith('/baseline/');
        const dir = isBaseline ? baseline : root;
        const relative = path.replace(/^\/(baseline|candidate)\//, '');
        const filename = resolve(dir, relative.endsWith('/') || !relative ? `${relative}index.html` : relative);
        if (!filename.startsWith(`${resolve(dir)}${sep}`)) throw new Error('Outside root');
        let data = await readFile(filename);
        if (extname(filename) === '.html') data = data.toString().replace('<script type="module" src="./app.js"></script>', '');
        response.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream' });
        response.end(data);
    } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const name of (process.env.STUDIES || 'baseline,satin,inset,polished').split(',')) {
        for (const [shot, width, height, rx, ry, zoom, flipped = false, time = 0] of [
            ['desktop', 1440, 1000, 0, 0, 1],
            ['detail', 1440, 1000, -5, 12, 1.8],
            ['studio-tilt', 1440, 1000, 8, -12, 1, false, 9],
            ['edge', 1440, 1000, 8, 76, 1.65],
            ['edge-back', 1440, 1000, 8, 76, 1.65, true],
            ['mobile', 390, 844, 0, 0, 1],
            ['english', 1440, 1000, 0, 0, 1, true],
            ['mobile-en', 390, 844, 0, 0, 1, true],
            ['mobile-light', 390, 844, -7, 11, 1, false, 9],
            ['mobile-oblique', 390, 844, 12, 42, 1],
            ['small-mobile', 320, 568, 0, 0, 1],
            ['small-mobile-en', 320, 568, 0, 0, 1, true],
            ['landscape', 844, 390, 0, 0, 1],
            ['small-landscape', 568, 320, 0, 0, 1],
            ['light', 1440, 1000, -5, 12, 1.8, false, 9]
        ].filter(([shot]) => (process.env.STUDY_SHOTS || 'desktop,detail,mobile').split(',').includes(shot))) {
            const page = await browser.newPage({ viewport: { width, height },
                deviceScaleFactor: Number(process.env.STUDY_DPR || 1),
                isMobile: width <= 700 || shot.includes('landscape'), hasTouch: width <= 700 || shot.includes('landscape') });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => { Math.random = () => .5; });
            await page.goto(`http://127.0.0.1:${server.address().port}/${name === 'baseline' ? 'baseline' : 'candidate'}/index.html?study=${name}&layout=${name}&proportion=${name}&edge=${name}`);
            const info = await page.evaluate(async ({ rx, ry, zoom, flipped, time }) => {
                const { CardRenderer } = await import('./renderer.js');
                const renderer = await CardRenderer.create(document.querySelector('canvas'));
                document.documentElement.classList.add('webgl-ready');
                document.documentElement.classList.remove('webgl-loading');
                clearTimeout(window.cardBootTimeout);
                renderer.resize();
                renderer.time = time;
                for (let i = 0; i < 100; i++) renderer.draw({ rx, ry, rz: 0, zoom, flipped, animate: false, idle: false, reduced: false, delta: .05 });
                document.querySelector('.ambient').style.setProperty('--ambient-opacity', renderer.ambientOpacity);
                document.querySelector('.card-shadow polygon').setAttribute('points', renderer.shadowPoints);
                if (renderer.ambientShift) {
                    document.querySelector('.ambient').style.setProperty('--ambient-x', `${renderer.ambientShift[0]}vw`);
                    document.querySelector('.ambient').style.setProperty('--ambient-y', `${renderer.ambientShift[1]}vh`);
                }
                if (renderer.shadowGradient) {
                    const gradient = document.querySelector('#shadow-density'), filter = document.querySelector('#shadow-soften');
                    ['x1', 'y1', 'x2', 'y2'].forEach((name, i) => gradient.setAttribute(name, renderer.shadowGradient[i]));
                    gradient.children[0].setAttribute('stop-opacity', renderer.shadowGradient[4]);
                    gradient.children[1].setAttribute('stop-opacity', renderer.shadowGradient[5]);
                    ['x', 'y', 'width', 'height'].forEach((name, i) => filter.setAttribute(name, renderer.shadowBounds[i]));
                }
                document.documentElement.lang = flipped ? 'en' : 'ru';
                document.querySelectorAll('[data-lang]').forEach(link => {
                    if (link.dataset.lang === document.documentElement.lang) link.setAttribute('aria-current', 'true');
                    else link.removeAttribute('aria-current');
                });
                window.studyRenderer = renderer;
                return { error: renderer.gl.getError(), links: renderer.surfaces[0].links.length };
            }, { rx, ry, zoom, flipped, time });
            if (errors.length || info.error) throw new Error(`${name}/${shot}: ${errors.join('; ')} GL ${info.error}`);
            await page.screenshot({ path: resolve(out, `${name}-${shot}.png`),
                scale: process.env.STUDY_CSS_SCALE === '1' ? 'css' : 'device' });
            await page.close();
        }
        console.log(`${name}: selected views saved`);
    }
    console.log(out);
} finally {
    await browser?.close();
    await new Promise(done => server.close(done));
    await rm(baseline, { recursive: true, force: true });
}
