import { cards, logos } from '../data.js';
import { createReliefMap } from './relief.js';
import { direction } from './directions.js';

// Studio renderer for the material editions. WebGL 2, linear HDR shading,
// an analytic studio environment (no textures, no requests), Khronos PBR
// Neutral tone mapping and a quarter-resolution bloom on real highlights.
const HALF_THICKNESS = .026, CHAMFER = .015, portraitHeight = 460;
const look = direction.look;

// Logo relief: a chiselled V, a flat-floored recess or applied raised letters.
// `?relief=vcut|deboss|raised` overrides the edition's choice for comparison.
const LOGO_SHAPES = {
    vcut: { shape: 'vcut', depth: 2.2, bevel: 3.4 },
    deboss: { shape: 'deboss', depth: 1.5, bevel: 1.1 },
    raised: { shape: 'raised', depth: 1.5, bevel: 1.1 }
};
const requestedShape = new URLSearchParams(globalThis.__cardPreset ?? location.search).get('relief');
const logoShape = Object.hasOwn(LOGO_SHAPES, requestedShape) ? requestedShape : direction.relief.logo;
export const currentLogoShape = logoShape;
// Name relief: `edition` keeps the finish's own process (enamel, ablation…);
// the others cut or raise the name in the same polished metal as the logo.
const NAME_SHAPES = {
    edition: null,
    vcut: { shape: 'vcut', depth: .9, bevel: 2.0 },
    deboss: { shape: 'deboss', depth: .7, bevel: .55 },
    raised: { shape: 'raised', depth: .7, bevel: .55 }
};
const requestedName = new URLSearchParams(globalThis.__cardPreset ?? location.search).get('name');
const nameShape = Object.hasOwn(NAME_SHAPES, requestedName) ? requestedName : 'edition';
export const currentNameShape = nameShape;
const nameLook = nameShape === 'edition' ? look.name : look.logo;
// Role and contacts: flat laser marking by default, or the same metal relief
// processes as the name with profiles scaled for 12–13 px type.
const BODY_SHAPES = {
    edition: null,
    vcut: { shape: 'vcut', depth: .5, bevel: 1.1 },
    deboss: { shape: 'deboss', depth: .4, bevel: .4 },
    raised: { shape: 'raised', depth: .4, bevel: .4 }
};
const requestedBody = new URLSearchParams(globalThis.__cardPreset ?? location.search).get('body');
const bodyShape = Object.hasOwn(BODY_SHAPES, requestedBody) ? requestedBody : 'edition';
export const currentBodyShape = bodyShape;
const bodyLook = bodyShape === 'edition' ? look.text : look.logo;
const baseProfiles = { logo: LOGO_SHAPES[logoShape], name: NAME_SHAPES[nameShape] || { shape: 'deboss', ...direction.relief.name },
    text: BODY_SHAPES[bodyShape] };
// Depth multipliers from the demo stand; relief maps are rebuilt live.
const reliefProfiles = () => {
    const lab = globalThis.__cardLab;
    const scale = (profile, k) => ({ ...profile, depth: profile.depth * k });
    return { logo: scale(baseProfiles.logo, lab ? lab.logoDepth : 1), name: scale(baseProfiles.name, lab ? lab.nameDepth : 1),
        text: baseProfiles.text && scale(baseProfiles.text, lab ? lab.bodyDepth : 1) };
};
const occlusion = shape => shape === 'vcut' ? '.42' : shape === 'deboss' ? '.55' : null;

const between = (min, max) => min + Math.random() * (max - min);
const variation = {
    poseX: between(-.035, .035), poseY: between(-.045, .045), poseZ: between(-.012, .012),
    phaseX: between(0, Math.PI * 2), phaseY: between(0, Math.PI * 2), phaseZ: between(0, Math.PI * 2),
    floatPhase: between(0, Math.PI * 2), idleSpeed: between(.85, 1.15), idleAmplitude: between(.8, 1.15),
    lightPhase: between(0, Math.PI * 2), lightPeriod: between(16, 22), lightTravel: between(.85, 1.15)
};

