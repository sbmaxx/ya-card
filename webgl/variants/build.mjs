import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { build, transform } from 'esbuild';
import { minify } from 'html-minifier-terser';
import { directions } from './directions.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const out = resolve(root, 'dist/variants');
const template = await readFile(resolve(root, 'index.html'), 'utf8');
const baseCss = await readFile(resolve(root, 'styles.css'), 'utf8');
const font = await readFile(resolve(root, 'assets/Onest-card.woff2'));
const license = await readFile(resolve(root, 'assets/Onest-OFL.txt'), 'utf8');
// Minimal loader: a hairline with a travelling glint, shown only if loading
// takes longer than a moment. It disappears when the first frame is ready.
const loaderCss = `.webgl-loading .scene::before{content:'';position:fixed;left:50%;top:50%;width:140px;height:1px;margin:0 0 0 -70px;opacity:0;z-index:5;
background:linear-gradient(90deg,transparent,#ffffffd0 50%,transparent) no-repeat,#ffffff1f;background-size:45% 100%,100% 100%;
animation:card-loader-in .4s .3s forwards,card-loader 1.3s .3s cubic-bezier(.45,0,.2,1) infinite}
@keyframes card-loader-in{to{opacity:1}}
@keyframes card-loader{from{background-position:-80% 0,0 0}to{background-position:180% 0,0 0}}
@media(prefers-reduced-motion:reduce){.webgl-loading .scene::before{animation:card-loader-in .4s .3s forwards}}`;
const editionCss = loaderCss + '.edition-link{position:fixed;top:calc(20px + env(safe-area-inset-top,0px));left:calc(24px + env(safe-area-inset-left,0px));z-index:10;font:11px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:1px;text-decoration:none;color:#ffffff99}.edition-link:hover{opacity:.75}';

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
await writeFile(resolve(out, 'index.html'), await minify(gallery, { collapseWhitespace: true, removeComments: true, minifyCSS: true }));
console.log(`Comparison page: ${out}/index.html`);
