// Lighting setups for the lab's «Свет»; renderer.js makes them into panels.
// Each lamp: centre direction, roll, gnomonic half-size, colour ('key' /
// 'fill' = the edition's studio tones, or linear RGB), power. `wrap` lamps
// follow the key brightness; `shape: 'rect'` keeps a lamp rectangular even
// when the studio lamps are round (window panes). A single-edition page
// carries only its own setup (build.mjs).
const ring = (count, radius, size, color, power) => Array.from({ length: count }, (_, i) => {
    const a = i / count * Math.PI * 2;
    return { c: [Math.cos(a) * radius, Math.sin(a) * radius, 1], roll: a, size: [size, size], color, power };
});
export const LIGHT_SETUPS = {
    studio: {
        title: 'Студия', hint: 'Главный свет сверху слева, холодная заливка справа, яркие фаски. Универсальный вариант.', key: { c: [-.24, .30, 1], power: 8 }, bounce: 1,
        lights: [
            // Soft wide key wrap: gives satin a large, gentle gradient instead of a hot spot.
            { c: [-.30, .36, 1], roll: -.40, size: [.40, .30], color: 'key', power: .8, wrap: true },
            // Narrow cool fill on the right.
            { c: [.62, -.04, 1], roll: .10, size: [.045, .55], color: 'fill', power: 4.2 },
            // Ceiling: the upper chamfer reflects straight up.
            { c: [-.40, 1, .10], size: [.55, .30], color: 'key', power: 5.5 },
            { c: [.55, 1, -.25], size: [.30, .30], color: 'fill', power: 3.2 },
            // Tall side strips for the left/right and diagonal chamfers.
            { c: [-1, .05, .05], size: [.22, .70], color: 'key', power: 4.5 },
            { c: [1, -.10, .20], size: [.14, .60], color: 'fill', power: 3.0 },
            { c: [.70, .70, .10], roll: .5, size: [.10, .40], color: 'key', power: 3.0 },
            { c: [.70, -.70, .10], roll: -.5, size: [.10, .40], color: 'fill', power: 1.6 }
        ]
    },
    softbox: {
        // One large overhead softbox and a white room: low contrast, even satin.
        // The room's walls are large and soft: the face sees them at half strength,
        // enough for a bright turn, too little to leave a band beside the bounce.
        title: 'Софтбокс', hint: 'Один большой мягкий свет сверху: металл ровный, контраста мало.', key: { c: [-.16, .30, 1], power: 4.5 }, bounce: 1.25,
        lights: [
            { c: [-.05, .42, 1], size: [.62, .36], color: 'key', power: .6, wrap: true },
            { c: [.58, .02, 1], size: [.30, .45], color: 'fill', power: .9 },
            { c: [-.58, .02, 1], size: [.30, .45], color: 'key', power: .8 },
            { c: [0, 1, .15], size: [.80, .60], color: 'key', power: 2.8, face: .5 },
            { c: [-1, .10, .10], size: [.40, .80], color: 'key', power: 2.4, face: .5 },
            { c: [1, .10, .10], size: [.40, .80], color: 'fill', power: 2.2, face: .5 }
        ]
    },
    drama: {
        // Hard key high on the left, almost nothing else: deep blacks, one flash.
        title: 'Драма', hint: 'Одна жёсткая лампа сбоку, остальное в темноте: глубокий чёрный и яркая вспышка.', key: { c: [-.52, .46, 1], power: 12 }, bounce: .3,
        lights: [
            { c: [-.62, .56, 1], size: [.16, .12], color: 'key', power: .6, wrap: true },
            { c: [1, .15, -.10], size: [.05, .60], color: 'fill', power: 3.2 },
            { c: [-.30, 1, .05], size: [.30, .12], color: 'key', power: 2.4 }
        ]
    },
    rim: {
        // Lamps behind and above: the chamfers glow, the face stays dark until tilted.
        // The face sees them too (`face: 1`): catching them is the point of this light.
        title: 'Контровой', hint: 'Свет сзади: горит контур, а пластина тёмная, пока её не наклонить.', key: { c: [-.10, .95, .30], power: 9 }, shadow: [-.12, .35, 1], bounce: .35,
        lights: [
            { c: [-1, .20, -.20], size: [.08, .80], color: 'key', power: 8, face: 1 },
            { c: [1, .20, -.20], size: [.08, .80], color: 'fill', power: 7, face: 1 },
            { c: [0, 1, -.30], size: [.80, .08], color: 'key', power: 7, face: 1 },
            { c: [0, -1, -.20], size: [.60, .06], color: 'fill', power: 2.5, face: 1 },
            { c: [.40, .30, 1], size: [.10, .10], color: 'fill', power: 1.4 }
        ]
    },
    ring: {
        // A ring light around the lens: a halo around the camera in every mirror.
        title: 'Кольцо', hint: 'Кольцевая лампа вокруг камеры: при наклоне в металле видно кольцо.', key: { c: [-.20, .26, 1], power: 3 }, shadow: [-.06, .14, 1], bounce: .7,
        lights: [
            ...ring(10, .24, .04, 'key', 5),
            { c: [0, 1, .10], size: [.50, .30], color: 'key', power: 2.5 }
        ]
    },
    window: {
        // Daylight through a four-pane window on the left, a warm room on the right.
        title: 'Окно', hint: 'Дневной свет из окна слева и тёплая комната справа.', key: { c: [-.40, .24, 1], power: 7, color: [.90, .96, 1.06] }, bounce: .9,
        lights: [
            ...[[-.86, .38], [-.62, .38], [-.86, .10], [-.62, .10]].map(([x, y]) =>
                ({ c: [x, y, 1], size: [.10, .12], color: [.88, .95, 1.08], power: 3.4, shape: 'rect' })),
            { c: [-1, .15, .10], size: [.30, .60], color: [.85, .93, 1.05], power: 3.5, shape: 'rect' },
            { c: [.70, -.10, 1], size: [.35, .50], color: [1, .86, .70], power: .9 },
            { c: [0, 1, .10], size: [.60, .40], color: [1, .92, .84], power: 1.8 },
            { c: [1, 0, .10], size: [.40, .70], color: [1, .86, .70], power: 1.6 }
        ]
    },
    neon: {
        // Two coloured tubes and a cool key: the metal picks up magenta and cyan.
        title: 'Неон', hint: 'Розовая и голубая неоновые трубки: металл окрашивается в их цвета.', key: { c: [-.24, .30, 1], power: 6, color: [.86, .92, 1] }, bounce: .35,
        lights: [
            { c: [.60, .05, 1], roll: .12, size: [.03, .60], color: [1, .10, .55], power: 9 },
            { c: [-.72, -.10, 1], roll: -.10, size: [.03, .55], color: [.05, .75, 1], power: 8 },
            { c: [-.20, 1, .10], size: [.60, .04], color: [.55, .20, 1], power: 7 },
            { c: [-1, .05, .05], size: [.05, .70], color: [.05, .75, 1], power: 6 },
            { c: [1, -.10, .20], size: [.05, .60], color: [1, .10, .55], power: 6 }
        ]
    }
};
