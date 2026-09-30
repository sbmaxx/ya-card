// Local-only Windows/ANGLE compile and pixel regression harness. See WINDOWS-COMPILE-RESULTS.md.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [label, theme, distArg, outputArg] = process.argv.slice(2);
if (!label || !['light', 'dark'].includes(theme) || !distArg || !outputArg) {
    throw new Error('Usage: node tools/windows-profile.cjs LABEL light|dark DIST OUTPUT');
}
const dist = path.resolve(distArg), output = path.resolve(outputArg, label);
fs.mkdirSync(output, { recursive: true });
if (fs.existsSync(path.join(output, 'events.ndjson'))) throw new Error('Use a unique run label');
const events = [];
function log(data) {
    const event = { wall: Date.now(), ...data };
    events.push(event);
    fs.appendFileSync(path.join(output, 'events.ndjson'), JSON.stringify(event) + '\n');
    if (data.kind !== 'console' || data.text.startsWith('MARK ')) console.log(JSON.stringify(event));
}
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(dist, '.' + decodeURIComponent(url.pathname), url.pathname.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
    try {
        let data = fs.readFileSync(file);
        if (file.endsWith('.html')) {
            let html = data.toString();
            fs.writeFileSync(path.join(output, 'original.html'), html);
            // Expose the instance without enabling the lab's different material paths.
            const pattern = /globalThis\.__cardLab&&\(globalThis\.__cardRenderer=this\)/g;
            if (!pattern.test(html)) throw new Error('Renderer exposure hook not found');
            html = html.replace(pattern, 'globalThis.__cardRenderer=this');
            data = Buffer.from(html);
        }
        res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
    } catch (error) { res.writeHead(404).end(String(error)); }
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true,
            args: ['--disable-gpu-shader-disk-cache', '--enable-privileged-webgl-extensions', '--enable-logging', '--v=1'],
            env: { ...process.env, CHROME_LOG_FILE: path.join(output, 'chrome.log') } });
        const cdpBrowser = await browser.newBrowserCDPSession();
        const environment = { version: await cdpBrowser.send('Browser.getVersion'), system: await cdpBrowser.send('SystemInfo.getInfo'), theme, label, dist, viewport: [1440, 900], dpr: 1 };
        fs.writeFileSync(path.join(output, 'environment.json'), JSON.stringify(environment, null, 2));
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await context.newPage(), cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.clearBrowserCache');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
        await cdp.send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
        page.on('console', msg => log({ kind: 'console', level: msg.type(), text: msg.text() }));
        page.on('pageerror', error => log({ kind: 'pageerror', text: String(error), stack: error.stack }));
        await page.addInitScript(({ theme }) => {
            localStorage.setItem('card-theme', theme);
            let seed = 12345;
            Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
            let timer;
            Object.defineProperty(window, 'cardBootTimeout', { get: () => timer, set: value => { timer = value; clearTimeout(value); } });
            const raf = window.requestAnimationFrame;
            window.requestAnimationFrame = callback => raf(t => { if (!window.__stopFrames) callback(t); });
            new PerformanceObserver(list => { for (const e of list.getEntries()) console.log('MARK ' + JSON.stringify({ name: e.name, t: e.startTime })); }).observe({ type: 'mark', buffered: true });
            const proto = WebGL2RenderingContext.prototype, shaders = [], programs = [];
            window.__compileProfile = { shaders, programs };
            for (const [name, list] of [['createShader', shaders], ['createProgram', programs]]) {
                const orig = proto[name];
                proto[name] = function (...args) { const object = orig.apply(this, args); list.push({ object, type: args[0], id: list.length, gl: this }); return object; };
            }
            const source = proto.shaderSource;
            proto.shaderSource = function (shader, text) { shaders.find(s => s.object === shader).source = text; return source.call(this, shader, text); };
            const attach = proto.attachShader;
            proto.attachShader = function (program, shader) { const p = programs.find(p => p.object === program); (p.shaders ??= []).push(shaders.find(s => s.object === shader).id); return attach.call(this, program, shader); };
            const link = proto.linkProgram;
            proto.linkProgram = function (program) { programs.find(p => p.object === program).start = performance.now(); return link.call(this, program); };
            const get = proto.getProgramParameter;
            proto.getProgramParameter = function (program, key) {
                const result = get.call(this, program, key), p = programs.find(p => p.object === program);
                if (key === 0x91B1 && result && p && p.ready == null) { p.ready = performance.now(); console.log('PROGRAM ' + JSON.stringify({ id: p.id, shaders: p.shaders, start: p.start, ready: p.ready, duration: p.ready - p.start })); }
                return result;
            };
            // Keep references alive until translated source has been collected, after compile timing.
            proto.deleteShader = function () {};
        }, { theme });
        await page.goto(origin + '/home/?render=full&stats=1', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.documentElement.classList.contains('webgl-ready'), {}, { timeout: 120000 });
        // Match the handoff's settling interval; this is after compile timing.
        await page.waitForTimeout(3000);
        const result = await page.evaluate(async () => {
            window.__stopFrames = true;
            const r = window.__cardRenderer, gl = r.gl, profile = window.__compileProfile;
            if (!r || r.lite) throw new Error('Expected the full renderer');
            await r.layoutReady;
            const debug = gl.getExtension('WEBGL_debug_shaders');
            const shaders = profile.shaders.map(s => ({ id: s.id, type: s.type, source: s.source, translated: debug?.getTranslatedShaderSource(s.object), infoLog: gl.getShaderInfoLog(s.object) }));
            const programs = profile.programs.map(({ object, gl, ...p }) => p);
            const marks = performance.getEntriesByType('mark').map(e => ({ name: e.name, t: e.startTime }));
            const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
            const faces = [];
            const draw = flipped => {
                r.time = 5; r.introTime = 10; r.intro = 1; r.idleWeight = 0;
                r.draw({ rx: 0, ry: 0, rz: 0, zoom: 1, flipped, animate: false, reduced: true, delta: 1 / 60 });
            };
            for (const flipped of [false, true]) {
                // Reduced motion snaps pose and flip; repeat to remove any residual spring state.
                for (let i = 0; i < 4; i++) draw(flipped);
                const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].map(x => x.toString(16).padStart(2, '0')).join('');
                const raw = []; for (let i = 0; i < pixels.length; i += 32768) raw.push(String.fromCharCode(...pixels.subarray(i, i + 32768)));
                const queries = [], orig = r.drawCard;
                if (ext) {
                    gl.getParameter(ext.GPU_DISJOINT_EXT);
                    r.drawCard = function (bloom, focus, card) {
                        if (bloom) return orig.call(this, bloom, focus, card);
                        const query = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, query); orig.call(this, bloom, focus, card); gl.endQuery(ext.TIME_ELAPSED_EXT); queries.push(query);
                    };
                    for (let i = 0; i < 16; i++) { draw(flipped); gl.flush(); await new Promise(resolve => setTimeout(resolve, 20)); }
                    r.drawCard = orig;
                    for (let i = 0; i < 100 && queries.some(q => !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)); i++) await new Promise(resolve => setTimeout(resolve, 20));
                }
                const disjoint = ext ? gl.getParameter(ext.GPU_DISJOINT_EXT) : null;
                const samples = queries.map(q => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) ? gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 : null);
                queries.forEach(q => gl.deleteQuery(q));
                const sorted = samples.slice(4).filter(x => x != null).sort((a, b) => a - b);
                faces.push({ flipped, hash, rgba: btoa(raw.join('')), gpu: { available: !!ext, disjoint, samples, median: sorted[sorted.length >> 1], min: sorted[0] }, model: [...r.model] });
            }
            return { theme: document.documentElement.dataset.theme, perf: r.perf, marks, programs, shaders, faces, canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight], settle: r.settleStats };
        });
        if (process.env.WINDOWS_REFERENCE_SHADER) {
            const referenceSource = fs.readFileSync(process.env.WINDOWS_REFERENCE_SHADER, 'utf8');
            result.paired = await page.evaluate(async referenceSource => {
                const r = window.__cardRenderer, gl = r.gl, ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
                if (!ext) throw new Error('GPU timer queries unavailable');
                const candidate = r.cards.full, program = gl.createProgram();
                const vertex = window.__compileProfile.shaders.findLast(s => s.type === gl.VERTEX_SHADER).source;
                for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, referenceSource]]) {
                    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); gl.attachShader(program, shader);
                }
                gl.linkProgram(program);
                const parallel = gl.getExtension('KHR_parallel_shader_compile');
                const deadline = performance.now() + 120000;
                while (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
                    if (performance.now() > deadline) throw new Error('Reference compile timeout');
                    await new Promise(resolve => setTimeout(resolve, 16));
                }
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
                const setters = {};
                for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
                    const { name, type } = gl.getActiveUniform(program, i), loc = gl.getUniformLocation(program, name);
                    setters[name.replace(/\[0\]$/, '')] = {
                        [gl.FLOAT]: v => typeof v === 'number' ? gl.uniform1f(loc, v) : gl.uniform1fv(loc, v),
                        [gl.FLOAT_VEC2]: v => gl.uniform2fv(loc, v), [gl.FLOAT_VEC3]: v => gl.uniform3fv(loc, v), [gl.FLOAT_VEC4]: v => gl.uniform4fv(loc, v),
                        [gl.FLOAT_MAT3]: v => gl.uniformMatrix3fv(loc, false, v), [gl.FLOAT_MAT4]: v => gl.uniformMatrix4fv(loc, false, v),
                        [gl.INT]: v => gl.uniform1i(loc, v), [gl.INT_VEC4]: v => gl.uniform4iv(loc, v), [gl.SAMPLER_2D]: v => gl.uniform1i(loc, v)
                    }[type];
                }
                const reference = { program, setUniforms: values => { for (const key in values) setters[key]?.(values[key]); } };
                const draw = flipped => { r.time = 5; r.introTime = 10; r.intro = 1; r.draw({ rx: 0, ry: 0, rz: 0, zoom: 1, flipped, animate: false, reduced: true, delta: 1 / 60 }); };
                const results = [];
                for (const flipped of [false, true]) {
                    const samples = { reference: [], candidate: [] }, hashes = {}, batches = [];
                    for (let batch = 0; batch < 6; batch++) {
                        for (const name of batch % 2 ? ['candidate', 'reference'] : ['reference', 'candidate']) {
                            r.cards.full = name === 'reference' ? reference : candidate;
                            for (let i = 0; i < 8; i++) draw(flipped);
                            if (!(name in hashes)) {
                                const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                                gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                                hashes[name] = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].map(b => b.toString(16).padStart(2, '0')).join('');
                            }
                            const queries = [], original = r.drawCard;
                            r.drawCard = function (bloom, focus, card) {
                                if (bloom) return original.call(this, bloom, focus, card);
                                const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); original.call(this, bloom, focus, card); gl.endQuery(ext.TIME_ELAPSED_EXT); queries.push(q);
                            };
                            for (let i = 0; i < 12; i++) draw(flipped);
                            r.drawCard = original; gl.flush();
                            const deadline = performance.now() + 10000;
                            while (queries.some(q => !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) {
                                if (performance.now() > deadline) throw new Error('Query timeout');
                                await new Promise(resolve => setTimeout(resolve, 5));
                            }
                            if (gl.getParameter(ext.GPU_DISJOINT_EXT)) throw new Error('Disjoint paired GPU samples');
                            const ms = queries.map(q => gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
                            queries.forEach(q => gl.deleteQuery(q)); samples[name].push(...ms); batches.push({ batch, name, ms });
                        }
                    }
                    const stats = Object.fromEntries(Object.entries(samples).map(([name, ms]) => { const sorted = [...ms].sort((a, b) => a - b); return [name, { median: sorted[sorted.length >> 1], min: sorted[0], samples: ms }]; }));
                    results.push({ flipped, hashes, equal: hashes.reference === hashes.candidate, stats, batches });
                }
                r.cards.full = candidate; gl.deleteProgram(program);
                return { referenceShader: referenceSource.length, results };
            }, referenceSource);
        }
        for (const shader of result.shaders) {
            fs.writeFileSync(path.join(output, `shader-${shader.id}.glsl`), shader.source || '');
            fs.writeFileSync(path.join(output, `shader-${shader.id}.hlsl`), shader.translated || '');
            shader.sha256 = crypto.createHash('sha256').update(shader.source || '').digest('hex');
            shader.bytes = Buffer.byteLength(shader.source || '');
            shader.translatedBytes = Buffer.byteLength(shader.translated || '');
            delete shader.source; delete shader.translated;
        }
        for (const face of result.faces) { fs.writeFileSync(path.join(output, face.flipped ? 'back.rgba' : 'front.rgba'), Buffer.from(face.rgba, 'base64')); delete face.rgba; }
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
        log({ kind: 'result', theme, marks: result.marks, programs: result.programs, faces: result.faces.map(f => ({ flipped: f.flipped, hash: f.hash, gpu: f.gpu })) });
        await page.screenshot({ path: path.join(output, 'back.png') });
        await context.close();
    } catch (error) { log({ kind: 'error', text: String(error), stack: error.stack }); process.exitCode = 1; }
    finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); fs.writeFileSync(path.join(output, 'events.json'), JSON.stringify(events, null, 2)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
