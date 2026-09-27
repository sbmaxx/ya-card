import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build, transform } from 'esbuild';
import { parse } from 'acorn';
import { minify } from 'html-minifier-terser';
import { cards } from '../data.js';
import { directions } from './directions.js';
import { decodePreset } from './preset.js';
import { FONTS, fontOf } from './fonts.js';
import { BACKDROPS, pageColours } from './backdrops.js';
import { LIGHT_SETUPS } from './lights.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
// The homepage look: a short code from the lab («Короткая ссылка», `?c=`).
const HOME_LOOK = 'ABCCCDDBAAAAAAAAA8AeAHATAJAJAUAUAUAUAJAFAVB4A8AAAC_D8dAeAQAQAKAAAAAAAAAMAAAEABABAOAUAGAGABAAAUAAACAUAA';
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
// Typefaces (fonts.js): the lab embeds every one with Latin and Cyrillic, so
// any name can be typed; the homepage and the plain card only the chosen one,
// cut to the card's own characters. styles.css keeps its own face for the dev page.
// The card's own pages carry a single weight when the look sets all its text
// in one (`<id>-card-<weight>.woff2`, a static instance): half the bytes of
// the whole 400–600 axis.
const fontFaces = async (fonts, card) => (await Promise.all(fonts.map(async f => {
    const single = card && homeWeights.length === 1 ? homeWeights[0] : null;
    const file = single ? `${f.id}-card-${single}` : `${f.id}${card ? '-card' : ''}`;
    const bytes = await readFile(resolve(root, `assets/fonts/${file}.woff2`));
    return `@font-face{font-family:'${f.family}';src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');font-weight:${single ?? '400 600'};font-style:normal;font-display:swap}`;
}))).join('\n');
const fontLicenses = async fonts => (await Promise.all(fonts.map(async f =>
    `<!-- ${f.title} font license:\n${(await readFile(resolve(root, `assets/fonts/${f.id}-OFL.txt`), 'utf8')).replace(/-->/g, '-- >')}\n-->`))).join('');
// The dev page's CSS backdrop (`.ambient`, the SVG `.card-shadow`): the built
// pages draw theirs in WebGL and have neither, so its rules go, and the
// selector lists that name it lose it.
const withoutAmbient = css => css.replace(/([^{}]*)\{([^{}]*)\}/g, (rule, selectors, body) => {
    const kept = selectors.split(',').filter(selector => !/\.ambient|\.card-shadow/.test(selector));
    return kept.length === selectors.split(',').length ? rule : kept.length ? `${kept.join(',')}{${body}}` : '';
});
// The page's own CSS with the given faces; the HTML faces use the given family.
const pageCss = async (fonts, card, extra = '') => (await fontFaces(fonts, card)) + '\n'
    + withoutAmbient(baseCss.replace(/^@font-face[^\n]*\n/, '')).replaceAll("'Card Onest'", `'${fonts[0].family}'`) + '\n' + extra;