const clamp01 = value => Math.max(0, Math.min(1, value));
const f = value => Number(value).toFixed(4);
const v3 = values => `vec3(${values.map(f).join(', ')})`;
const unit = values => { const length = Math.hypot(...values); return values.map(value => value / length); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// A rectangular light seen from the card: centre direction, roll, gnomonic size.
// Camera-facing directions are +Z; the reflected cone of the face at rest is
// roughly ±0.27 × ±0.15 around +Z, so key and fill sit just outside of it and
// sweep across the plate as it tilts. The rim reflects the horizon and ceiling.
function panel(center, roll, size, color) {
    const c = unit(center);
    const helper = Math.abs(c[1]) > .9 ? [0, 0, 1] : [0, 1, 0];
    const right0 = unit(cross(helper, c)), up0 = cross(c, right0);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const right = right0.map((value, i) => value * cr + up0[i] * sr);
    const up = up0.map((value, i) => -right0[i] * sr + value * cr);
    return { c, right, up, size, color };
}
const studio = look.studio;
const scale = (color, k) => color.map(value => value * k);
// Lighting setups. Each lamp: centre direction, roll, gnomonic half-size,
// colour ('key' / 'fill' = the edition's studio tones, or linear RGB), power.
// `wrap` lamps follow the key brightness; `shape: 'rect'` keeps a lamp
// rectangular even when the studio lamps are round (window panes).
// The key is the travelling softbox; the lab can change its shape.
const MAX_LIGHTS = 12;
const ring = (count, radius, size, color, power) => Array.from({ length: count }, (_, i) => {
    const a = i / count * Math.PI * 2;
    return { c: [Math.cos(a) * radius, Math.sin(a) * radius, 1], roll: a, size: [size, size], color, power };
});
export const LIGHT_SETUPS = {
    studio: {
        title: 'Студия', key: { c: [-.24, .30, 1], power: 8 }, bounce: 1,
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
        title: 'Софтбокс', key: { c: [-.16, .30, 1], power: 4.5 }, bounce: 1.25,
        lights: [
            { c: [-.05, .42, 1], size: [.62, .36], color: 'key', power: .6, wrap: true },
            { c: [.58, .02, 1], size: [.30, .45], color: 'fill', power: .9 },
            { c: [-.58, .02, 1], size: [.30, .45], color: 'key', power: .8 },
            { c: [0, 1, .15], size: [.80, .60], color: 'key', power: 2.8 },
            { c: [-1, .10, .10], size: [.40, .80], color: 'key', power: 2.4 },
            { c: [1, .10, .10], size: [.40, .80], color: 'fill', power: 2.2 }
        ]
    },
    drama: {
        // Hard key high on the left, almost nothing else: deep blacks, one flash.
        title: 'Драма', key: { c: [-.52, .46, 1], power: 12 }, bounce: .3,
        lights: [
            { c: [-.62, .56, 1], size: [.16, .12], color: 'key', power: .6, wrap: true },
            { c: [1, .15, -.10], size: [.05, .60], color: 'fill', power: 3.2 },
            { c: [-.30, 1, .05], size: [.30, .12], color: 'key', power: 2.4 }
        ]
    },
    rim: {
        // Lamps behind and above: the chamfers glow, the face stays dark until tilted.
        title: 'Контровой', key: { c: [-.10, .95, .30], power: 9 }, shadow: [-.12, .35, 1], bounce: .35,
        lights: [
            { c: [-1, .20, -.20], size: [.08, .80], color: 'key', power: 8 },
            { c: [1, .20, -.20], size: [.08, .80], color: 'fill', power: 7 },
            { c: [0, 1, -.30], size: [.80, .08], color: 'key', power: 7 },
            { c: [0, -1, -.20], size: [.60, .06], color: 'fill', power: 2.5 },
            { c: [.40, .30, 1], size: [.10, .10], color: 'fill', power: 1.4 }
        ]
    },
    ring: {
        // A ring light around the lens: a halo around the dark flag in every mirror.
        title: 'Кольцо', key: { c: [-.20, .26, 1], power: 3 }, shadow: [-.06, .14, 1], bounce: .7,
        lights: [
            ...ring(10, .24, .04, 'key', 5),
            { c: [0, 1, .10], size: [.50, .30], color: 'key', power: 2.5 }
        ]
    },
    window: {
        // Daylight through a four-pane window on the left, a warm room on the right.
        title: 'Окно', key: { c: [-.40, .24, 1], power: 7, color: [.90, .96, 1.06] }, bounce: .9,
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
        title: 'Неон', key: { c: [-.24, .30, 1], power: 6, color: [.86, .92, 1] }, bounce: .35,
        lights: [
            { c: [.60, .05, 1], roll: .12, size: [.03, .60], color: [1, .10, .55], power: 9 },
            { c: [-.72, -.10, 1], roll: -.10, size: [.03, .55], color: [.05, .75, 1], power: 8 },
            { c: [-.20, 1, .10], size: [.60, .04], color: [.55, .20, 1], power: 7 },
            { c: [-1, .05, .05], size: [.05, .70], color: [.05, .75, 1], power: 6 },
            { c: [1, -.10, .20], size: [.05, .60], color: [1, .10, .55], power: 6 }
        ]
    }
};
for (const setup of Object.values(LIGHT_SETUPS)) {
    setup.key.c = unit(setup.key.c);
    setup.shadowDirection = setup.shadow ? unit(setup.shadow) : setup.key.c;
    setup.lamps = setup.lights.map(light => panel(light.c, light.roll || 0, light.size, [0, 0, 0]));
}
const toneOf = color => color === 'fill' ? studio.fill : color === 'key' || !color ? studio.key : color;
// Key softbox shapes: half-size and corner radius in gnomonic units, roll, and
// a gain that keeps the emitted light (area × intensity) comparable.
export const KEY_SHAPES = {
    strip: { title: 'Полоса', size: [.50, .075], radius: .075, roll: -.52 },
    round: { title: 'Круг', size: [.17, .17], radius: .17, roll: 0 },
    window: { title: 'Окно', size: [.27, .20], radius: .06, roll: 0 }
};
for (const shape of Object.values(KEY_SHAPES)) {
    const area = 4 * shape.size[0] * shape.size[1] - (4 - Math.PI) * shape.radius ** 2;
    shape.gain = .15 / area;
}

const toneCode = `vec3 neutralTonemap(vec3 color) {
    const float start = .76;
    const float desaturation = .15;
    float x = min(color.r, min(color.g, color.b));
    float offset = x < .08 ? x - 6.25 * x * x : .04;
    color -= offset;
    float peak = max(color.r, max(color.g, color.b));
    if (peak < start) return color;
    const float d = 1.0 - start;
    float newPeak = 1.0 - d * d / (peak + d - start);
    color *= newPeak / peak;
    float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
    return mix(color, vec3(newPeak), g);
}

vec3 toSRGB(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - .055, step(.0031308, c));
}`;

// Backdrops: rendered with the card, lit by the same key light and receiving
// the card's real, blurred shadow; the room the metal reflects follows them.
// `kind` selects a surface; its pattern is baked once into a texture.
// `void` keeps the original CSS page background.
const KIND = { plain: 0, stone: 1, marble: 2, velvet: 3, concrete: 4, beam: 5, stage: 6 };
const tint = direction.tint || [.8, .85, 1];
export const BACKDROPS = {
    stage: { title: 'Сцена', kind: KIND.stage, wall: [.010, .011, .013], floor: [.004, .004, .005], pool: [.11, .115, .125],
        accent: [0, 0, 0], grain: .018, shadow: .7, roomBase: .012, bounce: 1.0, css: '#08090b', light: false },
    studio: { title: 'Графит', kind: KIND.plain, wall: [.052, .055, .062], floor: [.020, .021, .024], pool: [.15, .152, .158],
        accent: [0, 0, 0], grain: .022, shadow: .78, roomBase: .025, bounce: 1.15, css: '#15181d', light: false },
    beam: { title: 'Луч', kind: KIND.beam, wall: [.010, .011, .014], floor: [.005, .005, .006], pool: tint.map(v => v * .05),
        accent: tint.map(v => v * .55), grain: .02, shadow: .6, roomBase: .015, bounce: 1.1, css: '#07080b', light: false },
    marble: { title: 'Мрамор', kind: KIND.marble, wall: [.020, .020, .022], floor: [.010, .010, .011], pool: [.10, .10, .10],
        accent: [.30, .29, .27], grain: .012, shadow: .8, roomBase: .02, bounce: 1.1, css: '#0c0c0d', light: false },
    velvet: { title: 'Бархат', kind: KIND.velvet, wall: [.006, .008, .020], floor: [.003, .004, .010], pool: [.03, .035, .07],
        accent: [.06, .07, .15], grain: .014, shadow: .85, roomBase: .015, bounce: 1.0, css: '#070a16', light: false },
    stone: { title: 'Камень', kind: KIND.stone, wall: [.034, .034, .036], floor: [.015, .015, .016], pool: [.13, .125, .12],
        accent: [0, 0, 0], grain: .018, shadow: .82, roomBase: .018, bounce: 1.1, css: '#101112', light: false },
    concrete: { title: 'Цемент', kind: KIND.concrete, wall: [.27, .255, .235], floor: [.17, .16, .15], pool: [.20, .19, .175],
        accent: [0, 0, 0], grain: .016, shadow: .6, roomBase: .12, bounce: 1.6, css: '#8e8a84', light: true },
    paper: { title: 'Бумага', kind: KIND.plain, wall: [.56, .55, .53], floor: [.40, .395, .38], pool: [.30, .29, .275],
        accent: [0, 0, 0], grain: .014, shadow: .52, roomBase: .20, bounce: 1.9, css: '#c9c7c2', light: true }
};
const requestedBackdrop = new URLSearchParams(globalThis.__cardPreset ?? location.search).get('backdrop');
export const defaultBackdrop = Object.hasOwn(BACKDROPS, requestedBackdrop) ? requestedBackdrop : (direction.backdrop || 'studio');

const vertexSource = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
uniform mat4 uModel;
uniform mat4 uProjection;
uniform vec2 uUVBasis;
out vec3 vPosition;
out vec3 vNormal;
out vec2 vUV;
out vec3 vTangent;
out vec3 vBitangent;
out float vFacet;
void main() {
    vec4 world = uModel * vec4(aPosition, 1.0);
    vPosition = world.xyz;
    vNormal = mat3(uModel) * aNormal;
    vUV = aUV;
    vTangent = mat3(uModel) * vec3(uUVBasis.x, 0.0, 0.0);
    vBitangent = mat3(uModel) * vec3(0.0, uUVBasis.y, 0.0);
    vFacet = aNormal.z;
    gl_Position = uProjection * vec4(world.xyz - vec3(0.0, 0.0, 7.0), 1.0);
}`;

const plate = look.plate;
const brushCircular = plate.brush === 'circular';
const material = (name, m) => m.f0 ? `const vec3 ${name}_F0 = ${v3(m.f0)};` : '';

const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uEngraving;
uniform float uEdge;
uniform mat3 uRoom;
uniform float uExposure;
uniform float uOpacity;
uniform float uBloomPass;
uniform vec2 uLayoutSize;
uniform vec4 uLogoRect;
uniform vec4 uTitleRect;
uniform vec4 uTextRect;
uniform vec4 uHoverRect;
uniform vec4 uFocusRect;
uniform float uLogoScale;
uniform vec2 uBrushCenter;
uniform vec3 uKeyDirection;
uniform float uKeyGain;
uniform vec3 uRaisedHeight;
uniform float uMirror;
uniform float uFloorY;
uniform vec4 uLogoTint;
uniform vec4 uNameTint;
uniform vec4 uLogoFirstTint;
uniform vec4 uBodyTint;
// Finish per object: x first letter, y wordmark, z name, w role and contacts (1 = anodised).
uniform vec4 uTintFinish;
uniform float uTextMute;
uniform float uRoomBase;
uniform float uBounce;
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUV;
in vec3 vTangent;
in vec3 vBitangent;
in float vFacet;
out vec4 outColor;

const float PI = 3.14159265;
${material('CHAMFER', look.chamfer)}
${material('SIDE', look.side)}
${material('LOGO', look.logo)}
${material('NAME', nameLook)}
${material('TEXT', bodyLook)}
${plate.f0 ? `const vec3 PLATE_F0 = ${v3(plate.f0)};` : ''}

// Rectangular studio light in gnomonic coordinates. The edge softness grows
// with roughness, so a mirror shows a crisp panel and satin a broad gradient.
uniform vec3 uKeyRight;
uniform vec3 uKeyUp;
uniform vec2 uKeySize;
uniform float uKeyRadius;
uniform float uKeySoft;
uniform vec3 uKeyCenter;
uniform vec3 uKeyColor;
// The rest of the setup's lamps: xy half-size, z roundness (-1 = studio default).
uniform int uLightCount;
uniform vec3 uLightCenter[${MAX_LIGHTS}];
uniform vec3 uLightRight[${MAX_LIGHTS}];
uniform vec3 uLightUp[${MAX_LIGHTS}];
uniform vec3 uLightShape[${MAX_LIGHTS}];
uniform vec3 uLightColor[${MAX_LIGHTS}];

// The key softbox as a rounded rectangle (a circle at full radius). uKeySoft is
// the studio's diffuser: it widens the edge of every light on top of roughness.

float keyPanel(vec3 d, vec3 c, float blur) {
    float z = dot(d, c);
    vec2 p = vec2(dot(d, uKeyRight), dot(d, uKeyUp)) / max(z, .08);
    vec2 q = abs(p) - uKeySize + uKeyRadius;
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uKeyRadius;
    float edge = blur + uKeySoft;
    float inside = smoothstep(edge, -edge, sd);
    vec2 span = uKeySize + edge;
    float body = 1.0 - .25 * dot(p / span, p / span);
    float energy = (uKeySize.x * uKeySize.y) / (span.x * span.y);
    return inside * max(body, 0.0) * smoothstep(0.0, .25, z) * energy;
}

uniform float uRoundLights;

float panel(vec3 d, vec3 c, vec3 r, vec3 u, vec2 size, float blur, float roundness) {
    float z = dot(d, c);
    vec2 p = vec2(dot(d, r), dot(d, u)) / max(z, .08);
    // Studio lights are round (octaboxes) by default; capsules — fully rounded
    // long panels — remain as an option. A round light keeps the panel's area.
    float disc = sqrt(size.x * size.y);
    float radius = min(size.x, size.y);
    vec2 q = abs(p) - size + radius;
    float capsule = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    float sd = mix(capsule, length(p) - disc, roundness);
    vec2 shape = mix(size, vec2(disc), roundness);
    float edge = blur + uKeySoft;
    float inside = smoothstep(edge, -edge, sd);
    // Real softboxes are a little brighter in the middle than at the frame.
    vec2 span = shape + edge;
    float body = 1.0 - .25 * dot(p / span, p / span);
    // A rough surface spreads the same energy over a larger solid angle.
    float energy = (shape.x * shape.y) / (span.x * span.y);
    return inside * max(body, 0.0) * smoothstep(0.0, .25, z) * energy;
}

vec3 room(vec3 world, float rough) {
    // The floor reflection sees the room mirrored as well.
    vec3 d = uRoom * (world * vec3(1.0, uMirror > .5 ? -1.0 : 1.0, 1.0));
    float blur = .004 + rough * rough * 1.5;
    // Dark floor, dim ceiling and a faint horizon for the side walls.
    vec3 col = mix(vec3(.006, .006, .007), vec3(.045, .047, .052), smoothstep(-.6, .9, d.y));
    col += vec3(.10, .10, .095) * exp(-d.y * d.y * mix(40.0, 5.0, rough)) * smoothstep(.3, -.2, d.z);
    // A dim bounce card around the camera with a black flag in its centre:
    // satin averages the two into a mid tone, a mirror sees the dark flag.
    float bounce = panel(d, vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec2(.95, .70), blur + .08, uRoundLights);
    float flag = panel(d, vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec2(.30, .20), blur + .02, uRoundLights);
    col += vec3(${f(studio.bounce)}) * uBounce * (bounce - .82 * flag);
    // Light walls (the paper backdrop) surround the card with brighter room.
    col += vec3(uRoomBase) * smoothstep(-.9, .3, d.y);
    col += uKeyColor * uKeyGain * keyPanel(d, uKeyCenter, blur);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uLightCount) break;
        vec3 shape = uLightShape[i];
        col += uLightColor[i] * panel(d, uLightCenter[i], uLightRight[i], uLightUp[i], shape.xy, blur, shape.z < 0.0 ? uRoundLights : shape.z);
    }
    return col;
}

vec3 fresnel(vec3 f0, float nv) {
    return f0 + (1.0 - f0) * pow(1.0 - nv, 5.0);
}

// Brushed metal: micro-grooves tilt the normal across the brush direction,
// which stretches every reflection into a streak perpendicular to the grain.
vec3 brushed(vec3 n, vec3 v, vec3 across, float rough, float aniso) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 7; i++) {
        float s = (float(i) - 3.0) / 3.0;
        vec3 ni = normalize(n + across * s * aniso);
        sum += room(reflect(-v, ni), rough) * (1.0 - .5 * s * s);
    }
    return sum / 5.4444;
}

vec3 metal(vec3 f0, vec3 n, vec3 v, float rough) {
    float nv = max(dot(n, v), 1e-3);
    return fresnel(f0, nv) * room(reflect(-v, n), rough);
}

// Gloss dielectric (enamel, lacquer): coloured diffuse under a sharp 4% coat.
vec3 gloss(vec3 albedo, vec3 n, vec3 v, float rough);

// Colour on a letter: enamel fills the flat faces and leaves polished bevels;
// anodising colours the metal itself, bevels included.
vec3 tinted(vec3 base, vec4 tint, float finish, vec3 n, vec3 facet, vec3 v, float rough, float edge) {
    if (tint.a < .5) return base;
    vec3 anod = metal(tint.rgb, facet, v, max(.06, rough));
    return mix(mix(gloss(tint.rgb * 1.9, n, v, .10), anod, finish), mix(base, anod, finish), edge);
}

vec3 gloss(vec3 albedo, vec3 n, vec3 v, float rough) {
    float nv = max(dot(n, v), 1e-3);
    float coat = .04 + .96 * pow(1.0 - nv, 5.0);
    // Semi-gloss: a thin lacquer, so a passing light gleams without hiding the letter.
    return albedo * room(n, 1.0) * 2.2 * (1.0 - coat) + coat * .55 * room(reflect(-v, n), rough);
}

float hash(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
float grain(float g) {
    float i = floor(g), t = fract(g);
    return mix(hash(i), hash(i + 1.0), t * t * (3.0 - 2.0 * t));
}

${plate.film ? `
// Anodised titanium: a thin oxide film. Interference depends on thickness and
// on the refraction angle, so the colour slides as the card turns.
vec3 filmF0(float nv, vec2 uv) {
    float n = 2.3;
    float cosT = sqrt(1.0 - (1.0 - nv * nv) / (n * n));
    // 145–205 nm: gold → bronze → magenta → violet → blue, the heat-tint range.
    float thickness = mix(145.0, 205.0, smoothstep(-.05, 1.05, uv.x * .8 + (1.0 - uv.y) * .3))
                    + 6.0 * sin(uv.x * 5.1 + uv.y * 3.3);
    vec3 phase = 4.0 * PI * n * thickness * cosT / vec3(640.0, 540.0, 460.0);
    vec3 r = .5 + .5 * cos(phase);
    // Keep the metal underneath: the oxide tints, it does not paint.
    r = mix(vec3(dot(r, vec3(.3333))), r, .55);
    return mix(vec3(.22, .21, .24), vec3(.70, .67, .72), r);
}` : ''}

${toneCode}
float inRect(vec4 r) {
    return step(r.x, vUV.x) * step(r.y, vUV.y) * step(vUV.x, r.z) * step(vUV.y, r.w);
}

void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vec3(0.0, 0.0, 7.0) - vPosition);
    vec3 T = normalize(vTangent), B = normalize(vBitangent);
    vec2 surfacePx = vUV * uLayoutSize;
    float footprint = max(fwidth(vUV.x) * uLayoutSize.x, fwidth(vUV.y) * uLayoutSize.y);
    float resolved = 1.0 - smoothstep(.85, 1.8, footprint);
    vec4 ink = texture(uTexture, vUV);
    vec4 relief = texture(uEngraving, vUV);
    vec3 color;

    if (uEdge > .5) {
        // Diamond-cut chamfer: a narrow mirror facet. The side wall is satin.
        float chamfer = smoothstep(.25, .45, abs(vFacet)) * (1.0 - smoothstep(.95, .99, abs(vFacet)));
        vec3 cut = metal(CHAMFER_F0, n, v, ${f(look.chamfer.rough)});
        vec3 wall = metal(SIDE_F0, n, v, ${f(look.side.rough)});
        color = mix(wall, cut, chamfer);
    } else {
        // Brushing direction and fine groove texture, filtered by pixel footprint.
        ${brushCircular ? `
        vec2 radial = surfacePx - uBrushCenter * uLayoutSize;
        float radius = length(radial);
        vec3 across = normalize(T * radial.x + B * radial.y + 1e-4);
        float groove = radius;` : `
        vec3 across = B;
        float groove = surfacePx.y;`}
        float fine = fwidth(groove);
        float texture1 = (grain(groove * 2.3) - .5) * (1.0 - smoothstep(.25, .6, fine * 2.3));
        float texture2 = (grain(groove * .9 + 17.0) - .5) * (1.0 - smoothstep(.25, .6, fine * .9));
        float grooves = texture1 * .8 + texture2 * .6;
        float plateRough = ${f(plate.rough)} * (1.0 + grooves * .12);
        float nv = max(dot(n, v), 1e-3);
        ${plate.film ? 'vec3 plateF0 = filmF0(nv, vUV);' : 'vec3 plateF0 = PLATE_F0;'}
        color = fresnel(plateF0, nv) * brushed(n, v, across, plateRough, ${f(plate.aniso)});
        color *= 1.0 + grooves * .05;
        ${plate.coat ? `
        // PVD coatings keep a faint clear reflection above the dark metal.
        color += ${f(plate.coat)} * room(reflect(-v, n), .10);` : ''}

        float logoRegion = inRect(uLogoRect);
        float titleRegion = inRect(uTitleRect) * (1.0 - logoRegion);
        float textRegion = 1.0 - logoRegion - titleRegion;
        float engraved = clamp(relief.a / max(ink.a, .001), 0.0, 1.0);
        vec2 slopeXY = (relief.rg * 255.0 - 128.0) / 127.0 * resolved;
        float slope = length(slopeXY);
        vec3 facet = normalize(T * slopeXY.x + B * slopeXY.y + n * sqrt(max(.01, 1.0 - dot(slopeXY, slopeXY))));
        float depth = relief.b;
        // Specular anti-aliasing (Kaplanyan–Hoffman): where the relief normal
        // turns faster than a pixel can show, widen the reflection instead of
        // letting a mirror flicker between a bright panel and dark room.
        vec3 dnx = dFdx(facet), dny = dFdy(facet);
        float letterRough = sqrt(min((dot(dnx, dnx) + dot(dny, dny)) * .6, .20));

        // Links: underline and keyboard focus are drawn with the text process.
        vec2 aa = max(fwidth(vUV) * .7, vec2(1e-5));
        vec2 enter = smoothstep(uHoverRect.xy - aa, uHoverRect.xy + aa, vUV);
        vec2 leave = 1.0 - smoothstep(uHoverRect.zw - aa, uHoverRect.zw + aa, vUV);
        float underline = enter.x * enter.y * leave.x * leave.y;
        vec2 focusInside = step(uFocusRect.xy, vUV) * step(vUV, uFocusRect.zw);
        vec2 focusThickness = max(fwidth(vUV) * 2.4, vec2(.0014));
        vec2 focusEdge = min(vUV - uFocusRect.xy, uFocusRect.zw - vUV);
        float focusStroke = min(1.0, focusInside.x * focusInside.y
            * ((1.0 - step(focusThickness.x, focusEdge.x)) + (1.0 - step(focusThickness.y, focusEdge.y))));

        ${logoShape === 'raised' || nameShape === 'raised' || bodyShape === 'raised' ? `
        // Applied letters stand proud of the plate and throw a short, soft
        // shadow away from the key light onto the surrounding metal.
        vec3 L = normalize(uKeyDirection);
        vec2 lightSlope = vec2(dot(L, T), dot(L, B)) / max(dot(L, n), .35);
        vec4 pad = vec4(-6.0, -6.0, 6.0, 6.0) / uLayoutSize.xyxy;
        float nearLogo = inRect(uLogoRect + pad);
        float nearName = inRect(uTitleRect + pad) * (1.0 - nearLogo);
        float nearText = inRect(uTextRect + pad) * (1.0 - nearLogo) * (1.0 - nearName);
        float raisedHeight = nearLogo * uRaisedHeight.y * uLogoScale + nearName * uRaisedHeight.x + nearText * uRaisedHeight.z;
        vec2 castStep = lightSlope * raisedHeight * 1.6 / uLayoutSize;
        float occluder = texture(uEngraving, vUV + castStep * .5).a * .45
                       + texture(uEngraving, vUV + castStep).a * .35
                       + texture(uEngraving, vUV + castStep * 1.8).a * .20;
        color *= 1.0 - occluder * (1.0 - ink.a) * .6 * step(.001, raisedHeight) * resolved;` : ''}
        float coverage = max(ink.a, max(underline, focusStroke));
        if (coverage > .001) {
            ${letteringCode('logo', look.logo)}
            ${occlusion(logoShape) ? `
            // Recessed logo: the floor sees less of the room than the plate.
            logoColor *= mix(1.0, ${occlusion(logoShape)}, depth);` : ''}
            ${letteringCode('name', nameLook)}
            ${nameShape !== 'edition' && occlusion(nameShape) ? `nameColor *= mix(1.0, ${occlusion(nameShape)}, depth);` : ''}
            ${letteringCode('text', bodyLook, bodyShape === 'edition')}
            ${bodyShape !== 'edition' && occlusion(bodyShape) ? `textColor *= mix(1.0, ${occlusion(bodyShape)}, depth);` : ''}
            // Colour: enamel fills the flat faces and leaves polished bevels;
            // anodising colours the metal itself, bevels included.
            float letterEdge = smoothstep(.12, .45, slope) * resolved;
            // The first letter of the wordmark is drawn red-only in the mask.
            vec3 inkColor = ink.rgb / max(ink.a, .001);
            float firstLetter = smoothstep(.6, .3, inkColor.g);
            logoColor = mix(tinted(logoColor, uLogoTint, uTintFinish.y, n, facet, v, letterRough, letterEdge),
                            tinted(logoColor, uLogoFirstTint, uTintFinish.x, n, facet, v, letterRough, letterEdge), firstLetter);
            nameColor = tinted(nameColor, uNameTint, uTintFinish.z, n, facet, v, letterRough, letterEdge);
            textColor = tinted(textColor, uBodyTint, uTintFinish.w, n, facet, v, letterRough, letterEdge);
            // Role and contacts sit back: a shallower mark, closer to the plate.
            textColor = mix(textColor, color, uTextMute);
            vec3 lettering = logoColor * logoRegion + nameColor * titleRegion + textColor * textRegion;
            // Links are always drawn with the body-text process.
            float linkMark = max(underline, focusStroke);
            lettering = mix(lettering, textColor, linkMark);
            color = mix(color, lettering, coverage);
        }
    }

    vec3 hdr = color * uExposure;
    if (uBloomPass > .5) {
        // Store the part above white, compressed, for the quarter-resolution glow.
        outColor = vec4(max(hdr - vec3(1.6), 0.0) * .25 * uOpacity, 1.0);
        return;
    }
    vec3 display = toSRGB(neutralTonemap(hdr));
    if (uMirror > .5) {
        // Reflection in black acrylic: dim, fading with distance below the floor.
        float fade = .40 * exp(-max(uFloorY - vPosition.y, 0.0) * 1.1) * uOpacity;
        outColor = vec4(display * fade, fade);
        return;
    }
    outColor = vec4(display * uOpacity, uOpacity);
}`;

// GLSL for one lettering process. Produces `<name>Color`.
function letteringCode(name, m, flat = false) {
    const out = `${name}Color`;
    if (m.process === 'vcut') return `
            // Diamond V-cut: both walls are polished; the lower groove is occluded.
            float ${name}Wall = smoothstep(.02, .20, slope);
            vec3 ${out} = metal(${name.toUpperCase()}_F0, facet, v, max(${f(m.rough)}, letterRough)) * mix(1.0, .9, ${name}Wall);`;
    if (m.process === 'enamel') return `
            // Cut-and-fill: gloss enamel sits a hair below a polished lip.
            float ${name}Lip = smoothstep(.25, .55, slope) * resolved;
            vec3 ${out} = mix(gloss(${v3(m.albedo)}, n, v, .12),
                metal(${v3(m.lip)}, facet, v, max(.04, letterRough)), ${name}Lip * .55);`;
    if (m.process === 'ablate') return `
            // Laser ablation: coating removed, bare frosted steel below.
            vec3 ${out} = metal(${name.toUpperCase()}_F0, ${flat ? 'n' : 'facet'}, v, ${flat ? f(m.rough) : `max(${f(m.rough)}, letterRough)`});
            ${out} += ${name.toUpperCase()}_F0 * room(n, 1.0) * .35;`;
    return `
            // Laser annealing: dark oxide with a faint, rough sheen.
            vec3 ${out} = ${v3(m.albedo)} * room(n, 1.0) * 2.0 + .008 * room(reflect(-v, n), .55);`;
}

// Compile every program at once. With KHR_parallel_shader_compile the driver
// works in the background while fonts and logos load; status is polled rather
// than forced, so the page never blocks on the large studio shader.
async function compilePrograms(gl, pairs) {
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    const jobs = pairs.map(([vertex, fragment]) => {
        const program = gl.createProgram();
        const shaders = [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]].map(([type, source]) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            gl.attachShader(program, shader);
            return shader;
        });
        gl.linkProgram(program);
        return { program, shaders };
    });
    if (parallel) {
        while (!jobs.every(({ program }) => gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR))) {
            await new Promise(resolve => setTimeout(resolve, 16));
        }
    }
    try {
        for (const { program, shaders } of jobs) {
            if (gl.getProgramParameter(program, gl.LINK_STATUS)) continue;
            const log = shaders.map(shader => gl.getShaderInfoLog(shader)).filter(Boolean).join('\n');
            throw new Error(log || gl.getProgramInfoLog(program));
        }
    } catch (error) {
        jobs.forEach(({ program }) => gl.deleteProgram(program));
        throw error;
    } finally {
        jobs.forEach(({ shaders }) => shaders.forEach(shader => gl.deleteShader(shader)));
    }
    return jobs.map(({ program }) => program);
}

