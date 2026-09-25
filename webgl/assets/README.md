# Favicons

Original 32×32 PNG favicons retrieved from the official home-page HTML on 2026-09-23:

- RU — https://ya.ru/: https://yastatic.net/s3/home-static/_/f4/f47b1b3d8194c36ce660324ab55a04fe.png
- EN — https://yandex.com.tr/: https://yastatic.net/s3/home-static/_/nova3/CXZ471pd.png

The originals are kept here for provenance. Both are embedded as data URLs in
`index.html` and switch with the card language, including direct `#en` entry.

Previous logo accent: `#F8604A`, read from the inline SVG background of `.search3__logo-inner` on https://ya.ru/ on 2026-09-23. The wordmark geometry and official favicon PNGs are unchanged.

# Onest

`Onest-card.woff2` is a subset of [Onest](https://github.com/google/fonts/tree/main/ofl/onest),
weight axis 400–500, licensed under SIL OFL 1.1 (`Onest-OFL.txt`).
Original: https://raw.githubusercontent.com/google/fonts/main/ofl/onest/Onest%5Bwght%5D.ttf

The subset is 8,372 bytes and contains the current Russian/English card strings,
contacts, digits and punctuation. If new characters are added, regenerate the
subset from the original font with fonttools, preserving the copyright/license.
The build embeds both the font and its license in the single HTML document.

The card wordmark is now monochrome metallic; its geometry and the original favicon PNGs remain unchanged.

# Card typefaces

`fonts/` holds the typefaces the lab can switch between (`variants/fonts.js`):
Onest, Golos Text, Inter and Manrope, all from Google Fonts
(https://github.com/google/fonts, `ofl/<family>/`), SIL OFL 1.1 (`<id>-OFL.txt`).
Each is instanced to the weight axis 400–600 (Inter also to opsz 16) with
`fonttools varLib.instancer`, then subset with `pyftsubset` (no hinting, woff2):

- `<id>.woff2` — Latin, Latin-1 and Cyrillic with common punctuation, for the
  lab, where any name can be typed;
- `<id>-card.woff2` — only the characters of `data.js` and `index.html`, for
  the homepage and the plain card, which embed just the chosen typeface.

If the card text gains new characters, regenerate the `-card` subsets.