const homeFont = fontOf(Number(decodePreset(HOME_LOOK).get('font') ?? 0));
// The weights the homepage's text is drawn in (settings.js: name 500, the rest 400 by default).
const homeWeights = (look => [...new Set([Number(look.get('nameWeight') ?? 500), Number(look.get('bodyWeight') ?? 400)])])(decodePreset(HOME_LOOK));
// The homepage's backdrop (the lab opens on it too): its colours are baked into
// the page, so the first paint, Safari's bars and the loader already match the
// scene that follows.
const homeBackdrop = (look => BACKDROPS[look.get('backdrop')] || BACKDROPS[directions[look.get('edition')]?.backdrop] || BACKDROPS.velvet)(decodePreset(HOME_LOOK));
const themeColor = `<meta name="theme-color" content="${homeBackdrop.edge}">`;
// Minimal loader: a hairline with a travelling glint, a real element so it can
// fade out while the card fades in. Transform and opacity animate on the
// compositor, so it keeps moving while warm-up keeps the main thread busy.
// It is drawn in the backdrop's own light (`--loader`): a bright line and a
// glint that is a streak of light with a white core, clearly seen on the dark
// page and on the pool of light it stands on while the scene warms up.
// The page is the backdrop's colour from the first paint; on touch screens it
// is the flat edge colour Safari tints its bars with (the scene fades into it
// inside the visible viewport, so the transition completes before the bars).
const loaderCss = `:root{${Object.entries(pageColours(homeBackdrop)).map(([name, value]) => `${name}:${value}`).join(';')}}
:root{background-color:var(--page)}
@media (hover:none) and (pointer:coarse){:root,body{background-color:var(--edge)}}
.card-loader{position:fixed;left:50%;top:50%;width:176px;height:1px;margin-left:-88px;z-index:20;pointer-events:none;
opacity:0;transition:opacity .8s ease;background:linear-gradient(90deg,transparent,rgb(var(--loader)/.6) 22%,rgb(var(--loader)/.6) 78%,transparent)}
.webgl-loading .card-loader{opacity:1;transition-duration:.35s}
.card-loader::after{content:'';position:absolute;left:0;top:-6px;width:80px;height:13px;
background:linear-gradient(90deg,transparent,rgb(var(--loader)) 25%,#fff 50%,rgb(var(--loader)) 75%,transparent) center/100% 1px no-repeat,
radial-gradient(closest-side,rgb(var(--loader)/.55),transparent);
will-change:transform,opacity;animation:card-glint 1.2s cubic-bezier(.45,0,.2,1) infinite alternate}
@keyframes card-glint{0%{transform:translateX(0);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(96px);opacity:0}}
@media(prefers-reduced-motion:reduce){.card-loader::after{animation:none;opacity:.6;transform:translateX(48px)}}
.webgl-loading.webgl-stage #card-canvas{visibility:visible;animation:card-stage .6s ease both}
@keyframes card-stage{from{opacity:0}}
.safe-edge{position:fixed;left:0;right:0;z-index:4;pointer-events:none;background:var(--edge)}
.safe-edge-top{top:0;height:max(6px,env(safe-area-inset-top,0px))}
.safe-edge-bottom{bottom:0;height:max(6px,env(safe-area-inset-bottom,0px))}
@media (pointer:fine){.safe-edge{display:none}}
`;
// Corners stay clean on the WebGL card: language flips with the card itself.
// The HTML fallback keeps both controls.
const cornersCss = '.webgl-ready .languages,.webgl-ready .links-overlay,.webgl-loading .languages,.webgl-loading .links-overlay{display:none}';
const labCss = cornersCss + loaderCss;

// Shader sources live in template literals, with the notes that explain them.
// Pages need the code only: comment lines and indentation are dropped from
// every template that reads as GLSL, found by parsing the module, so
// strings elsewhere (the logo's SVG, font names) are left alone. A comment is
// `//` at a line start or after a space (never `http://`); one running into
// an interpolation is kept, as it comments out what follows. Each line keeps
// its place, and the edges of a piece next to `${…}` keep their spaces.
const SHADER = /\b(?:vec[234]|mat[34]|float|uniform)\b/;
function stripShaderNotes(source) {
    const templates = [];
    (function visit(node) {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'TemplateLiteral') templates.push(node);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value.type === 'string') visit(value);
        }
    })(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
    const edits = [];
    for (const template of templates) {
        if (!SHADER.test(template.quasis.map(quasi => quasi.value.raw).join(''))) continue;
        template.quasis.forEach((quasi, index) => {
            const first = index === 0, last = index === template.quasis.length - 1;
            const lines = quasi.value.raw.split('\n');
            const kept = lines.map((line, i) => {
                const opensPiece = i === 0 && !first, closesPiece = i === lines.length - 1 && !last;
                const comment = closesPiece ? null : line.match(/(^|[ \t])\/\/.*$/);
                let text = comment ? line.slice(0, comment.index) : line;
                if (!opensPiece) text = text.trimStart();
                if (!closesPiece) text = text.trimEnd();
                return { text, drop: !text && !opensPiece && !closesPiece && i > 0 && i < lines.length - 1 };
            }).filter(line => !line.drop).map(line => line.text);
            if (source.slice(quasi.start, quasi.end) !== quasi.value.raw) throw new Error('template range mismatch');
            edits.push([quasi.start, quasi.end, kept.join('\n')]);
        });
    }
    for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + text + source.slice(end);
    return source;
}