// The card's silhouette projected from the key light onto the backdrop plane.
const shadowVertex = `#version 300 es
layout(location = 0) in vec3 aPosition;
uniform mat4 uModel;
uniform mat4 uProjection;
uniform vec3 uLight;
void main() {
    vec3 world = (uModel * vec4(aPosition, 1.0)).xyz;
    float t = (-0.9 - uLight.z) / min(world.z - uLight.z, -1e-3);
    vec3 onWall = uLight + (world - uLight) * t;
    gl_Position = uProjection * vec4(onWall - vec3(0.0, 0.0, 7.0), 1.0);
}`;
const shadowFragment = `#version 300 es
precision mediump float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }`;
const noiseCode = `float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = .5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= .5; }
    return v;
}`;

// Surface pattern, baked once per backdrop and size: R albedo variation,
// G accent (vein, pore, haze), BA the surface normal for raking light.
const patternFragment = `#version 300 es
precision highp float;
uniform float uKind;
uniform float uAspect;
in vec2 vUV;
out vec4 outColor;
${noiseCode}
float height(vec2 q, float kind) {
    if (kind < 1.5) return fbm(q * 3.2);                          // honed slate
    if (kind < 2.5) return fbm(q * 1.4) * .15;                    // polished marble
    if (kind < 3.5) return fbm(vec2(q.x * 2.0, q.y * 5.0)) * .25; // velvet nap
    return fbm(q * 2.6) * .35;                                     // cement, soft trowel relief
}
void main() {
    vec2 q = (vUV - .5) * vec2(uAspect, 1.0);
    float kind = uKind;
    float albedo = .5, accent = 0.0;
    float h = height(q, kind);
    float e = .004;
    vec2 grad = vec2(height(q + vec2(e, 0.0), kind) - h, height(q + vec2(0.0, e), kind) - h) / e;
    if (kind > .5 && kind < 1.5) albedo = h;
    if (kind > 1.5 && kind < 2.5) {
        // Nero Marquina: domain-warped veins, a main family and fine cracks.
        // Veins follow one diagonal grain, gently warped; thickness varies along them.
        vec2 m = q * 1.1;
        vec2 w = vec2(fbm(m * .8 + vec2(1.7, 9.2)), fbm(m * .8 + vec2(8.3, 2.8)));
        float f = fbm(m + 1.3 * w);
        float grain = m.x * .9 + m.y * .45 + f * 1.6;
        float width = mix(.012, .055, fbm(m * 1.7 + 3.1));
        float main = smoothstep(width, 0.0, abs(fract(grain * 1.9) - .5) - .006);
        float branch = smoothstep(.012, 0.0, abs(fract((m.x * .4 - m.y * 1.1 + f * 2.2) * 1.3) - .5)) * .45;
        albedo = .42 + .3 * fbm(m * 2.5 + 7.0);
        // Veins fade in and out along their length, as in real stone.
        accent = clamp(main * smoothstep(.35, .65, fbm(m * 2.2 + 2.0)) + branch * smoothstep(.45, .7, f), 0.0, 1.0);
    }
    if (kind > 2.5 && kind < 3.5) {
        // Crushed velvet: large patches where the pile leans a different way.
        albedo = .5 + .6 * (fbm(q * 1.3 + 3.0) - .5);
        accent = noise(q * vec2(700.0, 260.0));
    }
    if (kind > 3.5 && kind < 4.5) {
        // Micro-cement: soft trowel clouds and small pores.
        albedo = fbm(q * 1.6 + 7.0);
        // Sparse, tiny pores; rotated so their lattice never lines up with the screen.
        vec2 r = mat2(.8, -.6, .6, .8) * q;
        accent = smoothstep(.9, .97, noise(r * 330.0)) * smoothstep(.35, .65, fbm(q * 6.0 + 3.0));
    }
    if (kind > 4.5 && kind < 5.5) {
        // Slow haze for the light beam.
        albedo = fbm(q * vec2(1.4, 2.6) + 4.0);
        accent = fbm(q * 4.0 + 9.0);
    }
    vec2 n = clamp(-grad * .5, -1.0, 1.0);
    outColor = vec4(albedo, accent, n * .5 + .5);
}`;

