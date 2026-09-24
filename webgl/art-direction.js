// Small material studies, selectable by URL for direct visual comparison.
// No extra controls or resource requests are added to the card itself.
const studies = {
    etched: {
        key: 'etched', nameSize: 22, studio: true,
        name: { depth: .24, bevel: .55, raised: false },
        logo: { depth: .36, bevel: .90, raised: false, face: .44, wall: .70, warmth: 0, machined: true,
            broadPower: 12, polishPower: 48, sheen: .24 }
    },
    'satin-etch': {
        key: 'satin-etch', nameSize: 22, studio: true,
        name: { depth: .24, bevel: .55, raised: false },
        logo: { depth: .32, bevel: .95, raised: false, face: .50, wall: .66, warmth: 0, machined: true,
            broadPower: 6, polishPower: 30, sheen: .08 }
    },
    milled: {
        key: 'milled', nameSize: 22, studio: true,
        name: { depth: .24, bevel: .55, raised: false },
        logo: { depth: .40, bevel: 1.05, raised: false, face: .52, wall: .82, warmth: 0, machined: true }
    },
    cut: {
        key: 'cut', nameSize: 22,
        name: { depth: .29, bevel: .65, raised: false },
        logo: { depth: .52, bevel: 1.15, raised: false, face: .50, wall: .92, warmth: 0, machined: true }
    },
    emboss: {
        key: 'emboss', nameSize: 21.5,
        name: { depth: .23, bevel: .60, raised: false },
        logo: { depth: .44, bevel: 1.20, raised: true, face: .59, wall: .90, warmth: .012, machined: true }
    },
    smoke: {
        key: 'smoke', nameSize: 22.5,
        name: { depth: .32, bevel: .65, raised: false },
        logo: { depth: .44, bevel: .95, raised: false, face: .38, wall: .86, warmth: .008, machined: true }
    },
    satin: {
        key: 'satin', nameSize: 21,
        name: { depth: .24, bevel: .55, raised: false },
        logo: { depth: .25, bevel: .85, raised: true, face: .62, wall: .64, warmth: 0 }
    },
    inset: {
        key: 'inset', nameSize: 21,
        name: { depth: .30, bevel: .60, raised: false },
        logo: { depth: .32, bevel: .80, raised: false, face: .49, wall: .70, warmth: 0 }
    },
    polished: {
        key: 'polished', nameSize: 20.5,
        name: { depth: .14, bevel: .70, raised: true },
        logo: { depth: .18, bevel: 1.0, raised: true, face: .68, wall: .52, warmth: .025 }
    }
};

const requested = new URLSearchParams(location.search).get('study');
export const art = Object.hasOwn(studies, requested) ? studies[requested] : studies.etched;
