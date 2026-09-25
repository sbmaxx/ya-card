// Typefaces for the card: one family sets all of its text. Each is a subset of
// the Google Fonts original (SIL OFL 1.1), weight axis 400–600, in
// assets/fonts/: `<id>.woff2` holds Latin and Cyrillic (the lab, where any name
// can be typed), `<id>-card.woff2` only the card's own characters (the homepage).
// The order is the short-link index: append new fonts, never reorder.
export const FONTS = [
    { id: 'onest', title: 'Onest', family: 'Card Onest' },
    { id: 'golos', title: 'Golos', family: 'Card Golos' },
    { id: 'inter', title: 'Inter', family: 'Card Inter' },
    { id: 'manrope', title: 'Manrope', family: 'Card Manrope' }
];

export const fontOf = index => FONTS[index] || FONTS[0];