const backdropFragment = `#version 300 es
precision highp float;
uniform sampler2D uShadow;
uniform sampler2D uPattern;
uniform vec2 uResolution;
uniform vec2 uPool;
uniform vec3 uWall;
uniform vec3 uFloor;
uniform vec3 uPoolColor;
uniform vec3 uAccent;
uniform vec3 uKeyDirection;
uniform float uKind;
uniform float uGrain;
uniform float uShadowStrength;
uniform float uShadowFade;
uniform float uFocal;
uniform float uFloorY;
uniform vec2 uCardCenter;
// Touch screens: the scene melts into flat edge colours that Safari extends
// under its status bar and toolbar (fractions of height; 0 disables).
uniform vec4 uEdgeFade;
uniform vec3 uEdgeTop;
uniform vec3 uEdgeBottom;
in vec2 vUV;
out vec4 outColor;
${toneCode}
${noiseCode}

// Wall lighting at a screen position: base tone, key light pool, pattern.
vec3 wallColor(vec2 uv, vec2 p) {
    float aspect = uResolution.x / uResolution.y;
    vec3 color = uWall;
    vec2 d = (uv - uPool) * vec2(aspect, 1.0) * vec2(.85, 1.1);
    float pool = exp(-dot(d, d) * 2.6);
    color += uPoolColor * pool;
    vec4 pattern = texture(uPattern, uv);
    vec3 n = normalize(vec3(pattern.ba * 2.0 - 1.0, 1.0));
    vec3 k = normalize(uKeyDirection * vec3(1.0, 1.0, .35));
    float rake = max(dot(n, k), 0.0);
    if (uKind > .5 && uKind < 1.5) color *= (.78 + .44 * pattern.r) * (.72 + .56 * rake);
    if (uKind > 1.5 && uKind < 2.5) {
        color *= .75 + .5 * pattern.r;
        // Polished veins catch the pool of light more than the dark ground.
        color += uAccent * pattern.g * (.25 + 1.1 * pool);
    }
    if (uKind > 2.5 && uKind < 3.5) {
        // Pile sheen: patches that face the light glow, fibres add a fine sparkle.
        float sheen = pattern.r * (.25 + 1.3 * pool);
        color = color * (.75 + .4 * pattern.r) + uAccent * sheen * (.8 + .4 * pattern.g);
    }
    if (uKind > 3.5 && uKind < 4.5) color *= (.9 + .18 * pattern.r) * (1.0 - .35 * pattern.g) * (.92 + .16 * rake);
    if (uKind > 4.5 && uKind < 5.5) {
        // A soft volumetric beam from the key, falling towards the card.
        vec2 origin = vec2(.5 + uKeyDirection.x * 1.3, .5 + uKeyDirection.y * 1.3 + .25);
        vec2 axis = normalize(vec2(.5, .48) - origin);
        vec2 rel = (uv - origin) * vec2(aspect, 1.0);
        float along = dot(rel, normalize(axis * vec2(aspect, 1.0)));
        float across = length(rel - normalize(axis * vec2(aspect, 1.0)) * along);
        float width = .10 + along * .32;
        float beam = exp(-across * across / (width * width)) * smoothstep(0.0, .25, along) * exp(-along * .55);
        color += uAccent * beam * (.55 + .9 * pattern.r) + uAccent * .12 * pattern.g * pool;
    }
    return color;
}

void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (vUV - .5) * vec2(aspect, 1.0);
    vec3 color;
    if (uKind > 5.5) {
        // Stage: a camera ray either meets the glossy floor or the far wall.
        vec2 ndc = vUV * 2.0 - 1.0;
        vec3 dir = normalize(vec3(ndc.x * aspect / uFocal, ndc.y / uFocal, -1.0));
        float t = dir.y < 0.0 ? uFloorY / dir.y : 1e6;
        vec3 hit = vec3(0.0, 0.0, 7.0) + dir * t;
        if (hit.z > -0.9) {
            // Black acrylic: reflects the wall and pool, more at grazing angles.
            vec3 r = vec3(dir.x, -dir.y, dir.z);
            float tw = (-0.9 - hit.z) / r.z;
            vec3 onWall = hit + r * tw;
            vec2 wallUV = vec2(onWall.x * uFocal / (aspect * 7.9), onWall.y * uFocal / 7.9) * .5 + .5;
            float fresnel = .04 + .96 * pow(1.0 - abs(dir.y), 5.0);
            color = uFloor + wallColor(wallUV, p) * (.25 + .6 * fresnel);
            // A soft pool of darkness right below the floating card.
            vec2 under = vec2(hit.x - uCardCenter.x, hit.z) * vec2(.55, 1.1);
            color *= 1.0 - .55 * exp(-dot(under, under) * 1.2) * uShadowFade;
            // The far edge of the floor melts into the wall: no hard horizon line.
            color = mix(wallColor(vUV, p), color, smoothstep(-.9, -.35, hit.z));
        } else {
            color = wallColor(vUV, p);
        }
    } else {
        // Cyclorama: the wall curves softly into a darker floor below the card.
        float floorAmount = smoothstep(-.12, -.62, p.y);
        color = mix(wallColor(vUV, p), uFloor + (wallColor(vUV, p) - uWall) * .6, floorAmount);
    }
    color *= 1.0 - .55 * smoothstep(.3, 1.15, length(p * vec2(.78, 1.0)));
    color *= 1.0 - texture(uShadow, vUV).r * uShadowStrength * uShadowFade;
    vec3 display = toSRGB(neutralTonemap(color));
    display += (hash(gl_FragCoord.xy + 17.0) - .5) * uGrain;
    // Touch screens: the backdrop is only a core in the middle. Above and below
    // it ramps into the flat page colour, which continues under Safari's bars.
    // x/y: flat band at the top/bottom, z/w: length of the ramp before it.
    if (uEdgeFade.x > 0.0) display = mix(display, uEdgeTop, smoothstep(1.0 - uEdgeFade.x - uEdgeFade.z, 1.0 - uEdgeFade.x, vUV.y));
    if (uEdgeFade.y > 0.0) display = mix(display, uEdgeBottom, smoothstep(uEdgeFade.y + uEdgeFade.w, uEdgeFade.y, vUV.y));
    outColor = vec4(display, 1.0);
}`;

const screenVertex = `#version 300 es
out vec2 vUV;
void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUV = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const blurFragment = `#version 300 es
precision mediump float;
uniform sampler2D uSource;
uniform vec2 uStep;
in vec2 vUV;
out vec4 outColor;
void main() {
    vec3 s = texture(uSource, vUV).rgb * .2270;
    s += (texture(uSource, vUV + uStep * 1.3846).rgb + texture(uSource, vUV - uStep * 1.3846).rgb) * .3162;
    s += (texture(uSource, vUV + uStep * 3.2308).rgb + texture(uSource, vUV - uStep * 3.2308).rgb) * .0703;
    outColor = vec4(s, 1.0);
}`;
const compositeFragment = `#version 300 es
precision mediump float;
uniform sampler2D uNear;
uniform sampler2D uWide;
uniform float uStrength;
in vec2 vUV;
out vec4 outColor;
void main() {
    vec3 glow = (texture(uNear, vUV).rgb + texture(uWide, vUV).rgb * .55) * 4.0 * uStrength;
    glow = 1.0 - exp(-glow);
    outColor = vec4(glow, max(glow.r, max(glow.g, glow.b)));
}`;

// Column-major rotation RY * RX; uniform scale keeps normals correct after normalization.
function modelMatrix(x, y, scale, lift, z = 0, depth = 0) {
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y);
    const matrix = new Float32Array([
        cy * scale, 0, -sy * scale, 0,
        sy * sx * scale, cx * scale, cy * sx * scale, 0,
        sy * cx * scale, -sx * scale, cy * cx * scale, 0,
        0, lift, depth, 1
    ]);
    const cz = Math.cos(z), sz = Math.sin(z);
    for (let column = 0; column < 3; column++) {
        const index = column * 4;
        const a = matrix[index], b = matrix[index + 1];
        matrix[index] = cz * a - sz * b;
        matrix[index + 1] = sz * a + cz * b;
    }
    return matrix;
}

function multiplyMatrices(left, right) {
    const result = new Float32Array(16);
    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            for (let k = 0; k < 4; k++) {
                result[column * 4 + row] += left[k * 4 + row] * right[column * 4 + k];
            }
        }
    }
    return result;
}

// Room orientation (world → room), row-major 3×3 from yaw then pitch.
function roomMatrix(yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // R = Rx(pitch) * Ry(yaw); uploaded column-major for GLSL.
    const r = [
        [cy, 0, sy],
        [sp * sy, cp, -sp * cy],
        [-cp * sy, sp, cp * cy]
    ];
    return new Float32Array([r[0][0], r[1][0], r[2][0], r[0][1], r[1][1], r[2][1], r[0][2], r[1][2], r[2][2]]);
}

function follow(value, velocity, target, frequency, dt) {
    const offset = value - target;
    const decay = Math.exp(-frequency * dt);
    const step = (velocity + frequency * offset) * dt;
    return [target + (offset + step) * decay, (velocity - frequency * step) * decay];
}

function projectionMatrix(aspect, focal = 1 / Math.tan(Math.PI / 8)) {
    const near = 0.1, far = 30;
    return new Float32Array([focal / aspect, 0, 0, 0, 0, focal, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}

function roundedOutline(width, height, vertical) {
    const w = width / 2, h = height / 2;
    const points = vertical ? [[-w, h], [w, h], [w, -h * .74], [0, -h], [-w, -h * .74]]
        : [[-w, h], [w * .74, h], [w, 0], [w * .74, -h], [-w, -h]];
    const result = [];
    points.forEach((p, index) => {
        const previous = points[(index + 4) % 5], next = points[(index + 1) % 5];
        const a = Math.hypot(previous[0] - p[0], previous[1] - p[1]);
        const b = Math.hypot(next[0] - p[0], next[1] - p[1]);
        const r = .055;
        const start = [p[0] + (previous[0] - p[0]) * r / a, p[1] + (previous[1] - p[1]) * r / a];
        const end = [p[0] + (next[0] - p[0]) * r / b, p[1] + (next[1] - p[1]) * r / b];
        for (let step = 0; step <= 8; step++) {
            const t = step / 8, u = 1 - t;
            result.push([u * u * start[0] + 2 * u * t * p[0] + t * t * end[0], u * u * start[1] + 2 * u * t * p[1] + t * t * end[1]]);
        }
    });
    return result;
}

// Face, back and a faceted rim: 45° diamond-cut chamfers around a satin wall.
// Facets keep their own normals (hard edges), so each chamfer reads as a
// crisp polished line rather than a rounded, blurred shoulder.
function geometry(width, height, vertical) {
    const outline = roundedOutline(width, height, vertical);
    const rimNormals = outline.map((point, i) => {
        const previous = outline[(i + outline.length - 1) % outline.length];
        const next = outline[(i + 1) % outline.length];
        const before = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
        const after = Math.hypot(next[0] - point[0], next[1] - point[1]);
        const nx = -(point[1] - previous[1]) / before - (next[1] - point[1]) / after;
        const ny = (point[0] - previous[0]) / before + (next[0] - point[0]) / after;
        const length = Math.hypot(nx, ny);
        return [nx / length, ny / length];
    });
    const faces = [[], [], []];
    const d = HALF_THICKNESS, c = CHAMFER, s = Math.SQRT1_2;
    const inset = (point, normal, amount) => [point[0] - normal[0] * amount, point[1] - normal[1] * amount];
    // [inset, z] pairs with the facet normal [outward, z] shared by both ends.
    const facets = [
        [[c, d], [0, d - c], [s, s]],
        [[0, d - c], [0, -(d - c)], [1, 0]],
        [[0, -(d - c)], [c, -d], [s, -s]]
    ];
    function vertex(target, x, y, z, nx, ny, nz, back = false) {
        let u = x / width + .5, v = .5 - y / height;
        if (back) { if (vertical) u = 1 - u; else v = 1 - v; }
        target.push(x, y, z, nx, ny, nz, u, v);
    }
    outline.forEach((a, i) => {
        const b = outline[(i + 1) % outline.length];
        const normalA = rimNormals[i], normalB = rimNormals[(i + 1) % outline.length];
        const ai = inset(a, normalA, c), bi = inset(b, normalB, c);
        for (const p of [[0, 0], bi, ai]) vertex(faces[0], ...p, d, 0, 0, 1);
        for (const p of [[0, 0], ai, bi]) vertex(faces[1], ...p, -d, 0, 0, -1, true);
        for (const [top, bottom, normal] of facets) {
            for (const [point, rim, band] of [[a, normalA, top], [b, normalB, top], [a, normalA, bottom],
                [a, normalA, bottom], [b, normalB, top], [b, normalB, bottom]]) {
                vertex(faces[2], ...inset(point, rim, band[0]), band[1], rim[0] * normal[0], rim[1] * normal[0], normal[1]);
            }
        }
    });
    return faces.map(face => new Float32Array(face));
}

function logoImage(lang) {
    const logo = logos[lang];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logo.viewBox}" width="${logo.viewBox.split(' ')[2]}" height="${logo.viewBox.split(' ')[3]}"><path d="${logo.text}" fill="#fff"/><path d="${logo.ya}" fill="#f00"/></svg>`;
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
}

