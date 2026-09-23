# Production: rozhdestvenskiy.ru

Published from this standalone `webgl/` version on 2026-09-24.

- SSH host: `rozhdestvenskiy.ru`, user `sbmaxx` (existing SSH configuration).
- Document root: `/var/www/rozhdestvenskiy.ru`.
- Site configuration: `/etc/nginx/sites-available/rozhdestvenskiy.ru.conf`.
- Checked-in configuration: `deploy/nginx-site.conf`. Existing API proxy and
  other paths in this vhost are preserved. No other virtual host was changed.
- Release and previous files: `/home/sbmaxx/ya-card-deploy-20260924-09`.

## Artifacts

| File | Bytes |
|---|---:|
| index.html | 64156 |
| index.html.gz | 28325 |
| index.html.br | 25057 |

HTML SHA-256:
`1dcda768c88ce1db363600ec2a15f9ca75a6f9fd54ff7ec72b8506ffc0694f45`.

Compression is negotiated without installing new nginx modules. Requests with
`br;q=0` / `gzip;q=0` are respected. Public responses for Brotli, gzip and identity
were compared byte-for-byte with the built artifacts. Browser checks passed on
the production URL, including RU/EN favicon switching and no external resources.

The HTML, styles, JavaScript, Onest font, logos and favicons are contained in one document;
compressed files are alternative encodings, not additional client requests.

## Rollback

The previous silver HTML and compressed variants were copied outside the
public document root. This release changes only site files; nginx is unchanged. To restore that release:

```sh
ssh rozhdestvenskiy.ru 'bash /home/sbmaxx/ya-card-deploy-20260924-09/rollback.sh'
```

The script atomically restores the previous site files. No nginx reload is needed.
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

Current release uses a left-aligned desktop stack: 145px logo, 20px name,
13px role, then email and Telegram. The desktop website row is hidden; mobile
layout retains email/Telegram/site. A quick desktop RU/EN/mobile render and native
Tab/resize check passed; no separate judge was used, per the user's new workflow.

## Metallic-logo update

The current release gives the unchanged Yandex/Яндекс outlines a monochrome,
raised metallic finish. The red paint is removed from the card logo only;
name engraving, layout, contacts and official favicons are preserved. Quick
built desktop/mobile RU/EN renders and the relief fixture passed.

## Compact desktop typography

Desktop now follows the compact business-card reference: common left edge x56,
logo y42, name baseline130, role152, email188 and Telegram206. Existing metallic
logo/materials and mobile constants are preserved. Implementation-agent browser
and contact checks passed; no additional judge/audit was run.

## Alignment and balance

Desktop text and logo now share x56. All canvas content receives one vertical
offset computed from the logo top and the last line's actual glyph descent,
producing balanced top/bottom margins in both layouts. The logo's metallic face
is slightly darker for readability; its metallic bevel remains. Basic built
browser checks and RU/EN desktop/mobile screenshots passed before publication.
