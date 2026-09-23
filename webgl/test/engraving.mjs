// Requires installed Google Chrome and an external test-only Playwright package.
// PLAYWRIGHT_MODULE=/tmp/ya-card-browser-check/node_modules/playwright/index.mjs \
//   node webgl/test/engraving.mjs
// Starts its own localhost server on an available port and closes it on exit.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
        if (!file.startsWith(`${resolve(root)}${sep}`)) throw new Error('Outside fixture root');
        const bytes = await readFile(file);
        response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
        response.end(bytes);
    } catch {
        response.writeHead(404).end();
    }
});
await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
});
let browser;
try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { Math.random = () => 0.5; });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'));
    const result = await page.evaluate(async () => {
        const { CardRenderer } = await import('./renderer.js');
        const { createEngravingMap } = await import('./engraving.js');
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:1000px;height:700px';
        document.body.append(canvas);
        const renderer = await CardRenderer.create(canvas), gl = renderer.gl;
        const calls = { uploads: 0, mips: 0, create: 0, delete: 0 };
        for (const [method, key] of [['texImage2D', 'uploads'], ['generateMipmap', 'mips'], ['createTexture', 'create'], ['deleteTexture', 'delete']]) {
            const original = gl[method];
            gl[method] = function (...args) { calls[key]++; return original.apply(this, args); };
        }
        const start = performance.now();
        renderer.resize();
        const rebuildMs = performance.now() - start;
        const init = { ...calls };
        const dimensions = renderer.surfaces.map(surface => [surface.canvas.width, surface.canvas.height]);
        const maps = renderer.surfaces.map(surface => {
            const map = createEngravingMap(surface);
            let wrongOutside = 0, covered = 0, depth = 0;
            const normalRange = [255, 0, 255, 0];
            for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
                const i = (y * map.width + x) * 4;
                const inside = [surface.titleRelief, surface.logoRelief].some(rect =>
                    x >= Math.floor(rect[0] * map.width) && x < Math.ceil(rect[2] * map.width)
                    && y >= Math.floor(rect[1] * map.height) && y < Math.ceil(rect[3] * map.height));
                if (!inside && (map.data[i] !== 128 || map.data[i + 1] !== 128 || map.data[i + 2] !== 0 || map.data[i + 3] !== 0)) wrongOutside++;
                if (map.data[i + 3]) {
                    covered++;
                    normalRange[0] = Math.min(normalRange[0], map.data[i]);
                    normalRange[1] = Math.max(normalRange[1], map.data[i]);
                    normalRange[2] = Math.min(normalRange[2], map.data[i + 1]);
                    normalRange[3] = Math.max(normalRange[3], map.data[i + 1]);
                    depth = Math.max(depth, map.data[i + 2]);
                }
            }
            return { wrongOutside, covered, normalRange, depth };
        });
        const state = { rx: 13, ry: -17, rz: 2, zoom: 1, animate: false, reduced: false, delta: .05, flipped: false };
        for (let i = 0; i < 120; i++) renderer.draw(state);
        const afterFrames = { ...calls };
        const filters = renderer.engravingTextures.map(texture => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return [gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER), gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER)];
        });
        const basisReports = [];
        for (const vertical of [false, true]) {
            renderer.rebuild(vertical);
            const uv = [], original = gl.uniform2f;
            gl.uniform2f = function (location, x, y) {
                if (location === renderer.uniforms.uUVBasis) uv.push([x, y]);
                return original.call(this, location, x, y);
            };
            for (let i = 0; i < 60; i++) renderer.draw({ ...state, flipped: false });
            const front = [...renderer.model];
            for (let i = 0; i < 60; i++) renderer.draw({ ...state, flipped: true });
            const back = [...renderer.model];
            gl.uniform2f = original;
            const transform = (matrix, vector) => [0, 1, 2].map(i => matrix[i] * vector[0] + matrix[i + 4] * vector[1] + matrix[i + 8] * vector[2]);
            const unit = vector => { const length = Math.hypot(...vector); return vector.map(value => value / length); };
            // A nontrivial tangent normal must produce the same visible facet
            // on each side, including the different portrait/landscape UV flip.
            const facet = (matrix, side) => {
                const normal = unit(transform(matrix, [0, 0, side ? -1 : 1]));
                const u = unit(transform(matrix, [side && vertical ? -1 : 1, 0, 0]));
                const v = unit(transform(matrix, [0, side && !vertical ? 1 : -1, 0]));
                return unit(normal.map((value, i) => value * Math.sqrt(1 - .3 ** 2 - .4 ** 2) + u[i] * .3 + v[i] * .4));
            };
            basisReports.push({ vertical, uniforms: uv.slice(0, 3), front: facet(front, 0), back: facet(back, 1) });
        }
        const error = gl.getError();
        renderer.destroy();
        const afterDestroy = { ...calls };
        canvas.remove();
        // A known square cavity distinguishes a recess from a raised bevel and
        // checks exact neutral bytes independently of browser glyph outlines.
        const square = document.createElement('canvas');
        square.width = square.height = 128;
        square.getContext('2d').fillRect(32, 32, 64, 64);
        const synthetic = createEngravingMap({ canvas: square, width: 32, height: 32, titleRelief: [.1, .1, .9, .9], logoRelief: [0, 0, .05, .05] });
        const sample = (x, y) => [...synthetic.data.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
        const raised = createEngravingMap({ canvas: square, width: 32, height: 32, titleRelief: [0, 0, .05, .05], logoRelief: [.1, .1, .9, .9] });
        const raisedSample = (x, y) => [...raised.data.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
        return { rebuildMs, dimensions, maps, init, afterFrames, afterDestroy, basisReports, filters, error,
            synthetic: { left: sample(32, 64), right: sample(95, 64), top: sample(64, 32), bottom: sample(64, 95), middle: sample(64, 64), empty: sample(10, 10),
                raisedLeft: raisedSample(32, 64), raisedRight: raisedSample(95, 64), raisedTop: raisedSample(64, 32), raisedBottom: raisedSample(64, 95) } };
    });
    const shading = await page.evaluate(async () => {
        const { CardRenderer } = await import('./renderer.js');
        const { createEngravingMap } = await import('./engraving.js');
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:1440px;height:1000px';
        document.body.append(canvas);
        const renderer = await CardRenderer.create(canvas);
        renderer.resize();
        const gl = renderer.gl;
        let source = [-4, 4, 6];
        const original = gl.uniform3f;
        gl.uniform3f = function (location, ...values) {
            return original.call(this, location, ...(location === renderer.uniforms.uKeyPosition ? source : values));
        };
        const map = createEngravingMap(renderer.surfaces[0]);
        const flat = new Uint8Array(map.data);
        for (let i = 0; i < flat.length; i += 4) { flat[i] = 128; flat[i + 1] = 128; }
        const render = (data, light) => {
            source = light;
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, renderer.engravingTextures[0]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, map.width, map.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.activeTexture(gl.TEXTURE0);
            renderer.draw({ rx: 0, ry: 0, zoom: 1, flipped: false, animate: false, reduced: true, delta: .05 });
            const pixels = new Uint8Array(canvas.width * canvas.height * 4);
            gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return pixels;
        };
        const differences = [], reports = [];
        for (const light of [[-4, 4, 6], [4, 4, 6]]) {
            // Keep depth/coverage identical: this comparison isolates the
            // bevel normals from both ordinary ink and the plate's highlight.
            const actual = render(map.data, light), baseline = render(flat, light);
            const difference = new Int16Array(actual.length / 4);
            let changed = 0, maximum = 0;
            for (let i = 0; i < difference.length; i++) {
                difference[i] = actual[i * 4] - baseline[i * 4];
                if (difference[i]) changed++;
                maximum = Math.max(maximum, Math.abs(difference[i]));
            }
            differences.push(difference);
            reports.push({ light, changed, maximum });
        }
        let changingResponse = 0;
        for (let i = 0; i < differences[0].length; i++) if (differences[0][i] !== differences[1][i]) changingResponse++;
        const error = gl.getError();
        renderer.destroy();
        canvas.remove();
        return { reports, changingResponse, error };
    });
    assert.equal(result.error, 0);
    assert.equal(shading.error, 0);
    assert.deepEqual(errors, []);
    for (const map of result.maps) {
        assert.equal(map.wrongOutside, 0, 'body text and empty metal have no engraving');
        assert.ok(map.covered > 10000, 'glyph atlas contains meaningful coverage');
        const [minX, maxX, minY, maxY] = map.normalRange;
        assert.ok(minX < 128 && maxX > 128 && minY < 128 && maxY > 128, 'normals contain opposing bevel slopes');
        assert.equal(map.depth, 255, 'cavity reaches its matte floor');
    }
    assert.deepEqual(result.init, result.afterFrames, 'no texture uploads or mip generation during 120 frames');
    assert.equal(result.init.create, 4);
    assert.equal(result.init.uploads, 4);
    assert.equal(result.init.mips, 4);
    assert.equal(result.afterDestroy.delete, result.afterDestroy.create, 'all GL textures disposed after rebuild/destroy');
    for (const filters of result.filters) assert.deepEqual(filters, [9987, 9729], 'trilinear mipmaps and linear magnification');
    for (const basis of result.basisReports) {
        assert.deepEqual(basis.uniforms, [[1, -1], basis.vertical ? [-1, -1] : [1, 1], [1, -1]]);
        basis.front.forEach((value, i) => assert.ok(Math.abs(value - basis.back[i]) < 1e-6, 'same visible facet normal on tilted front/back'));
    }
    assert.deepEqual(result.synthetic.middle, [128, 128, 255, 255]);
    assert.deepEqual(result.synthetic.empty, [128, 128, 0, 0]);
    assert.ok(result.synthetic.left[0] > 128 && result.synthetic.right[0] < 128
        && result.synthetic.top[1] > 128 && result.synthetic.bottom[1] < 128, 'recess normals face into the cavity');
    assert.ok(result.synthetic.raisedLeft[0] < 128 && result.synthetic.raisedRight[0] > 128
        && result.synthetic.raisedTop[1] < 128 && result.synthetic.raisedBottom[1] > 128,
        'positive logo stamp normals face away from the raised mark');
    assert.ok(shading.reports.every(report => report.changed > 100), 'normals affect actual GPU pixels');
    assert.ok(shading.changingResponse > 100, 'bevel shading follows the moving light');
    console.log(JSON.stringify({ dimensions: result.dimensions, rebuildMs: result.rebuildMs, maps: result.maps, shading }, null, 2));
    console.log('PASS: engraving depth/sign, exact neutral normals, mask, front/back basis, mipmaps, lifecycle, no per-frame uploads, light response.');
} finally {
    await browser?.close();
    await new Promise(done => server.close(done));
}