// The texture is only a coverage mask; each region selects its own process in the shader.
// Composition. `accent` makes the name the hero and the wordmark a signature.
const LAYOUTS = {
    classic: {
        landscape: { logo: 145, logoY: 42, center: false, name: [130], nameSize: direction.relief.nameSize, role: [152], contacts: 188, lineHeight: 18 },
        portrait: { logo: 110, logoY: 76, center: true, name: [164, 193], nameSize: 24, role: [223, 240], contacts: 290, lineHeight: 22 }
    },
    accent: {
        landscape: { logo: 92, logoY: 46, center: false, name: [128], nameSize: 32, role: [154], contacts: 190, lineHeight: 18 },
        portrait: { logo: 78, logoY: 76, center: false, name: [152, 185], nameSize: 27, role: [216, 233], contacts: 284, lineHeight: 22 }
    }
};
const requestedLayout = new URLSearchParams(globalThis.__cardPreset ?? location.search).get('layout');
export const currentLayout = Object.hasOwn(LAYOUTS, requestedLayout) ? requestedLayout : (direction.layout || 'classic');

// Card text. The demo stand may override any field; the rest comes from data.js.
// Two balanced lines, split between words.
function splitTwo(value) {
    const words = value.split(/\s+/);
    let best = [value], score = Infinity;
    for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
        if (Math.abs(a.length - b.length) < score) { score = Math.abs(a.length - b.length); best = [a, b]; }
    }
    return best;
}

