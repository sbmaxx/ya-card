import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { build, transform } from 'esbuild';
import { minify } from 'html-minifier-terser';
import { cards } from '../data.js';
import { directions } from './directions.js';
import { decodePreset } from './preset.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
// The homepage look: a short code from the lab («Короткая ссылка», `?c=`).
const HOME_LOOK = 'AABBCDDBAABBBABAA8AtAUATAJAJAUAUAUAUAUAHAAB4A8Cz9LWACXWFoCiQAG';
const page = async (id, html, out = variantsOut) => {
    const bytes = Buffer.from(html), directory = resolve(out, id);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'index.html'), bytes);
    await writeFile(resolve(directory, 'index.html.gz'), gzipSync(bytes, { level: 9 }));
    await writeFile(resolve(directory, 'index.html.br'), brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
    console.log(`${id || '/'}: ${bytes.length} bytes → ${directory}`);
};
const variantsOut = resolve(root, 'dist/variants'), homeOut = resolve(root, 'dist/home');
await rm(variantsOut, { recursive: true, force: true });
await rm(homeOut, { recursive: true, force: true });
const template = await readFile(resolve(root, 'index.html'), 'utf8');
const baseCss = await readFile(resolve(root, 'styles.css'), 'utf8');
const font = await readFile(resolve(root, 'assets/Onest-card.woff2'));
const license = await readFile(resolve(root, 'assets/Onest-OFL.txt'), 'utf8');
// Minimal loader: a hairline with a travelling glint, a real element so it can
// fade out while the card fades in. Transform and opacity animate on the
// compositor, so it keeps moving while warm-up keeps the main thread busy.
// On touch screens the scene fades into the bar colours inside the visible
// viewport, so the transition completes before Safari's header and footer.
const loaderCss = `.card-loader{position:fixed;left:50%;top:50%;width:140px;height:1px;margin-left:-70px;z-index:20;pointer-events:none;
opacity:0;transition:opacity .8s ease;mix-blend-mode:difference;background:#ffffff2e}
.webgl-loading .card-loader{opacity:1;transition-duration:.35s}
.card-loader::after{content:'';position:absolute;left:0;top:0;width:48px;height:1px;background:linear-gradient(90deg,transparent,#fff,transparent);
will-change:transform,opacity;animation:card-glint 1.2s cubic-bezier(.45,0,.2,1) infinite}
@keyframes card-glint{0%{transform:translateX(0);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(92px);opacity:0}}
@media(prefers-reduced-motion:reduce){.card-loader::after{animation:none;opacity:.6;transform:translateX(46px)}}
.safe-edge{position:fixed;left:0;right:0;z-index:4;pointer-events:none}
.safe-edge-top{top:0;height:max(6px,env(safe-area-inset-top,0px))}
.safe-edge-bottom{bottom:0;height:max(6px,env(safe-area-inset-bottom,0px))}
@media (pointer:fine){.safe-edge{display:none}}
@media (hover:none) and (pointer:coarse){.ambient{display:none}}`;
// Corners stay clean on the WebGL card: language flips with the card itself.
// The HTML fallback keeps both controls.
const cornersCss = '.webgl-ready .languages,.webgl-ready .links-overlay,.webgl-loading .languages,.webgl-loading .links-overlay{display:none}';
const labCss = cornersCss + loaderCss;

// A studio page: the WebGL card with the loader, a watchdog that opens the
// plain card if the scene never starts, and everything inlined.
async function studioPage({ entry, define, direction, fallback, head }) {
    const js = await build({
        stdin: { contents: entry, resolveDir: here, loader: 'js' },
        bundle: true, minify: true, write: false,
        format: 'iife', platform: 'browser', target: 'es2020', legalComments: 'none', charset: 'utf8', define,
        plugins: [{ name: 'studio-renderer', setup(bundler) {
            bundler.onResolve({ filter: /(^|\/)renderer\.js$/ }, () => ({ path: resolve(here, 'renderer.js') }));
            // A single-edition page carries only its own direction.
            if (direction) {
                const { css: _css, ...runtime } = direction;
                bundler.onLoad({ filter: /\/directions\.js$/ }, () => ({ loader: 'js',
                    contents: `export const direction = ${JSON.stringify(runtime)};\nexport const directions = { [direction.id]: direction };` }));
            }
        } }]
    });
    const css = await transform((baseCss + '\n' + labCss)
        .replace('./assets/Onest-card.woff2', `data:font/woff2;base64,${font.toString('base64')}`), { loader: 'css', minify: true, target: 'es2020' });
    let html = template
        // The backdrop is rendered in WebGL: no CSS ambient layer or SVG shadow.
        .replace(/<div class="ambient"[\s\S]*?<div class="ambient-grain"><\/div><\/div>/, '<div class="card-loader" aria-hidden="true"></div>')
        // Without WebGL 2, or if the scene never starts, open the plain card instead.
        // Only time on screen counts: a background tab or a locked phone pauses
        // the frames the warm-up waits for, and that is not a missing WebGL.
        .replace(/window\.cardBootTimeout = setTimeout\(\(\) => \{\n    document\.documentElement\.classList\.remove\('webgl-loading'\);\n\}, 8000\);/, () => `(() => {
    let visible = 0, last = performance.now();
    const tick = () => {
        const now = performance.now();
        if (document.visibilityState === 'visible') visible += Math.min(now - last, 1000);
        last = now;
        if (!document.documentElement.classList.contains('webgl-loading')) return;
        if (visible > 20000) location.replace('${fallback}?why=timeout' + location.hash);
        else window.cardBootTimeout = setTimeout(tick, 500);
    };
    window.cardBootTimeout = setTimeout(tick, 500);
})();
window.cardFallbackUrl = '${fallback}';`)
        .replace('<meta name="theme-color" content="#101722">', head)
        .replaceAll('stop-color="#02030a"', 'stop-color="#000000"')
        .replace('<link rel="stylesheet" href="./styles.css">', () => `<style>${css.code}</style>`)
        .replace('<script type="module" src="./app.js"></script>', '')
        .replace('</body>', () => `<script>${js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body>`);
    html = await minify(html, { collapseWhitespace: true, removeComments: true, removeRedundantAttributes: true, minifyJS: true });
    return html.replace('</head>', () => `<!-- Onest font license:\n${license.replace(/-->/g, '-- >')}\n--></head>`);
}

