import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { brotliCompressSync, gzipSync, constants, gunzipSync, brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build, transform } from 'esbuild';
import { minify } from 'html-minifier-terser';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');
const [template, cssSource, javascript] = await Promise.all([
    readFile(resolve(root, 'index.html'), 'utf8'),
    readFile(resolve(root, 'styles.css'), 'utf8'),
    build({
        entryPoints: [resolve(root, 'app.js')], bundle: true, minify: true,
        write: false, format: 'iife', platform: 'browser', target: 'es2020',
        legalComments: 'none', treeShaking: true, charset: 'utf8'
    })
]);
const font = await readFile(resolve(root, 'assets/Onest-card.woff2'));
const license = await readFile(resolve(root, 'assets/Onest-OFL.txt'), 'utf8');
const inlinedCss = cssSource.replace('./assets/Onest-card.woff2', `data:font/woff2;base64,${font.toString('base64')}`);
const css = await transform(inlinedCss, { loader: 'css', minify: true, target: 'es2020' });
let html = template
    .replace('<link rel="stylesheet" href="./styles.css">', () => `<style>${css.code}</style>`)
    .replace('<script type="module" src="./app.js"></script>', '')
    // A replacement string interprets $& / $` sequences in minified JavaScript.
    // A callback inserts generated code literally (including identifiers like $).
    .replace('</body>', () => `<script>${javascript.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body>`);
html = await minify(html, {
    collapseWhitespace: true, removeComments: true, removeRedundantAttributes: true,
    removeEmptyAttributes: true, useShortDoctype: true, minifyCSS: false,
    // The main bundle is already minified; this also covers the small boot scripts.
    minifyJS: true, keepClosingSlash: false
});
// The bundled font is OFL-licensed; keep the required notice in the artifact.
html = html.replace('</head>', () => `<!-- Bundled Onest font license:\n${license.replace(/-->/g, '-- >')}\n--></head>`);
if (/<script\b[^>]*\bsrc\s*=/i.test(html) || /<link\b[^>]*rel=["']?stylesheet/i.test(html)) {
    throw new Error('Production output still refers to an external script or stylesheet');
}
// Validate after HTML insertion/minification, not just before it. The HTML
// minifier can leave malformed scripts untouched instead of failing the build.
for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attributes.includes('application/ld+json')) continue;
    await transform(source, { loader: 'js', target: 'es2020' });
}
const bytes = Buffer.from(html);
const gzip = gzipSync(bytes, { level: 9 });
const brotli = brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT }
});
if (!gunzipSync(gzip).equals(bytes) || !brotliDecompressSync(brotli).equals(bytes)) {
    throw new Error('Compressed artifacts do not match the HTML');
}
await mkdir(output, { recursive: true });
await Promise.all([
    writeFile(resolve(output, 'index.html'), bytes),
    writeFile(resolve(output, 'index.html.gz'), gzip),
    writeFile(resolve(output, 'index.html.br'), brotli)
]);
console.log(`HTML ${bytes.length} B | gzip ${gzip.length} B | Brotli ${brotli.length} B`);
console.log(`SHA-256 ${createHash('sha256').update(bytes).digest('hex')}`);
console.log(output);