// A studio page: the WebGL card with the loader, a watchdog that opens the
// plain card if the scene never starts, and everything inlined.
async function studioPage({ entry, define, direction, lightSetup, fallback, head, source = template, fonts = FONTS, card = false }) {
    const js = await build({
        stdin: { contents: entry, resolveDir: here, loader: 'js' },
        bundle: true, minify: true, write: false,
        format: 'iife', platform: 'browser', target: 'es2020', legalComments: 'none', charset: 'utf8', define,
        plugins: [{ name: 'studio-renderer', setup(bundler) {
            bundler.onLoad({ filter: /\/variants\/renderer\.js$/ }, async args => ({ loader: 'js',
                contents: stripShaderNotes(await readFile(args.path, 'utf8')) }));
            bundler.onResolve({ filter: /(^|\/)renderer\.js$/ }, () => ({ path: resolve(here, 'renderer.js') }));
            // A single-edition page carries only its own direction.
            if (direction) {
                const { css: _css, ...runtime } = direction;
                bundler.onLoad({ filter: /\/directions\.js$/ }, () => ({ loader: 'js',
                    contents: `export const direction = ${JSON.stringify(runtime)};\nexport const directions = { [direction.id]: direction };` }));
                // …and only the light it is lit with; the lab's other setups stay in the lab.
                const light = lightSetup || direction.lightSetup;
                bundler.onLoad({ filter: /\/lights\.js$/ }, () => ({ loader: 'js',
                    contents: `export const LIGHT_SETUPS = ${JSON.stringify({ [light]: LIGHT_SETUPS[light] })};` }));
            }
        } }]
    });
    const css = await transform(await pageCss(fonts, card, labCss), { loader: 'css', minify: true, target: 'es2020' });
    let html = source
        // The backdrop is rendered in WebGL: no CSS ambient layer or SVG shadow.
        .replace(/<div class="ambient"[\s\S]*?<div class="ambient-grain"><\/div><\/div>/, '<div class="card-loader" aria-hidden="true"></div>')
        // Touch screens: the strips Safari tints its bars from are there at the
        // first paint, already in the edge colour (the renderer keeps them).
        .replace('<body>', '<body><div class="safe-edge safe-edge-top" aria-hidden="true"></div><div class="safe-edge safe-edge-bottom" aria-hidden="true"></div>')
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
        if (visible > 20000) location.replace('${fallback}?why=timeout' + (location.hash || (document.documentElement.lang === 'en' ? '#en' : '')));
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
    const licenses = await fontLicenses(fonts);
    return html.replace('</head>', () => `${licenses}</head>`);
}

// /variants/lab/: every edition behind the demo panel.
await page('lab', await studioPage({
    entry: "import './preset.js';\nimport './lab.js';\nimport '../app.js';",
    // The lab opens on the homepage's look (see preset.js).
    define: { __CARD_VARIANT__: JSON.stringify('lab'), __LAB_DEFAULT__: JSON.stringify(HOME_LOOK) },
    fallback: '../plain/',
    head: themeColor + '<meta name="robots" content="noindex">'
}));

// The homepage: one look from the lab, without the panel and other editions.
// Russian at `/`, English at `/en/`: the same page with its own head, so each
// address is indexed and shared in its language. Flipping the card switches
// the address without a navigation (`cardLanguagePaths` in app.js).
const SITE = 'https://rozhdestvenskiy.ru';
const HOME = {
    ru: { path: '/', locale: 'ru_RU', title: 'Роман Рождественский', first: 'Роман', last: 'Рождественский',
        description: 'Роман Рождественский — руководитель отдела поисковых интерфейсов, Яндекс. Контакты.',
        summary: 'Руководитель отдела поисковых интерфейсов, Яндекс', company: 'Яндекс',
        job: 'Руководитель отдела поисковых интерфейсов', image: 'Металлическая поисковая строка с именем Романа Рождественского' },
    en: { path: '/en/', locale: 'en_US', title: 'Roman Rozhdestvenskiy', first: 'Roman', last: 'Rozhdestvenskiy',
        description: 'Roman Rozhdestvenskiy — head of search interfaces department at Yandex. Contacts.',
        summary: 'Head of search interfaces department, Yandex', company: 'Yandex',
        job: 'Head of search interfaces department', image: 'Metal search bar with the name Roman Rozhdestvenskiy' }
};
// Share images carry a content hash, so chats and social networks fetch a new
// image when it changes instead of showing the cached one.
const ogVersion = Object.fromEntries(await Promise.all(['ru', 'en'].map(async lang => [lang,
    createHash('sha256').update(await readFile(resolve(here, `og/og-${lang}.jpg`))).digest('hex').slice(0, 8)])));