// /variants/lab/: every edition behind the demo panel.
await page('lab', await studioPage({
    entry: "import './preset.js';\nimport './lab.js';\nimport '../app.js';",
    define: { __CARD_VARIANT__: JSON.stringify('lab') },
    fallback: '../plain/',
    head: '<meta name="theme-color" content="#0b0d11"><meta name="robots" content="noindex">'
}));

// The homepage: one look from the lab, without the panel and other editions.
{
    const look = decodePreset(HOME_LOOK);
    look.delete('panel');
    const direction = directions[look.get('edition')];
    await page('', await studioPage({
        entry: "import './home.js';\nimport './settings.js';\nimport '../app.js';",
        define: { __CARD_VARIANT__: JSON.stringify(direction.id), __CARD_PRESET__: JSON.stringify(look.toString()) },
        direction,
        fallback: '/plain/',
        // Indexed, unlike the lab. The scene sets the exact page colour at start.
        head: '<meta name="theme-color" content="#0b0c0f">'
    }), homeOut);
}

// The gallery and the old edition pages now open the lab (nginx is untouched,
// so these are HTML redirects; .gz/.br siblings replace any stale ones).
for (const [id, target] of [['', 'lab/'], ...['steel', 'noir', 'gold', 'aurora'].map(id => [id, `../lab/?edition=${id}`]),
    ...['ivory', 'obsidian', 'prism'].map(id => [id, '../lab/'])]) {
    await page(id, `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="robots" content="noindex"><title>LAB</title>`
        + `<meta http-equiv="refresh" content="0;url=${target}"><script>location.replace(${JSON.stringify(target)} + location.hash)</script>`
        + `<a href="${target}">LAB</a></html>`);
}

// Plain card for browsers without WebGL 2: the same accessible HTML faces, no scripts.
{
    const css = await transform(baseCss.replace('./assets/Onest-card.woff2', `data:font/woff2;base64,${font.toString('base64')}`),
        { loader: 'css', minify: true, target: 'es2020' });
    let plain = template
        .replace(/<script>\n\/\/ Reserve[\s\S]*?<\/script>\n/, '')
        .replace('<meta name="theme-color" content="#101722">', '<meta name="theme-color" content="#101722"><meta name="robots" content="noindex">')
        .replace('<link rel="stylesheet" href="./styles.css">', () => `<style>${css.code}</style>`)
        .replace('<script type="module" src="./app.js"></script>', '')
        .replace(/<div class="ambient"[\s\S]*?<div class="ambient-grain"><\/div><\/div>/, '');
    plain = await minify(plain, { collapseWhitespace: true, removeComments: true, removeRedundantAttributes: true, minifyJS: true });
    for (const out of [variantsOut, homeOut]) {
        await mkdir(resolve(out, 'plain'), { recursive: true });
        await writeFile(resolve(out, 'plain/index.html'), plain);
    }
    const text = ['ru', 'en'].map(lang => [cards[lang].name, cards[lang].position, lang === 'ru' ? 'Яндекс' : 'Yandex', '',
        'sbmaxx@yandex-team.ru', 'https://t.me/sbmaxx'].join('\n')).join('\n\n—\n\n') + '\n';
    // BOM: nginx sends .txt without a charset; browsers then still read UTF-8.
    for (const out of [variantsOut, homeOut]) await writeFile(resolve(out, 'card.txt'), '\ufeff' + text);
}
