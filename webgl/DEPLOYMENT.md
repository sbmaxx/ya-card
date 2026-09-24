# Production: rozhdestvenskiy.ru

Published from this standalone `webgl/` version on 2026-09-24.

- SSH host: `rozhdestvenskiy.ru`, user `sbmaxx` (existing SSH configuration).
- Document root: `/var/www/rozhdestvenskiy.ru`.
- Site configuration: `/etc/nginx/sites-available/rozhdestvenskiy.ru.conf`.
- Checked-in configuration: `deploy/nginx-site.conf`. Existing API proxy and
  other paths in this vhost are preserved. No other virtual host was changed.
- Release and previous files: `/home/sbmaxx/ya-card-deploy-20260924-33`
  (20260924-33: hue-true shadows on coloured metal, clean small raised text; 20260924-32: a hand spin settles square and never hangs; 20260924-31: generated share images, versioned by content hash; 20260924-30: turn the card over by hand, with inertia; 20260924-29: fixed dark frame on phones, portrait text rhythm; 20260924-28: fuller, slowly living backdrop on phones, ping-pong loader; 20260924-27: Steel on graphite, `HOME_LOOK`; 20260924-26: backdrop on portrait phones as dark as on desktop; 20260924-25: Noir look, even light around the chamfer; 20260924-24: touch screens 15% larger card, portrait text centred on the plate,
  no roll on portrait; 20260924-23: new look from the lab, `HOME_LOOK`; 20260924-22: the card 20% smaller;
  both changed only `/` and `/en/`).

## Artifacts

| File | Bytes |
|---|---:|
| index.html (RU) | 109105 |
| index.html.gz | 44141 |
| index.html.br | 38648 |
| en/index.html (EN) | 108830 |
| og-ru.jpg, og-en.jpg | 55585, 55430 |
| robots.txt, sitemap.xml | 111, 614 |
| plain/index.html | 25193 |
| card.txt | 294 |

Compression is negotiated without installing new nginx modules. Requests with
`br;q=0` / `gzip;q=0` are respected. Public responses for Brotli, gzip and identity
were compared byte-for-byte in prior releases. Those browser checks covered
RU/EN favicon switching and no external resources. Per-release validation is
recorded below; this visual release does not rerun the regression suites.

The HTML, styles, JavaScript, Onest font, logos and favicons are contained in one document;
compressed files are alternative encodings, not additional client requests.

## Studio-lab homepage (20260924-20)