const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function homeSource(lang) {
    const info = HOME[lang], other = HOME[lang === 'ru' ? 'en' : 'ru'];
    const meta = (property, content) => `<meta property="${property}" content="${escapeHtml(content)}">`;
    const person = { '@context': 'https://schema.org', '@type': 'Person', name: info.title, alternateName: other.title,
        jobTitle: info.job, url: SITE + info.path, email: 'sbmaxx@yandex-team.ru',
        worksFor: { '@type': 'Organization', name: info.company }, sameAs: ['https://t.me/sbmaxx', 'https://github.com/sbmaxx'] };
    const head = [
        `<title>${escapeHtml(info.title)}</title>`,
        `<meta name="description" content="${escapeHtml(info.description)}">`,
        `<link rel="canonical" href="${SITE}${info.path}">`,
        `<link rel="alternate" hreflang="ru" href="${SITE}/">`,
        `<link rel="alternate" hreflang="en" href="${SITE}/en/">`,
        `<link rel="alternate" hreflang="x-default" href="${SITE}/">`,
        meta('og:type', 'profile'), meta('og:site_name', info.title),
        meta('og:title', info.title), meta('og:description', info.summary), meta('og:url', SITE + info.path),
        meta('og:locale', info.locale), meta('og:locale:alternate', other.locale),
        meta('og:image', `${SITE}/og-${lang}.jpg?v=${ogVersion[lang]}`), meta('og:image:width', '1200'), meta('og:image:height', '630'),
        meta('og:image:alt', info.image), meta('profile:first_name', info.first), meta('profile:last_name', info.last),
        '<meta name="twitter:card" content="summary_large_image">'
    ].join('\n');
    const replaced = template
        .replace('<html lang="ru">', `<html lang="${lang}">`)
        .replace(/<title>[\s\S]*?<link rel="canonical" href="[^"]*">/, () => head)
        .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => `<script type="application/ld+json">${JSON.stringify(person)}</script>`)
        // The favicon follows the page language (and old `#en` links).
        .replace('location.hash === "#en"', '(location.hash ? location.hash === "#en" : document.documentElement.lang === "en")')
        .replace('href="#ru" data-lang="ru"', 'href="/" data-lang="ru"').replace('href="#en" data-lang="en"', 'href="/en/" data-lang="en"')
        .replace("document.documentElement.classList.add('webgl-loading');", "document.documentElement.classList.add('webgl-loading');\nwindow.cardLanguagePaths = { ru: '/', en: '/en/' };");
    for (const check of [`lang="${lang}"`, 'hreflang="x-default"', 'og:image', 'cardLanguagePaths', 'href="/en/" data-lang', `"jobTitle":"${info.job}"`]) {
        if (!replaced.includes(check)) throw new Error(`homepage ${lang}: ${check} missing`);
    }
    return replaced;
}
{
    const look = decodePreset(HOME_LOOK);
    look.delete('panel');
    const direction = directions[look.get('edition')];
    for (const lang of ['ru', 'en']) {
        await page(lang === 'ru' ? '' : 'en', await studioPage({
            entry: "import './home.js';\nimport './settings.js';\nimport '../app.js';",
            define: { __CARD_VARIANT__: JSON.stringify(direction.id), __CARD_PRESET__: JSON.stringify(look.toString()) },
            direction, lightSetup: look.get('lightSetup'),
            fallback: '/plain/',
            // Indexed, unlike the lab.
            head: themeColor,
            source: homeSource(lang),
            fonts: [homeFont], card: true
        }), homeOut);
    }
    // Share images: generated covers (see og/PROMPT.md), 1200×630.
    for (const lang of ['ru', 'en']) await copyFile(resolve(here, `og/og-${lang}.jpg`), resolve(homeOut, `og-${lang}.jpg`)).catch(() => console.warn(`og-${lang}.jpg missing`));
    await writeFile(resolve(homeOut, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /variants/\nDisallow: /plain/\n\nSitemap: ${SITE}/sitemap.xml\n`);
    const alternates = Object.entries(HOME).map(([code, { path }]) => `    <xhtml:link rel="alternate" hreflang="${code}" href="${SITE}${path}"/>`).join('\n');
    await writeFile(resolve(homeOut, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${Object.values(HOME).map(({ path }) => `  <url>\n    <loc>${SITE}${path}</loc>\n${alternates}\n  </url>`).join('\n')}
</urlset>
`);
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
    const css = await transform(await pageCss([homeFont], true), { loader: 'css', minify: true, target: 'es2020' });
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