function cardContent(lang) {
    const base = cards[lang];
    const edit = (globalThis.__cardLab && globalThis.__cardLab.text) || {};
    const role = (edit[`role_${lang}`] || '').trim();
    const login = (edit.email || '').trim() || 'sbmaxx@yandex-team.ru';
    const telegram = ((edit.telegram || '').trim() || 'sbmaxx').replace(/^(https?:\/\/)?t\.me\//, '').replace(/^@/, '');
    return {
        name: (edit[`name_${lang}`] || '').trim() || base.name,
        position: role || base.position,
        positionLines: role ? null : base.positionLines,
        email: login.includes('@') ? login : `${login}@yandex-team.ru`,
        telegram,
        companyUrl: base.companyUrl
    };
}

function textureCanvas(lang, vertical, logo, maxSize, compact = false) {
    const plan = LAYOUTS[currentLayout][vertical ? 'portrait' : 'landscape'];
    const width = vertical ? 300 : 545, height = vertical ? (compact ? 460 : portraitHeight) : 300;
    const data = cardContent(lang);
    const canvas = document.createElement('canvas');
    const textureSize = length => Math.min(maxSize, 2 ** Math.ceil(Math.log2(length * 2.5)));
    canvas.width = textureSize(width);
    canvas.height = textureSize(height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.scale(canvas.width / width, canvas.height / height);
    context.clearRect(0, 0, width, height);
    const links = [];
    const x = vertical ? 34 : 56;
    context.textAlign = 'left';
    context.fillStyle = '#fff';
    const logoWidth = plan.logo;
    const viewBox = logos[lang].viewBox.split(' ').map(Number);
    const logoHeight = logoWidth * viewBox[3] / viewBox[2];
    const logoX = plan.center ? (width - logoWidth) / 2 : x;
    const logoY = plan.logoY;
    const textSize = vertical ? 12.5 : 13;
    // Name and role stay on one line whenever they fit the plate; only a line
    // that does not fit is split in two, and everything below moves with it.
    const maxWidth = vertical ? width - x - 26 : 440;
    const fits = (value, size, weight) => {
        context.font = `${weight} ${size}px "Card Onest", Arial, sans-serif`;
        return context.measureText(value).width <= maxWidth;
    };
    const nameLines = fits(data.name, plan.nameSize, 500) ? [data.name] : splitTwo(data.name);
    const roleLines = fits(data.position, textSize, 400) ? [data.position] : (data.positionLines || splitTwo(data.position));
    // Plans are drawn for two-line portrait and one-line landscape blocks.
    const nameGap = plan.name.length > 1 ? plan.name[1] - plan.name[0] : Math.round(plan.nameSize * 1.22);
    const roleGap = plan.role.length > 1 ? plan.role[1] - plan.role[0] : 17;
    const nameShift = (nameLines.length - plan.name.length) * nameGap;
    const roleShift = nameShift + (roleLines.length - plan.role.length) * roleGap;
    const contactsY = plan.contacts + roleShift;
    const finalBaseline = contactsY + plan.lineHeight;
    context.font = `400 ${textSize}px "Card Onest", Arial, sans-serif`;
    const finalMetrics = context.measureText(`t.me/${data.telegram}`);
    const blockTop = logoY;
    const blockBottom = finalBaseline + finalMetrics.actualBoundingBoxDescent;
    const yOffset = (height - blockTop - blockBottom) / 2;
    function text(value, y, size, url, weight = 400) {
        y += yOffset;
        context.font = `${weight} ${size}px "Card Onest", Arial, sans-serif`;
        const metrics = context.measureText(value);
        const drawX = x + metrics.actualBoundingBoxLeft;
        context.fillText(value, drawX, y);
        if (url) {
            const left = drawX - metrics.actualBoundingBoxLeft;
            const measure = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
            links.push({ x: left, y: y - size, width: measure, height: size + 7,
                underlineY: y + Math.max(0, metrics.actualBoundingBoxDescent) + 2, url });
        }
        return [(drawX - metrics.actualBoundingBoxLeft - 2) / width,
            (y - metrics.actualBoundingBoxAscent - 2) / height,
            (drawX + metrics.actualBoundingBoxRight + 2) / width,
            (y + metrics.actualBoundingBoxDescent + 2) / height];
    }
    context.drawImage(logo, logoX, logoY + yOffset, logoWidth, logoHeight);
    links.push({ x: logoX, y: logoY + yOffset, width: logoWidth, height: logoHeight, url: data.companyUrl });
    const titleRects = nameLines.map((line, i) => text(line, plan.name[0] + i * nameGap, plan.nameSize, undefined, 500));
    const titleRelief = [Math.min(...titleRects.map(r => r[0])), Math.min(...titleRects.map(r => r[1])),
        Math.max(...titleRects.map(r => r[2])), Math.max(...titleRects.map(r => r[3]))];
    const logoRelief = [(logoX - 2) / width, (logoY + yOffset - 2) / height,
        (logoX + logoWidth + 2) / width, (logoY + yOffset + logoHeight + 2) / height];
    const bodyRects = roleLines.map((line, i) => text(line, plan.role[0] + nameShift + i * roleGap, textSize));
    const y = contactsY;
    const size = textSize, lineHeight = plan.lineHeight;
    bodyRects.push(text(data.email, y, size, `mailto:${data.email}`));
    bodyRects.push(text(`t.me/${data.telegram}`, y + lineHeight, size, `https://t.me/${data.telegram}`));
    const textRelief = [Math.min(...bodyRects.map(r => r[0])), Math.min(...bodyRects.map(r => r[1])),
        Math.max(...bodyRects.map(r => r[2])), Math.max(...bodyRects.map(r => r[3]))];
    return { canvas, links, width, height, titleRelief, logoRelief, textRelief, logoScale: logoWidth / 145 };
}

const ease = t => t * t * (3 - 2 * t);
const easeOutCubic = t => 1 - (1 - t) ** 3;
const easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
// Flip: accelerate, pass the target by a few degrees, settle — the plate has mass.
function flipCurve(t) {
    if (t < .78) return easeInOutCubic(t / .78) * 1.035;
    const k = (t - .78) / .22;
    return 1 + .035 * Math.cos(k * Math.PI / 2) ** 2 * (1 - k * .3) * (1 - ease(k));
}

export class CardRenderer {
    static async create(canvas) {
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
        if (!gl) throw new Error('WebGL 2 unavailable');
        // Let the loader reach the screen before compilation and warm-up start.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        performance.mark('card:create');
        const [images, programs] = await Promise.all([
            Promise.all([logoImage('ru'), logoImage('en')]),
            compilePrograms(gl, [[vertexSource, fragmentSource], [screenVertex, blurFragment], [screenVertex, compositeFragment],
                [shadowVertex, shadowFragment], [screenVertex, backdropFragment], [screenVertex, patternFragment]])
                .then(result => { performance.mark('card:compiled'); return result; }),
            Promise.all([document.fonts.load('400 12px "Card Onest"'), document.fonts.load('500 20px "Card Onest"')]).catch(() => {})
        ]);
        const renderer = new CardRenderer(canvas, gl, images, programs);
        renderer.resize();
        renderer.warmUp();
        await renderer.settle();
        // A deliberate pause: the loader holds for a moment even on fast devices,
        // then hands over to the intro.
        const hold = 1400 - performance.now();
        if (hold > 0) await new Promise(resolve => setTimeout(resolve, hold));
        performance.mark('card:ready');
        return renderer;
    }

    constructor(canvas, gl, images, programs) {
        this.canvas = canvas;
        this.gl = gl;
        this.halfThickness = HALF_THICKNESS;
        this.images = images;
        [this.program, this.blurProgram, this.compositeProgram, this.shadowProgram, this.backdropProgram, this.patternProgram] = programs;
        if (globalThis.__cardLab) globalThis.__cardRenderer = this;
        const locate = (program, names) => Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
        this.shadowUniforms = locate(this.shadowProgram, ['uModel', 'uProjection', 'uLight']);
        this.backdropUniforms = locate(this.backdropProgram, ['uShadow', 'uPattern', 'uResolution', 'uPool', 'uWall', 'uFloor', 'uPoolColor',
            'uAccent', 'uKeyDirection', 'uKind', 'uGrain', 'uShadowStrength', 'uShadowFade', 'uFocal', 'uFloorY', 'uCardCenter', 'uEdgeFade', 'uEdgeTop', 'uEdgeBottom']);
        this.patternUniforms = locate(this.patternProgram, ['uKind', 'uAspect']);
        this.pattern = null;
        this.attributes = Object.fromEntries(['aPosition', 'aNormal', 'aUV'].map(name => [name, gl.getAttribLocation(this.program, name)]));
        this.lightSignature = null;
        this.uniforms = Object.fromEntries(['uModel', 'uProjection', 'uEdge', 'uTexture', 'uEngraving', 'uUVBasis', 'uLayoutSize',
            'uLogoRect', 'uTitleRect', 'uTextRect', 'uHoverRect', 'uFocusRect', 'uRoom', 'uExposure', 'uOpacity', 'uBloomPass', 'uLogoScale', 'uBrushCenter', 'uKeyDirection', 'uKeyGain', 'uRoundLights', 'uKeyRight', 'uKeyUp', 'uKeySize', 'uKeyRadius', 'uKeySoft', 'uKeyCenter', 'uKeyColor', 'uLightCount', 'uLightCenter', 'uLightRight', 'uLightUp', 'uLightShape', 'uLightColor', 'uRoomBase', 'uBounce', 'uRaisedHeight', 'uMirror', 'uFloorY', 'uLogoTint', 'uLogoFirstTint', 'uBodyTint', 'uNameTint', 'uTintFinish', 'uTextMute']
            .map(name => [name, gl.getUniformLocation(this.program, name)]));
        this.blurUniforms = { source: gl.getUniformLocation(this.blurProgram, 'uSource'), step: gl.getUniformLocation(this.blurProgram, 'uStep') };
        this.compositeUniforms = { near: gl.getUniformLocation(this.compositeProgram, 'uNear'),
            wide: gl.getUniformLocation(this.compositeProgram, 'uWide'), strength: gl.getUniformLocation(this.compositeProgram, 'uStrength') };
        this.screenArray = gl.createVertexArray();
        this.buffers = [];
        this.arrays = [];
        this.textures = [];
        this.engravingTextures = [];
        this.targets = [];
        this.vertical = null;
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        this.zoom = 1;
        this.zoomVelocity = 0;
        this.flipAngle = 0;
        this.flipFrom = 0;
        this.flipTarget = 0;
        this.flipProgress = 1;
        this.lift = 0;
        this.restPose = [variation.poseX, variation.poseY, variation.poseZ];
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityZ = 0;
        this.time = 0;
        this.keyLight = [-3, 4, 6];
        this.idleWeight = 0;
        this.ambientOpacity = .62;
        this.hoverPointer = null;
        this.hoveredLink = null;
        this.wantsHighFrameRate = false;
        // Intro choreography: the plate turns in from the dark while a light sweeps across.
        this.intro = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0;
        this.introTime = 0;
        this.setupMotion();
        this.anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
    }

    // Phone orientation: the room stays put while the phone turns, exactly as a
    // real metal card in the hand. The baseline slowly follows the hold angle.
    setupMotion() {
        this.gyro = { active: false, beta: 0, gamma: 0, baseBeta: null, baseGamma: 0, x: 0, y: 0, last: 0, lastMove: 0 };
        if (typeof DeviceOrientationEvent === 'undefined' || !matchMedia('(pointer: coarse)').matches) return;
        this.onOrientation = event => {
            if (event.beta == null || event.gamma == null) return;
            const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
            let beta = event.beta, gamma = event.gamma;
            if (angle === 90) [beta, gamma] = [-gamma, beta];
            else if (angle === -90 || angle === 270) [beta, gamma] = [gamma, -beta];
            else if (angle === 180) [beta, gamma] = [-beta, -gamma];
            const g = this.gyro;
            // Sensors report continuously; only real movement asks for 60 fps.
            if (Math.abs(beta - g.beta) + Math.abs(gamma - g.gamma) > .08) g.lastMove = performance.now();
            g.beta = beta; g.gamma = gamma; g.last = performance.now();
            if (g.baseBeta === null) { g.baseBeta = beta; g.baseGamma = gamma; }
            g.active = true;
        };
        const listen = () => window.addEventListener('deviceorientation', this.onOrientation);
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS asks once, from inside a user gesture.
            this.requestMotion = () => {
                window.removeEventListener('touchend', this.requestMotion);
                DeviceOrientationEvent.requestPermission().then(state => { if (state === 'granted') listen(); }).catch(() => {});
            };
            window.addEventListener('touchend', this.requestMotion);
        } else listen();
    }

    // Drivers finish shader and pipeline work lazily, on first use. Draw the full
    // pipeline for both faces while the canvas is still hidden, then wait for
    // the GPU, so the intro starts on warm, full-rate frames.
    warmUp() {
        const gl = this.gl;
        for (const flipped of [false, true]) {
            this.draw({ rx: 0, ry: 0, rz: 0, zoom: 1, flipped, animate: false, reduced: true, delta: 1 / 60 });
        }
        this.flipAngle = this.flipFrom = this.flipTarget = 0;
        this.flipProgress = 1;
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        performance.mark('card:warm');
    }

    // Keep rendering hidden frames until their cost stops falling: drivers finish
    // deferred compilation, the GPU clocks up and uploads complete. Only then is
    // the scene shown and the intro clock started. The loader covers this time.
    async settle(minimum = 1000, limit = 4000) {
        const gl = this.gl, probe = new Uint8Array(4), intervals = [];
        const start = performance.now();
        let previous = start, frames = 0;
        const median = values => [...values].sort((a, b) => a - b)[values.length >> 1];
        while (performance.now() - start < limit) {
            const now = await new Promise(resolve => requestAnimationFrame(resolve));
            intervals.push(now - previous);
            previous = now;
            // Both faces early on, so every pipeline state has been used.
            const flipped = frames % 2 === 1 && frames < 6;
            this.draw({ rx: 0, ry: 0, rz: 0, zoom: 1, flipped, animate: false, reduced: true, delta: 1 / 60 });
            // The first frames wait for the GPU so deferred work cannot hide.
            if (frames < 3) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe);
            frames++;
            if (now - start < minimum || intervals.length < 16) continue;
            // Steady: the last frames arrive at the best cadence seen so far.
            const recent = intervals.slice(-12);
            const best = Math.min(...intervals.slice(3));
            if (median(recent) <= best * 1.2 + 1 && Math.max(...recent) <= median(recent) * 1.5 + 2) break;
        }
        this.flipAngle = this.flipFrom = this.flipTarget = 0;
        this.flipProgress = 1;
        const recent = intervals.slice(-12);
        this.settleStats = { frames, total: performance.now() - start, interval: median(recent), first: intervals[1] || 0, last: median(recent) };
    }

    resize() {
        const gl = this.gl;
        // Layout size, not the transformed screen rect: a CSS transform on the
        // scene (the lab's mobile sheet) must not change the render resolution.
        const rect = { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width; this.canvas.height = height;
        }
        this.aspect = width / height;
        this.viewportWidth = Math.max(1, rect.width);
        this.viewportHeight = Math.max(1, rect.height);
        const touchLandscape = matchMedia('(pointer: coarse) and (orientation: landscape)').matches;
        const vertical = innerWidth <= 700 && !touchLandscape;
        const compact = vertical && Math.max(screen.width, screen.height) < 740;
        this.touchLandscape = touchLandscape;
        if (vertical !== this.vertical || compact !== this.compact) this.rebuild(vertical, compact);
        this.fixedCardWidth = matchMedia('(pointer: coarse)').matches ? 0 : vertical ? 360 : 684;
        const focalLength = this.fixedCardWidth
            ? 14 * this.fixedCardWidth / (this.width * this.viewportHeight) : undefined;
        this.projection = projectionMatrix(this.aspect, focalLength);
        this.resizeTargets(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)));
    }

    // Bloom chain: card highlights at 1/4, blurred there and again at 1/8.
    resizeTargets(width, height) {
        const gl = this.gl;
        if (this.targets.length && this.targets[0].width === width && this.targets[0].height === height) return;
        this.deleteTargets();
        const make = (w, h, depth) => {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            const framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            let renderbuffer = null;
            if (depth) {
                renderbuffer = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            return { texture, framebuffer, renderbuffer, width: w, height: h };
        };
        const w8 = Math.max(1, Math.round(width / 2)), h8 = Math.max(1, Math.round(height / 2));
        // Shadow at 1/4 as well: at 1/8 its bilinear upscale showed steps.
        this.targets = [make(width, height, true), make(width, height), make(w8, h8), make(w8, h8), make(width, height), make(width, height)];
    }

    // Safari paints the status bar and the area under its toolbars with the page
    // colour. Read the rendered frame's top and bottom edge and continue them.
    // Safari (iOS 26) paints its status bar and toolbar areas with a flat colour
    // sampled from fixed elements at the screen edges, never from canvas pixels.
    // On touch screens the backdrop melts into flat colours read from itself
    // just inside the fade; the same colours go to the page, the scene and thin
    // fixed edge strips, so the scene continues into Safari's bars.
    // Setup lamps as uniform arrays; re-sent only when the setup or key changes.
    uploadLights(setup, keyShape, keyGain) {
        const { gl } = this, u = this.uniforms;
        const signature = `${setup.title}|${keyShape.title}|${keyGain}`;
        if (this.lightSignature === signature) return;
        this.lightSignature = signature;
        const key = panel(setup.key.c, keyShape.roll, keyShape.size, [0, 0, 0]);
        gl.uniform3f(u.uKeyCenter, ...key.c);
        gl.uniform3f(u.uKeyRight, ...key.right);
        gl.uniform3f(u.uKeyUp, ...key.up);
        gl.uniform3fv(u.uKeyColor, scale(toneOf(setup.key.color), setup.key.power));
        const count = Math.min(MAX_LIGHTS, setup.lights.length);
        const pack = read => new Float32Array(setup.lights.slice(0, count).flatMap(read));
        gl.uniform1i(u.uLightCount, count);
        gl.uniform3fv(u.uLightCenter, pack((_, i) => setup.lamps[i].c));
        gl.uniform3fv(u.uLightRight, pack((_, i) => setup.lamps[i].right));
        gl.uniform3fv(u.uLightUp, pack((_, i) => setup.lamps[i].up));
        gl.uniform3fv(u.uLightShape, pack(light => [...light.size, light.shape === 'rect' ? 0 : -1]));
        gl.uniform3fv(u.uLightColor, pack(light => scale(toneOf(light.color), light.power * (light.wrap ? keyGain : 1))));
    }

    sampleEdges(backdrop, light) {
        if (!matchMedia('(pointer: coarse)').matches) { this.edges = null; return; }
        // The page colour is fixed per backdrop, size and light setup: Safari takes
        // the bar tint once and does not follow later changes, so it must not
        // move with the light, the intro or the phone's tilt.
        const key = `${backdrop.title}:${this.lightSetup ? this.lightSetup.title : ''}:${this.canvas.width}x${this.canvas.height}`;
        if (key === this.edgeKey) return;
        this.edgeKey = key;
        // Flat bands of 14% / 16% of the height, each with a 20% ramp into the core.
        const fade = [.14, .16, .20, .20];
        const gl = this.gl, u = this.backdropUniforms, width = this.canvas.width, height = this.canvas.height;
        // A throwaway frame of the bare backdrop with the light at rest.
        light(this.lightSetup ? this.lightSetup.shadowDirection : this.keyDirection);
        gl.uniform4f(u.uEdgeFade, 0, 0, 0, 0);
        gl.uniform1f(u.uShadowFade, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const row = new Uint8Array(width * 4);
        // Average a whole row where the ramp starts, i.e. where the core ends.
        const read = y => {
            gl.readPixels(0, Math.round(y), width, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
            const sum = [0, 0, 0];
            for (let i = 0; i < row.length; i += 4) { sum[0] += row[i]; sum[1] += row[i + 1]; sum[2] += row[i + 2]; }
            return sum.map(value => value / width);
        };
        // One colour for both edges: whatever Safari samples for either bar —
        // the page, the scene or an edge strip — it gets the same colour, and the
        // scene ramps into exactly that colour at the top and at the bottom.
        const top = read(height * (1 - fade[0] - fade[2]) - 1), bottom = read(height * (fade[1] + fade[3]));
        const edge = top.map((value, i) => Math.round((value + bottom[i]) / 2));
        this.edges = { fade, top: edge.map(v => v / 255), bottom: edge.map(v => v / 255) };
        if (edge.join() === this.edgeCss) return;
        this.edgeCss = edge.join();
        const color = `rgb(${edge.join(',')})`;
        const root = document.documentElement;
        root.style.backgroundColor = color;
        document.body.style.backgroundColor = color;
        const scene = document.querySelector('.scene');
        if (scene) scene.style.backgroundColor = color;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = color;
        for (const side of ['top', 'bottom']) {
            let strip = document.querySelector(`.safe-edge-${side}`);
            if (!strip) {
                strip = Object.assign(document.createElement('div'), { className: `safe-edge safe-edge-${side}` });
                strip.setAttribute('aria-hidden', 'true');
                document.body.prepend(strip);
            }
            strip.style.backgroundColor = color;
        }
    }

    matchSafeAreas(backdrop) {
        document.documentElement.classList.toggle('webgl-backdrop', Boolean(backdrop));
    }

    // Backdrop surface pattern: baked once per kind and canvas size.
    bakePattern(kind) {
        const gl = this.gl;
        const width = this.canvas.width, height = this.canvas.height;
        if (this.pattern && this.pattern.kind === kind && this.pattern.width === width && this.pattern.height === height) return;
        if (this.pattern) { gl.deleteTexture(this.pattern.texture); gl.deleteFramebuffer(this.pattern.framebuffer); }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
            [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, key, value);
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, width, height);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.useProgram(this.patternProgram);
        gl.bindVertexArray(this.screenArray);
        gl.uniform1f(this.patternUniforms.uKind, kind);
        gl.uniform1f(this.patternUniforms.uAspect, width / height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        this.pattern = { kind, width, height, texture, framebuffer };
    }

    deleteTargets() {
        const gl = this.gl;
        this.targets.forEach(target => {
            gl.deleteTexture(target.texture);
            gl.deleteFramebuffer(target.framebuffer);
            if (target.renderbuffer) gl.deleteRenderbuffer(target.renderbuffer);
        });
        this.targets = [];
    }

    rebuild(vertical, compact = false) {
        const gl = this.gl;
        this.buffers.forEach(buffer => gl.deleteBuffer(buffer));
        this.arrays.forEach(array => gl.deleteVertexArray(array));
        this.textures.forEach(texture => gl.deleteTexture(texture));
        this.engravingTextures.forEach(texture => gl.deleteTexture(texture));
        this.vertical = vertical;
        this.compact = compact;
        const layoutHeight = compact ? 460 : portraitHeight;
        this.width = vertical ? 4.235 * 300 / layoutHeight : 4.235;
        this.height = vertical ? 4.235 : 2.333;
        this.outline = roundedOutline(this.width, this.height, vertical);
        const meshes = geometry(this.width, this.height, vertical);
        this.counts = meshes.map(mesh => mesh.length / 8);
        this.buffers = [];
        this.arrays = meshes.map(mesh => {
            const array = gl.createVertexArray();
            gl.bindVertexArray(array);
            const buffer = gl.createBuffer();
            this.buffers.push(buffer);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
            for (const [name, size, offset] of [['aPosition', 3, 0], ['aNormal', 3, 12], ['aUV', 2, 24]]) {
                gl.enableVertexAttribArray(this.attributes[name]);
                gl.vertexAttribPointer(this.attributes[name], size, gl.FLOAT, false, 32, offset);
            }
            return array;
        });
        gl.bindVertexArray(null);
        const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this.surfaces = ['ru', 'en'].map((lang, i) => textureCanvas(lang, vertical, this.images[i], maxSize, compact));
        const upload = (source, width, height) => {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            if (width) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
            else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            if (this.anisotropy) gl.texParameterf(gl.TEXTURE_2D, this.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
                Math.min(8, gl.getParameter(this.anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
            return texture;
        };
        this.textures = this.surfaces.map(({ canvas }) => upload(canvas));
        this.upload = upload;
        this.buildRelief();
    }

    // Card text changed on the demo stand: redraw textures, relief and links.
    refreshText() {
        this.rebuild(this.vertical, this.compact);
    }

    // Relief maps only; the demo stand calls this when a depth slider moves.
    buildRelief() {
        const gl = this.gl;
        this.engravingTextures.forEach(texture => gl.deleteTexture(texture));
        const profiles = reliefProfiles();
        this.raisedHeight = [profiles.name.shape === 'raised' ? profiles.name.depth : 0,
            profiles.logo.shape === 'raised' ? profiles.logo.depth : 0,
            profiles.text && profiles.text.shape === 'raised' ? profiles.text.depth : 0];
        this.engravingTextures = this.surfaces.map(surface => {
            const relief = createReliefMap(surface, profiles);
            return this.upload(relief.data, relief.width, relief.height);
        });
    }

    draw({ rx, ry, rz = 0, zoom, dragging = false, flipped, animate, idle = true, freezeTilt = false, freezeHover = false, focusLink = null, reduced, delta }) {
        const gl = this.gl;
        const dt = Math.min(delta, 0.05);
        if (animate) this.time += dt;
        if (animate && this.intro < 1) {
            this.introTime += dt;
            this.intro = Math.min(1, this.introTime / 3.2);
        }
        const introPose = 1 - easeOutCubic(clamp01(this.introTime / 2.4));
        const introLight = 1 - easeInOutCubic(this.intro);
        const introFade = this.intro >= 1 ? 1 : ease(clamp01(this.introTime / .9));
        // The shadow arrives once the plate has nearly settled, as if the light
        // found it; during the turn-in its projection would only distract.
        const shadowFade = this.intro >= 1 ? 1 : ease(clamp01((this.introTime - .9) / 1.3));

        // Phone orientation, relative to a slowly re-centering baseline.
        const g = this.gyro;
        let gyroX = 0, gyroY = 0;
        if (g.active && !reduced) {
            // Slow re-centring: a deliberate tilt stays visible, a new hold angle
            // becomes neutral over ~10 s.
            const recenter = 1 - Math.exp(-dt / 10);
            g.baseBeta += (g.beta - g.baseBeta) * recenter;
            g.baseGamma += (g.gamma - g.baseGamma) * recenter;
            const target = [Math.max(-25, Math.min(25, g.beta - g.baseBeta)), Math.max(-25, Math.min(25, g.gamma - g.baseGamma))];
            const smooth = 1 - Math.exp(-dt * 12);
            g.x += (target[0] * Math.PI / 180 - g.x) * smooth;
            g.y += (target[1] * Math.PI / 180 - g.y) * smooth;
            gyroX = g.x; gyroY = g.y;
        }
        // Demo stand overrides (only present on /variants/lab/).
        const lab = globalThis.__cardLab;
        const gyroGain = lab ? lab.gyro : 1;
        gyroX *= gyroGain; gyroY *= gyroGain;
        this.wantsHighFrameRate = Boolean(lab && !lab.exported) || (this.intro < 1 && !reduced) || (g.active && performance.now() - g.lastMove < 600);

        const lightPhase = this.time * Math.PI * 2 / variation.lightPeriod + variation.lightPhase;
        let lightYaw = Math.sin(lightPhase) * .20 * variation.lightTravel + introLight * 1.15;
        let lightPitch = Math.sin(lightPhase * .8 + .7) * .08 - introLight * .12;
        if (lab && lab.manualLight) { lightYaw = lab.yaw; lightPitch = lab.pitch; }
        // The room turns with the light path and against the phone, so reflections
        // slide across the plate just like a physical card turned under lamps.
        // Phone top away → the screen faces the ceiling; right side down → faces right.
        // A real card turned by θ moves its reflections by 2θ; the card on screen
        // also leans a little the same way, which adds to the effect.
        const roomYaw = lightYaw + gyroY * 1.8, roomPitch = lightPitch - gyroX * 1.8;
        this.room = roomMatrix(roomYaw, roomPitch);
        // Shadow and background follow the key: world key = roomᵀ · key.
        const setup = LIGHT_SETUPS[lab ? lab.lightSetup : direction.lightSetup] || LIGHT_SETUPS.studio;
        this.lightSetup = setup;
        const r = this.room, k = setup.shadowDirection;
        const keyWorld = [r[0] * k[0] + r[1] * k[1] + r[2] * k[2], r[3] * k[0] + r[4] * k[1] + r[5] * k[2], r[6] * k[0] + r[7] * k[1] + r[8] * k[2]];
        this.keyLight = keyWorld.map(value => value * 8);
        this.keyDirection = keyWorld;

        const idleTarget = animate && idle && !dragging ? 1 : 0;
        if (reduced) this.idleWeight = 0;
        else if (!freezeTilt) this.idleWeight += (idleTarget - this.idleWeight) * (1 - Math.exp(-dt * (idleTarget ? 1.6 : 10)));
        const idleTime = this.time * variation.idleSpeed;
        const idleStrength = variation.idleAmplitude * this.idleWeight * (this.touchLandscape ? .60 : this.vertical ? .85 : 1)
            * (g.active ? .45 : 1) * (lab ? lab.idle : 1);
        const breathX = (Math.sin(idleTime * .56 + variation.phaseX) * .10
            + Math.sin(idleTime * .89 + variation.phaseY) * .022) * idleStrength;
        const breathY = (Math.cos(idleTime * .43 + variation.phaseY) * .145
            + Math.sin(idleTime * .71 + variation.phaseX + .9) * .025) * idleStrength;
        const nextFlip = flipped ? Math.PI : 0;
        if (nextFlip !== this.flipTarget) {
            this.flipFrom = this.flipAngle;
            this.flipTarget = nextFlip;
            this.flipProgress = 0;
        }
        this.flipProgress = reduced ? 1 : Math.min(1, this.flipProgress + dt / 1.5);
        const progress = this.flipProgress;
        this.flipAngle = progress >= 1 ? this.flipTarget : this.flipFrom + (this.flipTarget - this.flipFrom) * flipCurve(progress);
        // The plate comes toward the viewer while it turns over.
        const flipDepth = progress >= 1 ? 0 : Math.sin(Math.PI * Math.min(1, progress / .85)) * .45;
        const targetX = variation.poseX + (reduced ? 0 : rx * Math.PI / 180 + breathX + gyroX * .2);
        const targetY = variation.poseY + (reduced ? 0 : ry * Math.PI / 180 + breathY + gyroY * .2);
        const targetZ = variation.poseZ + (reduced ? 0 : rz * Math.PI / 180 + Math.sin(idleTime * .36 + variation.phaseZ) * .025 * idleStrength);
        const blend = reduced ? 1 : 1 - Math.exp(-dt * 3);
        if (reduced) {
            this.rotationX = targetX; this.rotationY = targetY; this.rotationZ = targetZ;
            this.velocityX = this.velocityY = this.velocityZ = 0;
        } else if (!freezeTilt) {
            const response = dragging ? 16 : 8;
            [this.rotationX, this.velocityX] = follow(this.rotationX, this.velocityX, targetX, response, dt);
            [this.rotationY, this.velocityY] = follow(this.rotationY, this.velocityY, targetY, response, dt);
            [this.rotationZ, this.velocityZ] = follow(this.rotationZ, this.velocityZ, targetZ, response, dt);
        } else {
            this.velocityX = this.velocityY = this.velocityZ = 0;
        }
        if (!freezeTilt || reduced) {
            const targetLift = Math.sin(idleTime * .55 + variation.floatPhase) * .06 * idleStrength;
            this.lift += (targetLift - this.lift) * blend;
        }
        const pixelsPerUnit = this.viewportHeight * this.projection[5] / 14;
        const fit = this.fixedCardWidth
            ? Math.min(1, Math.max(1, this.viewportWidth - (this.vertical ? 56 : 96)) * .9 / (this.width * pixelsPerUnit),
                Math.max(1, this.viewportHeight - 192) * .9 / (this.height * pixelsPerUnit))
            : this.touchLandscape
            ? Math.min((this.viewportWidth - 64) / (this.width * pixelsPerUnit),
                (this.viewportHeight - 108) / (this.height * pixelsPerUnit))
            : this.vertical ? Math.min(1, (this.viewportWidth - 56) / (this.width * pixelsPerUnit))
                : Math.min(1, this.aspect * 1.23) * .81;
        if (reduced) { this.zoom = zoom; this.zoomVelocity = 0; }
        else [this.zoom, this.zoomVelocity] = follow(this.zoom, this.zoomVelocity, zoom, 10, dt);
        const lift = this.lift + (this.touchLandscape ? 24 / pixelsPerUnit : 0) - introPose * .18;
        // The plate turns in from slightly in front, never behind the backdrop.
        const tilt = modelMatrix(this.rotationX + introPose * .22, this.rotationY - introPose * .55,
            this.zoom * fit * (1 - introPose * .06), lift, this.rotationZ + introPose * .04, flipDepth + introPose * .35);
        const flip = modelMatrix(this.vertical ? 0 : this.flipAngle, this.vertical ? this.flipAngle : 0, 1, 0);
        this.model = multiplyMatrices(tilt, flip);
        this.hoveredLink = this.hoverPointer && !dragging && !freezeHover
            ? this.linkAt(this.hoverPointer.x, this.hoverPointer.y) : null;
        this.updateShadow();
        this.shadowGradient[4] *= introFade;
        this.shadowGradient[5] *= introFade;
        this.ambientOpacity = .62 * (1 + Math.sin(lightPhase + .4) * .04) * (.55 + .45 * introFade);
        this.ambientShift = [Math.sin(lightPhase) * 3 - introLight * 6, -Math.sin(lightPhase + .7) * 2];

        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uniforms.uModel, false, this.model);
        gl.uniformMatrix4fv(this.uniforms.uProjection, false, this.projection);
        gl.uniformMatrix3fv(this.uniforms.uRoom, false, this.room);
        gl.uniform1f(this.uniforms.uExposure, look.studio.exposure * (lab ? lab.exposure : 1));
        gl.uniform3f(this.uniforms.uKeyDirection, ...this.keyDirection);
        gl.uniform1f(this.uniforms.uOpacity, introFade);
        let backdrop = BACKDROPS[(lab && lab.backdrop) || defaultBackdrop] || null;
        // The stage needs room below the card for its reflection; portrait has none.
        if (backdrop && backdrop.kind === KIND.stage && this.vertical) backdrop = BACKDROPS.studio;
        this.backdrop = backdrop;
        gl.uniform1f(this.uniforms.uRoomBase, backdrop ? backdrop.roomBase : 0);
        gl.uniform1f(this.uniforms.uBounce, (backdrop ? backdrop.bounce : 1) * setup.bounce);
        const keyShape = KEY_SHAPES[lab ? lab.keyShape : direction.keyShape] || KEY_SHAPES.round;
        gl.uniform1f(this.uniforms.uRoundLights, (lab ? lab.lamps : (direction.lamps || 'round')) === 'capsule' ? 0 : 1);
        const keyGain = (lab ? lab.keyGain : (direction.keyGain ?? .7)) * keyShape.gain;
        gl.uniform1f(this.uniforms.uKeyGain, keyGain);
        this.uploadLights(setup, keyShape, keyGain);
        gl.uniform2f(this.uniforms.uKeySize, ...keyShape.size);
        gl.uniform1f(this.uniforms.uKeyRadius, keyShape.radius);
        gl.uniform1f(this.uniforms.uKeySoft, lab ? lab.keySoft : (direction.keySoft ?? .05));
        gl.uniform3f(this.uniforms.uRaisedHeight, ...this.raisedHeight);
        gl.uniform1f(this.uniforms.uMirror, 0);
        const tintOf = hex => {
            if (!hex) return [0, 0, 0, 0];
            const linear = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
            return [0, 2, 4].map(i => linear(parseInt(hex.slice(i, i + 2), 16) / 255)).concat(1);
        };
        const logoTint = lab ? lab.logoTint : direction.logoTint;
        const firstTint = lab ? lab.logoFirstTint : (direction.logoFirstTint ?? 'same');
        gl.uniform4f(this.uniforms.uLogoTint, ...tintOf(logoTint));
        // `same` follows the rest of the wordmark; '' is bare metal.
        gl.uniform4f(this.uniforms.uLogoFirstTint, ...tintOf(firstTint === 'same' ? logoTint : firstTint));
        gl.uniform4f(this.uniforms.uNameTint, ...tintOf(lab ? lab.nameTint : direction.nameTint));
        gl.uniform4f(this.uniforms.uBodyTint, ...tintOf(lab ? lab.bodyTint : direction.bodyTint));
        const finishes = lab ? lab.finish : (direction.finish || {});
        gl.uniform4f(this.uniforms.uTintFinish, ...['logoFirst', 'logo', 'name', 'body'].map(key => finishes[key] === 'anod' ? 1 : 0));
        gl.uniform1f(this.uniforms.uTextMute, lab ? lab.textMute : (direction.textMute ?? .3));
        // Stage floor just below the card; it scales with the card, like a dolly.
        const cardScale = this.zoom * fit;
        this.floorY = -(this.height / 2 + .42) * cardScale;
        gl.uniform1f(this.uniforms.uFloorY, this.floorY);
        gl.uniform1i(this.uniforms.uTexture, 0);
        gl.uniform1i(this.uniforms.uEngraving, 1);

        // 1. Highlights above white at quarter resolution.
        const [bright, blurA, wideA, wideB, shadowA, shadowB] = this.targets;
        gl.bindFramebuffer(gl.FRAMEBUFFER, bright.framebuffer);
        gl.viewport(0, 0, bright.width, bright.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        this.drawCard(1, focusLink);
        // 2. Separable blur at 1/4, then a wider one at 1/8.
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(this.blurProgram);
        gl.bindVertexArray(this.screenArray);
        gl.uniform1i(this.blurUniforms.source, 0);
        gl.activeTexture(gl.TEXTURE0);
        const pass = (source, target, x, y) => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
            gl.viewport(0, 0, target.width, target.height);
            gl.bindTexture(gl.TEXTURE_2D, source.texture);
            gl.uniform2f(this.blurUniforms.step, x / source.width, y / source.height);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        pass(bright, blurA, 1, 0);
        pass(blurA, bright, 0, 1);
        pass(bright, wideA, 1.5, 0);
        pass(wideA, wideB, 0, 1.5);
        pass(wideB, wideA, 2.5, 0);
        pass(wideA, wideB, 0, 2.5);
        if (backdrop) {
            // 2b. Card silhouette from the key light onto the backdrop, blurred wide.
            gl.bindFramebuffer(gl.FRAMEBUFFER, shadowA.framebuffer);
            gl.viewport(0, 0, shadowA.width, shadowA.height);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.disable(gl.CULL_FACE);
            gl.useProgram(this.shadowProgram);
            gl.uniformMatrix4fv(this.shadowUniforms.uModel, false, this.model);
            gl.uniformMatrix4fv(this.shadowUniforms.uProjection, false, this.projection);
            gl.uniform3f(this.shadowUniforms.uLight, ...this.keyLight);
            gl.bindVertexArray(this.arrays[0]);
            gl.drawArrays(gl.TRIANGLES, 0, this.counts[0]);
            gl.enable(gl.CULL_FACE);
            gl.useProgram(this.blurProgram);
            gl.bindVertexArray(this.screenArray);
            gl.activeTexture(gl.TEXTURE0);
            // Growing radii: each pass smooths the previous one's taps.
            for (const radius of [1, 2.2, 4]) {
                pass(shadowA, shadowB, radius, 0);
                pass(shadowB, shadowA, 0, radius);
            }
        }
        if (backdrop && backdrop.kind !== KIND.plain) this.bakePattern(backdrop.kind);
        // 3. Backdrop, then the card at full resolution with native MSAA.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (backdrop) {
            const u = this.backdropUniforms;
            gl.useProgram(this.backdropProgram);
            gl.bindVertexArray(this.screenArray);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, shadowA.texture);
            gl.uniform1i(u.uShadow, 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.pattern ? this.pattern.texture : shadowA.texture);
            gl.uniform1i(u.uPattern, 1);
            gl.activeTexture(gl.TEXTURE0);
            gl.uniform2f(u.uResolution, this.canvas.width, this.canvas.height);
            gl.uniform1f(u.uKind, backdrop.kind);
            gl.uniform3f(u.uAccent, ...backdrop.accent);
            gl.uniform1f(u.uFocal, this.projection[5]);
            gl.uniform1f(u.uFloorY, this.floorY);
            gl.uniform2f(u.uCardCenter, this.model[12], 0);
            gl.uniform3f(u.uWall, ...backdrop.wall);
            gl.uniform3f(u.uFloor, ...backdrop.floor);
            gl.uniform3f(u.uPoolColor, ...backdrop.pool);
            gl.uniform1f(u.uGrain, backdrop.grain);
            gl.uniform1f(u.uShadowStrength, backdrop.shadow);
            // The pool sits behind the card, offset towards the key light.
            const light = k => {
                gl.uniform2f(u.uPool, .5 + k[0] * .45, .5 + k[1] * .40);
                gl.uniform3f(u.uKeyDirection, ...k);
            };
            this.sampleEdges(backdrop, light);
            const edge = this.edges || { fade: [0, 0, 0, 0], top: [0, 0, 0], bottom: [0, 0, 0] };
            gl.uniform4f(u.uEdgeFade, ...edge.fade);
            gl.uniform3f(u.uEdgeTop, ...edge.top);
            gl.uniform3f(u.uEdgeBottom, ...edge.bottom);
            light(this.keyDirection);
            gl.uniform1f(u.uShadowFade, shadowFade);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(this.program);
        if (backdrop && backdrop.kind === KIND.stage) {
            // The card mirrored in the floor plane, drawn faded over the floor.
            const mirror = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 2 * this.floorY, 0, 1]);
            gl.uniformMatrix4fv(this.uniforms.uModel, false, multiplyMatrices(mirror, this.model));
            gl.uniform1f(this.uniforms.uMirror, 1);
            gl.frontFace(gl.CW);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            this.drawCard(0, null);
            gl.disable(gl.BLEND);
            gl.frontFace(gl.CCW);
            gl.uniform1f(this.uniforms.uMirror, 0);
            gl.uniformMatrix4fv(this.uniforms.uModel, false, this.model);
            gl.clear(gl.DEPTH_BUFFER_BIT);
        }
        this.drawCard(0, focusLink);
        // 4. Glow over the card and the page, screen-blended.
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this.compositeProgram);
        gl.bindVertexArray(this.screenArray);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, bright.texture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, wideB.texture);
        gl.uniform1i(this.compositeUniforms.near, 0);
        gl.uniform1i(this.compositeUniforms.wide, 1);
        gl.uniform1f(this.compositeUniforms.strength, lab ? lab.bloom : .3);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
        gl.activeTexture(gl.TEXTURE0);

        this.matchSafeAreas(backdrop);
        return this.intro < 1 || this.flipProgress < 1 || Math.abs(targetX - this.rotationX) + Math.abs(targetY - this.rotationY)
            + Math.abs(zoom - this.zoom) + Math.abs(this.zoomVelocity)
            + Math.abs(targetZ - this.rotationZ) + Math.abs(this.velocityZ)
            + Math.abs(this.velocityX) + Math.abs(this.velocityY) > .0005;
    }

    drawCard(bloomPass, focusLink) {
        const gl = this.gl;
        gl.uniform1f(this.uniforms.uBloomPass, bloomPass);
        for (let i = 0; i < 3; i++) {
            gl.bindVertexArray(this.arrays[i]);
            const side = i === 1 ? 1 : 0;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures[side]);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.engravingTextures[side]);
            gl.uniform1f(this.uniforms.uEdge, i === 2 ? 1 : 0);
            const surface = this.surfaces[side];
            gl.uniform2f(this.uniforms.uUVBasis, i === 1 && this.vertical ? -1 : 1, i === 1 && !this.vertical ? 1 : -1);
            gl.uniform2f(this.uniforms.uLayoutSize, surface.width, surface.height);
            gl.uniform4f(this.uniforms.uLogoRect, ...surface.logoRelief);
            gl.uniform4f(this.uniforms.uTitleRect, ...surface.titleRelief);
            gl.uniform4f(this.uniforms.uTextRect, ...surface.textRelief);
            gl.uniform1f(this.uniforms.uLogoScale, surface.logoScale);
            // The spun centre sits in empty metal: the arrow of either layout.
            const center = (this.vertical ? plate.centerPortrait : plate.center) || [.5, .5];
            gl.uniform2f(this.uniforms.uBrushCenter, center[0], center[1]);
            const hover = this.hoveredLink;
            if (hover && hover.side === i && hover.underlineY != null) {
                gl.uniform4f(this.uniforms.uHoverRect, hover.x / surface.width, hover.underlineY / surface.height,
                    (hover.x + hover.width) / surface.width, (hover.underlineY + 1) / surface.height);
            } else gl.uniform4f(this.uniforms.uHoverRect, -2, -2, -1, -1);
            if (focusLink && focusLink.side === i) {
                gl.uniform4f(this.uniforms.uFocusRect,
                    focusLink.x / surface.width, focusLink.y / surface.height,
                    (focusLink.x + focusLink.width) / surface.width,
                    (focusLink.y + focusLink.height) / surface.height);
            } else gl.uniform4f(this.uniforms.uFocusRect, -2, -2, -1, -1);
            gl.drawArrays(gl.TRIANGLES, 0, this.counts[i]);
        }
        gl.activeTexture(gl.TEXTURE0);
    }

    updateShadow() {
        const m = this.model;
        const [lx, ly, lz] = this.keyLight;
        const focal = this.projection[5];
        const project = ([x, y]) => {
            const wx = m[0] * x + m[4] * y + m[12];
            const wy = m[1] * x + m[5] * y + m[13];
            const wz = m[2] * x + m[6] * y + m[14];
            const distance = (-0.9 - lz) / (wz - lz);
            const sx = lx + (wx - lx) * distance;
            const sy = ly + (wy - ly) * distance;
            return [(sx * focal / (7.9 * this.aspect) + 1) * this.viewportWidth / 2,
                (1 - sy * focal / 7.9) * this.viewportHeight / 2];
        };
        const points = this.outline.map(project);
        this.shadowPoints = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const heightSlope = Math.hypot(m[2], m[6]);
        const dir = heightSlope > 1e-6 ? [m[2] / heightSlope, m[6] / heightSlope] : [0, 1];
        const axis = [dir[0] * this.width * .45, dir[1] * this.height * .40];
        const near = project(axis.map(value => -value)), far = project(axis);
        const range = Math.abs(m[2]) * this.width + Math.abs(m[6]) * this.height;
        const blend = clamp01((range - .03) / .30);
        const weight = blend * blend * (3 - 2 * blend);
        this.shadowGradient = [near[0], near[1], far[0], far[1], .30 + .12 * weight, .30 - .12 * weight];
        const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
        this.shadowBounds = [Math.min(...xs) - 60, Math.min(...ys) - 60,
            Math.max(...xs) - Math.min(...xs) + 120, Math.max(...ys) - Math.min(...ys) + 120];
    }

    surfacePoint(clientX, clientY) {
        if (!this.model || this.flipProgress < 1) return null;
        const rect = this.canvas.getBoundingClientRect();
        const focal = this.projection[5];
        const ray = [(2 * (clientX - rect.left) / rect.width - 1) * this.aspect / focal, (1 - 2 * (clientY - rect.top) / rect.height) / focal, -1];
        const m = this.model;
        const scale2 = m[0] ** 2 + m[1] ** 2 + m[2] ** 2;
        const inverse = value => [0, 4, 8].map(i => (m[i] * value[0] + m[i + 1] * value[1] + m[i + 2] * value[2]) / scale2);
        const origin = inverse([-m[12], -m[13], 7 - m[14]]);
        const dir = inverse(ray);
        if (Math.abs(dir[2]) < .001) return null;
        const back = origin[2] < 0;
        const faceZ = back ? -HALF_THICKNESS : HALF_THICKNESS;
        const t = (faceZ - origin[2]) / dir[2];
        if (t < 0) return null;
        const px = origin[0] + dir[0] * t, py = origin[1] + dir[1] * t;
        const outline = this.outline;
        for (let i = 0; i < outline.length; i++) {
            const a = outline[i], b = outline[(i + 1) % outline.length];
            if ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]) > .0001) return null;
        }
        let u = px / this.width + .5;
        let v = .5 - py / this.height;
        if (back) { if (this.vertical) u = 1 - u; else v = 1 - v; }
        return { x: px, y: py, back, u, v };
    }

    linkAt(clientX, clientY) {
        const point = this.surfacePoint(clientX, clientY);
        if (!point) return null;
        const surface = this.surfaces[point.back ? 1 : 0];
        const x = point.u * surface.width, y = point.v * surface.height;
        const link = surface.links.find(link => x >= link.x && x <= link.x + link.width && y >= link.y && y <= link.y + link.height);
        return link ? { ...link, side: point.back ? 1 : 0 } : null;
    }

    hitTest(clientX, clientY) {
        return this.linkAt(clientX, clientY)?.url || null;
    }

    destroy() {
        const gl = this.gl;
        if (this.onOrientation) window.removeEventListener('deviceorientation', this.onOrientation);
        if (this.requestMotion) window.removeEventListener('touchend', this.requestMotion);
        this.buffers.forEach(buffer => gl.deleteBuffer(buffer));
        this.arrays.forEach(array => gl.deleteVertexArray(array));
        this.textures.forEach(texture => gl.deleteTexture(texture));
        this.engravingTextures.forEach(texture => gl.deleteTexture(texture));
        this.deleteTargets();
        gl.deleteVertexArray(this.screenArray);
        gl.deleteProgram(this.program);
        gl.deleteProgram(this.blurProgram);
        gl.deleteProgram(this.compositeProgram);
    }
}