The homepage is now built from the studio lab (`webgl/variants/`): one look chosen
on `/variants/lab/`, baked in as a preset (`HOME_LOOK` in `variants/build.mjs`, the
lab's short-link code). Only that edition is bundled; the lab panel is not.
Build: `node variants/build.mjs` from `webgl/`; output `dist/home/`. Without WebGL 2,
or if the scene has not started after 20 s on screen, the page opens `/plain/`
(the same HTML card without scripts); `/card.txt` is the text version. Both are
new files in the document root. The rollback script restores the previous
homepage files and removes them.

## RU and EN addresses (20260924-21)

Russian at `/`, English at `/en/`: the same card with its own `lang`, title,
description, canonical, hreflang (ru, en, x-default), OpenGraph (locale, url,
1200×630 image `og-<lang>.jpg`) and schema.org Person. Flipping the card changes
the address with `history.pushState` (`window.cardLanguagePaths` in `app.js`); old
`/#en` links move to `/en/`. nginx serves `/en/` precompressed like `/` (a
`location = /en/` block, plus `/en` → `/en/`). `robots.txt` allows the site except
`/variants/` and `/plain/` and names `sitemap.xml`. The share images are captured
from the built pages at 1200×630 and kept in `variants/og/`.

## Rollback

The previous silver HTML and compressed variants were copied outside the
public document root. This release changes only site files; nginx is unchanged. To restore that release:

```sh
ssh rozhdestvenskiy.ru 'bash /home/sbmaxx/ya-card-deploy-20260924-33/rollback.sh'
# the release before it (RU/EN, nginx /en/, robots, sitemap, share images):
ssh rozhdestvenskiy.ru 'bash /home/sbmaxx/ya-card-deploy-20260924-21/rollback.sh'
```

The script restores the previous homepage files and vhost (with `nginx -t` and a reload) and removes the files this release added.
The original Three.js page and old nginx configuration remain in release `20260923-01`. Keep this release directory until the new site is accepted.

For subsequent deployments, create a new release directory and backup rather
than reusing this one. Validate the built HTML in a browser, upload all three
artifacts, verify hashes, atomically rename files, test nginx before reload, and
verify public compressed responses afterwards.

## Contact-interaction cycle

Changes were planned by the root agent, implemented by GPT-6 Luna, and independently
reviewed by a separate judge. The first artifact was rejected for stale focus on
layout resize and a stuck hover hold after leaving the viewport. Luna fixed both;
the judge reran 13 independent checks plus contact, core-browser and engraving
suites and approved the preceding contact-interaction release `20260924-04`. See
`reviews/2026-09-24-contact-judge.md` for evidence and the retained initial FAIL.

## Simplified-contact release

The preceding simplified-contact release removed the physical address, telephone and in-card GitHub
link. It shows email, t.me/sbmaxx, one blank row, then the site URL on both faces.
The outside social links remain. GPT-6 Luna implemented the change, and the
independent judge approved that release SHA after six checks, including
canvas coordinates, native Tab/Enter, GPU focus, ray hits and HTML fallback.
See `reviews/2026-09-24-simple-contacts-judge.md`. Public Brotli bytes were checked
against the local artifact after publication.

## Desktop stack layout

The desktop-stack release introduced a left-aligned stack: 145px logo, 20px name,
13px role, then email and Telegram. The desktop website row is hidden; mobile
layout retains email/Telegram/site. A quick desktop RU/EN/mobile render and native
Tab/resize check passed; no separate judge was used, per the user's new workflow.

## Metallic-logo update

The metallic-logo release gave the unchanged Yandex/Яндекс outlines a monochrome,
raised metallic finish. The red paint is removed from the card logo only;
name engraving, layout, contacts and official favicons are preserved. Quick
built desktop/mobile RU/EN renders and the relief fixture passed.

## Compact desktop typography

The compact-typography release follows the business-card reference: common left edge x56,
logo y42, name baseline130, role152, email188 and Telegram206. Existing metallic
logo/materials and mobile constants are preserved. Implementation-agent browser
and contact checks passed; no additional judge/audit was run.

## Alignment and balance

Desktop text and logo now share x56. All canvas content receives one vertical
offset computed from the logo top and the last line's actual glyph descent,
producing balanced top/bottom margins in both layouts. The logo's metallic face
is slightly darker for readability; its metallic bevel remains. Basic built
browser checks and RU/EN desktop/mobile screenshots passed before publication.

## Visual round with preserved baseline

Before this round, the exact production source and build were preserved as
commit `077eba6`, tag `ya-card-balanced-baseline-2026-09-24`, and local
`snapshots/2026-09-24-balanced-baseline/`. Release `20260924-10`'s rollback script also
restores those production bytes. The selected darker recessed-metal logo,
21px desktop name with finer relief, and smooth rounded-rim normals were chosen
from three controlled visual studies. Details: `design/2026-09-24-visual-round.md`.
No agents were used in this round.
The final public Brotli response matches the local artifact byte-for-byte.

## Polished engraving

Release `20260924-11` preserves the preceding public version as tag
`ya-card-inset-baseline-2026-09-24` (commit `a401257`) and local archive
`snapshots/2026-09-24-inset-baseline/`. Its rollback script restores that version.
The logo has a more defined inward bevel and a separate polished-metal reflection;
the smaller portrait logo scales its relief proportionally. Desktop name size is
22px, and both contact lines use the same dark ink. See
`design/2026-09-24-material-round.md` for the comparison with raised and darker
variants. No agents were used. Built-browser and engraving checks passed,
including the shader without OES derivatives. Public Brotli bytes match the
tested local artifact.

## Mobile composition and coherent light

Release `20260924-12` followed four successive visual passes, without agents.
The starting production state is saved as tag
`ya-card-polished-baseline-2026-09-24` (commit `36c2230`) and a complete local
source/build archive. The release rollback script restores those public bytes.
Portrait text is left-aligned, with two-line name/role and larger contacts;
short phones use a shorter plate, and landscape touch screens fit the wide
card above the bottom controls. The `milled` material unifies the round source
reflection and compresses bright highlights. HTML fallback has matching type,
silver cards and a footer that stays clear of scrolling contacts.
See `design/2026-09-24-mobile-iterations.md` for comparison artifacts and checks.

## Contact cleanup

Release `20260924-13` removes the visible site address from both language faces
and the GitHub corner link. The final Telegram glyph descent now determines
vertical balance. All layouts expose three card links: logo, email, Telegram.
Contact/focus and four mobile-layout checks passed. Public Brotli bytes match
the local build. This is the saved starting point for further visual work.

## Compact plate, thin rim and logo optics

Release `20260924-14` publishes three successive visual comparisons: 300×460
portrait proportions, 0.022 half-thickness with a 0.008 bevel, and the darker
`etched` logo with a narrower reflected highlight. No agents were used.
The rollback restores cleanup release `20260924-13`, also preserved as tag
`ya-card-clean-layout-2026-09-24` and a local source/build archive.
The single-file builder now inserts generated content literally and validates
inline JavaScript after HTML minification. Engraving, contact, built-browser and
four mobile-layout checks passed. Public Brotli matches the tested artifact.
Details and comparison images: `design/2026-09-24-post-cleanup-goal.md`.

## Idle movement and readable relief

Release `20260924-15` strengthens three-axis idle movement and light travel,
lets a parked pointer resume idle after 1.8 seconds, and selects the deeper
`sculpted` engraving. Keyboard focus and reduced-motion behavior remain stable.
The rollback restores release `20260924-14`. Motion, contact, core-browser,
engraving and mobile-layout checks passed; the public Brotli file matches the
tested build. Details: `design/2026-09-24-idle-relief.md`.

## Fixed desktop size

Release `20260924-16` uses a fixed pixel focal length for desktop: approximately
760×420px wide or 400px portrait width, shrinking only when constrained. Ray
hits and shadows use the same camera. Larger windows preserve the size and
tilted perspective. The rollback restores release `20260924-15`.
Fixed-size, contact, browser, mobile and idle-motion checks passed; public
Brotli matches the tested artifact. See `design/2026-09-24-fixed-desktop-size.md`.

## Stronger carved lettering

Release `20260924-17` adds light-dependent cavity shadows and view-dependent
inner walls to the logo and name, within the original glyph coverage. Logo
bevel/depth is 1.40/1.65 layout pixels; name is 0.80/0.80 with a quieter rim.
Two visual previews (detail/mobile, then refined mobile) and the normal build
were used; no test suites were run, as requested. The upload hashes matched.
Rollback restores release `20260924-16`.

## Ten-percent desktop reduction

Release `20260924-18` scales desktop cards down by 10%: approximately 684×378px
wide and 360px portrait width. Constrained desktop fits also shrink by 10%.
Touch sizing is unchanged. The normal build and upload hash checks passed;
no test suites were run. Rollback restores release `20260924-17`.

## Studio metal and background

Release `20260924-19` implements the approved studio-metal plan: centered
portrait logos, filtered horizontal brushing, separately polished engraving
walls/rim, rounded two-segment bevels, a moving graphite light field, static
grain and one tilt-dependent shadow. The safe-area mask stays stationary.
Size, type, engraving depth, thickness and three WebGL draw calls are retained.
One visual pass covered desktop/mobile RU/EN and changed light/tilt states,
followed by the normal single-file build and upload hashes. No test suites or
agents were used. Rollback restores release `20260924-18`.
Details: `design/2026-09-24-studio-metal.md`.

## Parallel visual editions

Three independent editions are published at `/variants/ivory/`,
`/variants/obsidian/` and `/variants/prism/`, with a comparison page at `/variants/`.
They are ordinary static subdirectories; the root release and nginx configuration
are unchanged. Source/build instructions: `variants/README.md`.
Staging directory: `/home/sbmaxx/ya-card-variants-20260924-01`.
Only builds were performed; no test suites or preview sweeps were run.

## Material-only editions

The current WebGL source and first three experiments are preserved in branch
`codex/webgl-snapshot-20260924` at `c868f8d`. The second variants release restores
the production outline, thickness and layout in all three editions. Ivory and
Obsidian have raised metallic lettering with moving contact shadows; Prism has
recessed lettering and a view-dependent oxide-film finish. No cut-outs were added.
The main homepage remains release `20260924-19`.

Variants release: `/home/sbmaxx/ya-card-variants-20260924-02`.
Rollback: `ssh rozhdestvenskiy.ru 'bash /home/sbmaxx/ya-card-variants-20260924-02/rollback.sh'`.
Build only; no test suites, browser sweeps or agents were used.
