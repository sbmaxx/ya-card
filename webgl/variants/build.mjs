import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { build, transform } from 'esbuild';
import { minify } from 'html-minifier-terser';
import { directions } from './directions.js';
import { cards } from '../data.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const out = resolve(root, 'dist/variants');
const template = await readFile(resolve(root, 'index.html'), 'utf8');
const baseCss = await readFile(resolve(root, 'styles.css'), 'utf8');
const font = await readFile(resolve(root, 'assets/Onest-card.woff2'));
const license = await readFile(resolve(root, 'assets/Onest-OFL.txt'), 'utf8');
// Minimal loader: a hairline with a travelling glint, a real element so it can
// fade out while the card fades in. Transform and opacity animate on the
// compositor, so it keeps moving while warm-up keeps the main thread busy.
// The canvas extends under Safari's toolbars (large viewport).
const loaderCss = `.card-loader{position:fixed;left:50%;top:50%;width:140px;height:1px;margin-left:-70px;z-index:20;pointer-events:none;
opacity:0;transition:opacity .8s ease;mix-blend-mode:difference;background:#ffffff2e}
.webgl-loading .card-loader{opacity:1;transition-duration:.35s}
.card-loader::after{content:'';position:absolute;left:0;top:0;width:48px;height:1px;background:linear-gradient(90deg,transparent,#fff,transparent);
will-change:transform,opacity;animation:card-glint 1.2s cubic-bezier(.45,0,.2,1) infinite}
@keyframes card-glint{0%{transform:translateX(0);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(92px);opacity:0}}
@media(prefers-reduced-motion:reduce){.card-loader::after{animation:none;opacity:.6;transform:translateX(46px)}}
.webgl-ready .scene,.webgl-loading .scene{bottom:auto;height:100lvh}
@media (hover:none) and (pointer:coarse){:root.webgl-backdrop{background:linear-gradient(var(--edge-top) 50%,var(--edge-bottom) 50%) fixed}
:root.webgl-backdrop body{background:transparent}.ambient{display:none}}`;
// Corners stay clean on the WebGL card: language flips with the card itself.
// The HTML fallback keeps both controls.
const cornersCss = '.webgl-ready .languages,.webgl-ready .links-overlay,.webgl-loading .languages,.webgl-loading .links-overlay{display:none}';
const editionCss = cornersCss + loaderCss + '.edition-link{position:fixed;top:calc(20px + env(safe-area-inset-top,0px));left:calc(24px + env(safe-area-inset-left,0px));z-index:10;font:11px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:1px;text-decoration:none;color:#ffffff99}.edition-link:hover{opacity:.75}';

// Every edition as its own page, plus /lab/: all editions behind a demo panel.
const pages = [...Object.entries(directions), ['lab', null]];
for (const [id, direction] of pages) {
    const lab = !direction;
    const js = await build({
        ...(lab
            ? { stdin: { contents: "import './lab.js';\nimport '../app.js';", resolveDir: here, loader: 'js' } }
            : { entryPoints: [resolve(root, 'app.js')] }),
        bundle: true, minify: true, write: false,
        format: 'iife', platform: 'browser', target: 'es2020', legalComments: 'none', charset: 'utf8',
        define: { __CARD_VARIANT__: JSON.stringify(id) },
        plugins: [{ name: 'isolated-edition', setup(bundler) {
            if (!lab) {
                const { css: _css, ...runtimeDirection } = direction;
                bundler.onLoad({ filter: /\/directions\.js$/ }, () => ({
                    contents: `export const direction = ${JSON.stringify(runtimeDirection)};`, loader: 'js'
                }));
            }
            bundler.onResolve({ filter: /(^|\/)renderer\.js$/ }, () => ({ path: resolve(here, 'renderer.js') }));
        } }]
    });
    const css = await transform((baseCss + '\n' + editionCss + '\n' + (lab ? '' : direction.css))
        .replace('./assets/Onest-card.woff2', `data:font/woff2;base64,${font.toString('base64')}`), { loader: 'css', minify: true, target: 'es2020' });
    let html = template
        // The backdrop is rendered in WebGL: no CSS ambient layer or SVG shadow.
        .replace(/<div class="ambient"[\s\S]*?<div class="ambient-grain"><\/div><\/div>/, '<div class="card-loader" aria-hidden="true"></div>')
        // Without WebGL 2, or if the scene never starts, open the plain card instead.
        .replace(/document\.documentElement\.classList\.remove\('webgl-loading'\);\n\}, 8000\);/, "location.replace('../plain/' + location.hash);\n}, 8000);\nwindow.cardFallbackUrl = '../plain/';")
        .replace('<meta name="theme-color" content="#101722">', `<meta name="theme-color" content="${lab ? '#0b0d11' : direction.background}"><meta name="robots" content="noindex">`)
        .replaceAll('stop-color="#02030a"', `stop-color="${lab ? '#000000' : direction.shadow}"`)
        .replace('<link rel="stylesheet" href="./styles.css">', () => `<style>${css.code}</style>`)
        .replace('<script type="module" src="./app.js"></script>', '')
        .replace('<body>', `<body><a class="edition-link" href="../">← Варианты / ${id.toUpperCase()}</a>`)
        .replace('</body>', () => `<script>${js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body>`);
    html = await minify(html, { collapseWhitespace: true, removeComments: true, removeRedundantAttributes: true, minifyJS: true });
    html = html.replace('</head>', () => `<!-- Onest font license:\n${license.replace(/-->/g, '-- >')}\n--></head>`);
    const bytes = Buffer.from(html), directory = resolve(out, id);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'index.html'), bytes);
    await writeFile(resolve(directory, 'index.html.gz'), gzipSync(bytes, { level: 9 }));
    await writeFile(resolve(directory, 'index.html.br'), brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
    console.log(`${id}: ${bytes.length} bytes → ${directory}`);
}

// Gallery previews are real renders captured from /lab/ with a fixed light.
await mkdir(resolve(out, 'previews'), { recursive: true });
for (const file of await readdir(resolve(here, 'previews'))) await copyFile(resolve(here, 'previews', file), resolve(out, 'previews', file));
const gallery = await readFile(resolve(here, 'gallery.html'), 'utf8');

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
    await mkdir(resolve(out, 'plain'), { recursive: true });
    await writeFile(resolve(out, 'plain/index.html'), plain);
    const text = ['ru', 'en'].map(lang => [cards[lang].name, cards[lang].position, lang === 'ru' ? 'Яндекс' : 'Yandex', '',
        'sbmaxx@yandex-team.ru', 'https://t.me/sbmaxx'].join('\n')).join('\n\n—\n\n') + '\n';
    // BOM: nginx sends .txt without a charset; browsers then still read UTF-8.
    await writeFile(resolve(out, 'card.txt'), '\ufeff' + text);
}
await writeFile(resolve(out, 'index.html'), await minify(gallery, { collapseWhitespace: true, removeComments: true, minifyCSS: true }));
console.log(`Comparison page: ${out}/index.html`);
