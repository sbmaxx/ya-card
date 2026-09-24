import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
const editionCss = '.edition-link{position:fixed;top:calc(20px + env(safe-area-inset-top,0px));left:calc(24px + env(safe-area-inset-left,0px));z-index:10;font:11px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:1px;text-decoration:none;color:#ffffff99}.edition-link:hover{opacity:.75}';

for (const [id, direction] of Object.entries(directions)) {
    const js = await build({
        entryPoints: [resolve(root, 'app.js')], bundle: true, minify: true, write: false,
        format: 'iife', platform: 'browser', target: 'es2020', legalComments: 'none', charset: 'utf8',
        define: { __CARD_VARIANT__: JSON.stringify(id) },
        plugins: [{ name: 'isolated-art-direction', setup(bundler) {
            const { css: _css, ...runtimeDirection } = direction;
            bundler.onLoad({ filter: /\/directions\.js$/ }, () => ({
                contents: `export const direction = ${JSON.stringify(runtimeDirection)};`, loader: 'js'
            }));
            bundler.onResolve({ filter: /(^|\/)renderer\.js$/ }, () => ({ path: resolve(here, 'renderer.js') }));
            bundler.onResolve({ filter: /(^|\/)art-direction\.js$/ }, () => ({ path: resolve(here, 'art-direction.js') }));
        } }]
    });
    const css = await transform((baseCss + '\n' + editionCss + '\n' + direction.css)
        .replace('./assets/Onest-card.woff2', `data:font/woff2;base64,${font.toString('base64')}`), { loader: 'css', minify: true, target: 'es2020' });
    let html = template
        .replace('<meta name="theme-color" content="#101722">', `<meta name="theme-color" content="${direction.background}"><meta name="robots" content="noindex">`)
        .replaceAll('stop-color="#02030a"', `stop-color="${direction.shadow}"`)
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

await writeFile(resolve(out, 'index.html'), await readFile(resolve(here, 'gallery.html')));
console.log(`Comparison page: ${out}/index.html`);
