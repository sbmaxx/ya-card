import { cards, logos } from '../data.js';
import { fontOf } from './fonts.js';

// The card's typeface (lab setting or the baked look), and its three weights loaded.
const cardFont = () => fontOf(globalThis.__cardLab?.font ?? 0).family;
export const loadCardFont = () => Promise.all([400, 500, 600].map(weight => document.fonts.load(`${weight} 16px "${cardFont()}"`)));
import { createReliefMaps } from './relief.js';
import { direction } from './directions.js';
import { BACKDROPS, DEFAULT_BACKDROP } from './backdrops.js';
import { LIGHT_SETUPS } from './lights.js';

// Studio renderer for the material editions. WebGL 2, linear HDR shading,
// an analytic studio environment (no textures, no requests), Khronos PBR
// Neutral tone mapping and a quarter-resolution bloom on real highlights.
// Portrait plate: the original card's 320 × 545 (src/Card/Card.css) on a 300 px wide layout.
const HALF_THICKNESS = .026, CHAMFER = .015, portraitHeight = 511;
const look = direction.look;

// Logo relief: a chiselled V, a flat-floored recess or applied raised letters.
// `?relief=vcut|deboss|raised` overrides the edition's choice for comparison.
const LOGO_SHAPES = {
    vcut: { shape: 'vcut', depth: 2.2, bevel: 3.4 },
    deboss: { shape: 'deboss', depth: 1.5, bevel: 1.1 },
    raised: { shape: 'raised', depth: 2.2, bevel: 1.1 }
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
    raised: { shape: 'raised', depth: 1.3, bevel: .7 }
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
    raised: { shape: 'raised', depth: .5, bevel: .35 }
};
const requestedBody = new URLSearchParams(globalThis.__cardPreset ?? location.search).get('body');
const bodyShape = Object.hasOwn(BODY_SHAPES, requestedBody) ? requestedBody : 'edition';
export const currentBodyShape = bodyShape;
const bodyLook = bodyShape === 'edition' ? look.text : look.logo;
const baseProfiles = { logo: LOGO_SHAPES[logoShape], name: NAME_SHAPES[nameShape] || { shape: 'deboss', ...direction.relief.name },
    text: BODY_SHAPES[bodyShape] };
// Depth multipliers from the demo stand; relief maps are rebuilt live.
// Raised letters take the chosen bevel profile (see relief.js): the coin's
// quarter round as it was; a soft one, half as steep over a wider band, with
// no crease at the plate; a flat 45° edge. A steep shoulder mirrors the whole
// room within a pixel or two — floor, horizon, lamps — as parallel lines.
const BEVELS = [{ depth: 1, bevel: 1 }, { depth: .6, bevel: 1.6 }, { depth: 0, bevel: 1 }];
const reliefProfiles = () => {
    const lab = globalThis.__cardLab;
    const curve = lab ? lab.bevel ?? 0 : 0, bevel = BEVELS[curve];
    const scale = (profile, k) => {
        if (profile.shape !== 'raised') return { ...profile, depth: profile.depth * k };
        const width = profile.bevel * bevel.bevel;
        // The 45° edge rises as high as it is wide.
        return { ...profile, curve, bevel: width, depth: (bevel.depth ? profile.depth * bevel.depth : Math.min(profile.depth, width)) * k };
    };
    return { logo: scale(baseProfiles.logo, lab ? lab.logoDepth : 1), name: scale(baseProfiles.name, lab ? lab.nameDepth : 1),
        text: baseProfiles.text && scale(baseProfiles.text, lab ? lab.bodyDepth : 1) };
};
const occlusion = shape => shape === 'vcut' ? '.42' : shape === 'deboss' ? '.55' : null;

const between = (min, max) => min + Math.random() * (max - min);
const variation = {
    poseX: between(-.035, .035), poseY: between(-.045, .045), poseZ: between(-.012, .012),
    phaseX: between(0, Math.PI * 2), phaseY: between(0, Math.PI * 2), phaseZ: between(0, Math.PI * 2),
    floatPhase: between(0, Math.PI * 2), idleSpeed: between(.85, 1.15), idleAmplitude: between(.8, 1.15),
    lightPhase: between(0, Math.PI * 2), lightPeriod: between(16, 22), lightTravel: between(.85, 1.15),
    // The intro's entrance, new on every load: the plate turns in from either
    // side, tipped up or (less often) down, with a little roll, and the light
    // sweeps in from the side it turns towards. Drawn last, so the values
    // above stay the same for a given seed.
    introSide: Math.random() < .5 ? -1 : 1, introTurn: between(.42, .62),
    introTip: between(.10, .26) * (Math.random() < .7 ? 1 : -1), introRoll: between(-.05, .05),
    introDepth: between(.28, .40), introSweep: between(.95, 1.25)
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
// «Световая дорожка»: a long strip light just above the camera, on the diagonal.
// At rest the plate mirrors it right of the text block, top-left to bottom-right
// (the face's reflections run upside down in world y: the centre sits at y 0).
const STRIP = panel([.043, 0, 1], .45, [2.0, .035]);
const STRIP_POWER = 1.0;
// Colour at the same brightness: a tone scaled to unit luminance.
const byLuma = color => { const luma = .2126 * color[0] + .7152 * color[1] + .0722 * color[2]; return color.map(value => value / luma); };
const tinted3 = (color, tint) => color.map((value, i) => value * tint[i]);
// «Температура»: warmer key, cooler fill, at equal brightness.
const warmTint = w => byLuma([1 + .10 * w, 1, 1 - .28 * w]);
const coolTint = w => byLuma([1 - .14 * w, 1, 1 + .18 * w]);
// The plate's face sees lamps near the camera (up to ~50° off axis), fading
// out by ~65°; lamps further out are there for the chamfer. `face: 1` on a
// lamp overrides it (the rim setup lights the face only when tilted).
const faceSees = c => { const t = clamp01((c[2] - .4226) / (.6428 - .4226)); return t * t * (3 - 2 * t); };
const studio = look.studio;
const scale = (color, k) => color.map(value => value * k);
// Lighting setups (lights.js): each lamp's centre, size and colour, made into
// panels below. The key is the travelling softbox; the lab can change its shape.
const MAX_LIGHTS = 12;
// The studio shader's loop counts (uLoopCounts): lettering samples, brushing
// taps, chamfer samples, parallax layers.
const LOOP_COUNTS = new Int32Array([8, 7, 8, 40]);
export { LIGHT_SETUPS };
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
    round: { title: 'Круг', size: [.17, .17], radius: .17, roll: 0 }
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
    // The toe takes the same amount from every channel, which empties the
    // weakest one in deep shadow: dark gold turned brick red. Take it in
    // proportion instead: identical on grey, the hue kept on coloured metal.
    color -= offset * color / max(max(color.r, max(color.g, color.b)), 1e-5);
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
}

// The drawing buffer's colours (lab: «Широкий цвет», «Блики ярче белого»).
// x — the buffer is Display P3; y — how far saturated colours reach into it;
// z — the headroom above white on an HDR buffer (1 — none).
uniform vec3 uOutput;
// Linear sRGB to linear Display P3: the same colour, in the wider primaries.
const mat3 SRGB_TO_P3 = mat3(.8224621, .0331941, .0170827, .1775380, .9668058, .0723974, 0.0, 0.0, .9105199);

vec3 fromSRGB(vec3 c) {
    return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c));
}

// Linear colour after the tone curve to the buffer's encoding. On P3 the
// colour is converted exactly, so greys, steel and the velvet stay as they
// are; saturated colours (the red Я) are then let out towards the wider
// primaries, as their sRGB values read as P3 — a red no sRGB screen shows.
vec3 toDisplay(vec3 c) {
    if (uOutput.x > .5) {
        float peak = max(c.r, max(c.g, c.b));
        float saturation = peak > 1e-5 ? 1.0 - min(c.r, min(c.g, c.b)) / peak : 0.0;
        c = mix(SRGB_TO_P3 * c, c, uOutput.y * smoothstep(.25, .9, saturation));
    }
    // Above white only on an HDR buffer; the sRGB curve extends past 1.
    c = clamp(c, 0.0, uOutput.z);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - .055, step(.0031308, c));
}

// An sRGB-encoded colour (the page's own) to the buffer's encoding.
vec3 displayFromSRGB(vec3 c) {
    return uOutput.x > .5 ? toSRGB(SRGB_TO_P3 * fromSRGB(clamp(c, 0.0, 1.0))) : c;
}`;

// What the browser can put on screen beyond 8-bit sRGB (lab: «Картинка»).
// Display P3 in WebGL: Safari 15.2+, Chrome 104+. Brighter than white: only
// Chrome with Experimental Web Platform features, on an HDR screen.
export function outputSupport() {
    const gl = globalThis.WebGL2RenderingContext?.prototype ?? {};
    return {
        p3: 'drawingBufferColorSpace' in gl,
        hdr: 'drawingBufferStorage' in gl && ('drawingBufferToneMapping' in gl || 'configureHighDynamicRange' in HTMLCanvasElement.prototype),
        p3Screen: matchMedia('(color-gamut: p3)').matches,
        hdrScreen: matchMedia('(dynamic-range: high)').matches
    };
}
const IDENTITY3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const SRGB_TO_P3 = new Float32Array([.8224621, .0331941, .0170827, .1775380, .9668058, .0723974, 0, 0, .9105199]);

// Backdrops (backdrops.js): the room behind the card and the page's own colours.
export { BACKDROPS };
const requestedBackdrop = new URLSearchParams(globalThis.__cardPreset ?? location.search).get('backdrop');
export const defaultBackdrop = Object.hasOwn(BACKDROPS, requestedBackdrop) ? requestedBackdrop : DEFAULT_BACKDROP;

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
// How lit the plate is in the intro (1 after it): it is solid before it is lit.
uniform float uReveal;
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
// The relief map holds a distance (see relief.js); these shape it. Per region
// (x name, y logo, z role and contacts, as uRaisedHeight): the profile's full
// slope, depth over width (the wordmark's scale cancels), and +1 for letters
// that rise, −1 for cuts. uBevelCurve: 0 coin, 1 soft, 2 a 45° edge.
uniform vec3 uReliefSlope;
uniform vec3 uReliefSign;
uniform float uBevelCurve;
// The bevel's width in layout px per region (the wordmark's already scaled).
uniform vec3 uReliefWidth;
// 1 where the region has a relief (its map holds a distance field).
uniform vec3 uReliefHas;
// The stored distance (see relief.js) as the fraction of the bevel's width.
float reliefT(float b) { return clamp(b * 2.0 - 1.0, 0.0, 1.0); }
// A raised profile's height (0 at the outline, 1 on top) at a fraction of its
// width, and its slope there (d height / d fraction).
float bevelHeight(float t) {
    t = clamp(t, 0.0, 1.0);
    return uBevelCurve < .5 ? sin(t * 1.5707963) : uBevelCurve < 1.5 ? t * t * t * (t * (t * 6.0 - 15.0) + 10.0) : t;
}
// edge: how much of the width a screen pixel spans. A profile that ends in a
// kink (the 45° edge, a cut's floor) turns level over at least that much, so
// the line where it meets the top is antialiased like a font's outline instead
// of breaking into steps when the card is magnified.
float bevelSlope(float t, float edge) {
    t = clamp(t, 0.0, 1.0);
    return uBevelCurve < .5 ? 1.5707963 * cos(t * 1.5707963)
        : uBevelCurve < 1.5 ? 30.0 * t * t * (1.0 - t) * (1.0 - t)
        : 1.0 - smoothstep(1.0 - edge, 1.0, t);
}
// Tangent-space slope of the relief from a map texel (see relief.js). region:
// weights of name, wordmark, role and contacts at this point.
vec2 reliefSlopeXY(vec4 r, vec3 region, float pixel) {
    vec2 dir = (r.rg * 255.0 - 128.0) / 127.0;
    float raised = dot(region, step(0.0, uReliefSign));
    float edge = clamp(pixel / max(dot(region, uReliefWidth), 1e-4), .03, 1.0);
    // Height gained per layout px inward: the profile's shape times its full slope.
    float t = reliefT(r.b);
    float g = dot(region, uReliefSlope * uReliefSign) * mix(1.0 - smoothstep(1.0 - edge, 1.0, t), bevelSlope(t, edge), raised);
    return -g * dir / sqrt(1.0 + g * g * dot(dir, dir));
}
uniform vec4 uLogoTint;
uniform vec4 uNameTint;
uniform vec4 uLogoFirstTint;
uniform vec4 uBodyTint;
// Finish per object: x first letter, y wordmark, z name, w role and contacts (1 = anodised).
uniform vec4 uTintFinish;
uniform float uTextMute;
// The wordmark (x) and the name (y) can sit back the same way.
uniform vec2 uMute;
uniform float uLetterGlow;
// Lettering gloss: x logo, y name, z role and contacts (1 — as finished, 0 — matte).
uniform vec3 uGloss;
// Plate finish: 0 brushed, 1 bead-blasted, 2 polished.
uniform float uFinish;
// How strongly the finish shows, its grain or frost (1 — as finished), and the
// sparkle of the bead-blasted one (0 — none).
uniform float uSurface;
uniform float uSparkle;
// Colour density: x first letter, y wordmark, z name, w role and contacts (1 — opaque).
uniform vec4 uTintAmount;
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
// How many times the shader's loops run: x the lettering's samples (8), y the
// brushing's taps (7), z the chamfer's samples (8), w the parallax march's
// layers (40). Always these, but passed in: Windows compiles WebGL through
// Direct3D, whose compiler unrolls any loop whose count it can work out —
// from a constant, or from an expression it can bound — and inlines every
// function into each copy. The studio's shader took 30–42 s to compile on an
// RTX 5080. A loop that runs to a uniform (these, or the setup's lamps) is
// compiled once. Nothing inside a loop may take a derivative (texture(),
// dFdx, fwidth): that would force the unrolling again.
uniform ivec4 uLoopCounts;
uniform vec3 uLightCenter[${MAX_LIGHTS}];
uniform vec3 uLightRight[${MAX_LIGHTS}];
uniform vec3 uLightUp[${MAX_LIGHTS}];
uniform vec3 uLightShape[${MAX_LIGHTS}];
uniform vec3 uLightColor[${MAX_LIGHTS}];
// How much of each lamp the plate's face sees (see roomFor).
uniform float uLightFace[${MAX_LIGHTS}];
// The back light circling the card with the light orbit (edges and lettering only).
uniform vec3 uOrbitCenter, uOrbitRight, uOrbitUp, uOrbitColor;
// The strip light fixed to the view (colour × power; black — off) and the tint
// of the room's fill — tent, bounce, ambient — which «Температура» cools.
uniform vec3 uStrip;
uniform vec3 uFillTint;
const vec3 STRIP_C = ${v3(STRIP.c)}, STRIP_R = ${v3(STRIP.right)}, STRIP_U = ${v3(STRIP.up)};

// The strip light: a long band ~2° wide across the view. The whole face mirrors
// only ~±9° of directions at rest, so the band must be narrower than that, with
// its own soft edge rather than the studio's diffuser, or it covers the plate.
float stripLight(vec3 d, float blur) {
    float z = dot(d, STRIP_C);
    vec2 p = vec2(dot(d, STRIP_R), dot(d, STRIP_U)) / max(z, .08);
    float edge = blur + .02;
    float inside = smoothstep(edge, -edge, abs(p.y) - ${f(STRIP.size[1])}) * smoothstep(edge, -edge, abs(p.x) - ${f(STRIP.size[0])});
    // A rough surface spreads the same light over a wider band.
    return inside * ${f(STRIP.size[1])} / (${f(STRIP.size[1])} + edge) * smoothstep(0.0, .25, z);
}

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

// The room as seen by the chamfer, the side wall and the lettering (face = 0)
// or by the plate's face (face = 1). They differ on purpose, as light linking
// does in a product studio. A hand turn or a phone tilt swings the face's
// reflection up to ~90° from the camera, far past the lights set up for rest.
// So the face lives in a light tent: an even lit surround, a little brighter
// above, that its reflection can only fall to, never through a dark gap, and
// it does not see the lamps placed far out for the chamfer, which would blow
// a turned plate out to white. The rest pose sees the same room either way.
// How much of the orbiting back light the surface being shaded takes: all of
// it on the chamfer; on the lettering only once its bevels are resolved (main).
float orbitSeen = 1.0;

vec3 roomFor(vec3 world, float rough, float face) {
    vec3 d = uRoom * world;
    float blur = .004 + rough * rough * 1.5;
    // Dark floor, dim ceiling and a faint horizon for the side walls.
    vec3 col = mix(vec3(.006, .006, .007), vec3(.045, .047, .052), smoothstep(-.6, .9, d.y));
    col += vec3(.10, .10, .095) * exp(-d.y * d.y * mix(40.0, 5.0, rough)) * smoothstep(.3, -.2, d.z);
    // A soft, even fill from every side: turned far from its lamps (a phone
    // tilted hard, a hand spin) the metal still reads as metal, not a black slab.
    col += vec3(.04) * uFillTint * (.55 + .45 * smoothstep(-1.0, 1.0, d.y));
    // A dim bounce card around the camera. Wide and soft, so a hard phone
    // tilt slides it off gradually instead of leaving the plate facing an
    // unlit room.
    float bounce = panel(d, vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec2(1.35, 1.05), blur + .22, uRoundLights);
    // An even lit wall all around at eye level, a little dimmer than the
    // bounce. Taking the brighter of the two, a turned card's reflection
    // falls from the bounce to the wall and never through a darker gap, so
    // no shadow band runs across the plate at any angle.
    // The tent is brighter on the key's side and a little brighter above: a
    // linear gradient, so a turned plate still shows light running across it,
    // and a linear gradient cannot dip into a band. Mostly across: brushing
    // blurs light along the grain anyway, and a plate tilted to the floor
    // should not go dim.
    float tent = .52 + .14 * d.x * clamp(uKeyCenter.x * 4.0, -1.0, 1.0) + .06 * d.y;
    // The tent surrounds the front of the card; behind it is the graphite
    // backdrop. Turned far over (a hand spin), the near edge of the plate still
    // mirrors the lit studio and the far edge the dark backdrop: a gradient
    // across the plate that reads as a solid metal slab, not flat grey paper.
    tent *= mix(.32, 1.0, smoothstep(-.85, .25, d.z));
    // Behind the card, where only a hand spin sends the face's reflection
    // (a turn or a tilt never reaches past ~95° from the camera): the key's
    // pool of light on the backdrop, and a ring light around it. A spinning
    // plate crosses the ring twice per half turn, so a soft band of light runs
    // over the metal as it turns — what makes a spinning slab read as solid.
    tent += .30 * smoothstep(.45, 1.0, dot(d, vec3(-.33, .14, -.93)));
    tent += 1.1 * (1.0 - smoothstep(.0, .09, abs(-d.z - .82)));
    float wall = mix(.45 * (1.0 - smoothstep(.45, .95, abs(d.y))), tent, face);
    col += vec3(${f(studio.bounce)}) * uFillTint * uBounce * max(bounce, wall);
    // Light walls (the paper backdrop) surround the card with brighter room.
    col += vec3(uRoomBase) * smoothstep(-.9, .3, d.y);
    col += uKeyColor * uKeyGain * keyPanel(d, uKeyCenter, blur);
    // The strip light, fixed to the view rather than travelling with the room:
    // the face mirrors it as a soft band that the least tilt slides across, the
    // sweep of a product shot. On a matt finish it spreads into a broad sheen,
    // on a polished one it stays a band. It only adds light, so it cannot open
    // a darker gap between lamps.
    if (uStrip.g > 0.0) col += uStrip * stripLight(world, blur);
    // The lamps: a loop to a uniform count (see uLoopCounts), since this light
    // is inlined into every material, dozens of times over.
    for (int i = 0; i < uLightCount; i++) {
        vec3 shape = uLightShape[i];
        float seen = mix(1.0, uLightFace[i], face);
        if (seen <= 0.0) continue;
        // A lamp the face sees only in part is also softer to it: spread into a
        // wide glow it fills the gap beside the bounce instead of leaving a band.
        float soften = face * (1.0 - uLightFace[i]) * .6;
        col += uLightColor[i] * seen * panel(d, uLightCenter[i], uLightRight[i], uLightUp[i], shape.xy, blur + soften, shape.z < 0.0 ? uRoundLights : shape.z);
    }
    // The orbiting back light sits square to the view, where the chamfer and
    // the letters' bevels look: a glint that runs around the edge of the card.
    if (face < .5 && uOrbitColor.r > 0.0) col += uOrbitColor * orbitSeen * panel(d, uOrbitCenter, uOrbitRight, uOrbitUp, vec2(.20), blur, 1.0);
    return col;
}

vec3 room(vec3 world, float rough) { return roomFor(world, rough, 0.0); }

vec3 fresnel(vec3 f0, float nv) {
    return f0 + (1.0 - f0) * pow(1.0 - nv, 5.0);
}

// Brushed metal: micro-grooves tilt the normal across the brush direction,
// which stretches every reflection into a streak perpendicular to the grain.
vec3 brushed(vec3 n, vec3 v, vec3 across, float rough, float aniso, float face) {
    // No grain (bead-blasted, polished): all seven would look the same way.
    if (aniso <= 0.0) return roomFor(reflect(-v, n), rough, face);
    vec3 sum = vec3(0.0);
    for (int i = 0; i < uLoopCounts.y; i++) {
        float s = (float(i) - 3.0) / 3.0;
        vec3 ni = normalize(n + across * s * aniso);
        sum += roomFor(reflect(-v, ni), rough, face) * (1.0 - .5 * s * s);
    }
    return sum / 5.4444;
}

vec3 metal(vec3 f0, vec3 n, vec3 v, float rough) {
    float nv = max(dot(n, v), 1e-3);
    return fresnel(f0, nv) * room(reflect(-v, n), rough);
}

// Gloss dielectric (enamel, lacquer): coloured diffuse under a sharp 4% coat.
vec3 gloss(vec3 albedo, vec3 n, vec3 v, float rough);

// A dyed or coated metal's reflectance from the chosen colour. The colour sets
// the hue and how deep it is, but no real metal finish reflects as little as a
// dark sRGB swatch: #111214 taken literally reflects 0.6% and reads as matte
// paint. The darkest real coatings (DLC, black PVD) keep ~7% and stay mirror-like, so the
// luminance is lifted onto that floor — black becomes black PVD, dark grey
// gunmetal — keeping the order of light and dark and the hue.
vec3 metalTint(vec3 c) {
    float l = dot(c, vec3(.2126, .7152, .0722));
    float lifted = mix(.07, 1.0, l);
    vec3 hue = l > 1e-4 ? c / l : vec3(1.0);
    return min(hue * lifted, vec3(1.0));
}

// A clear dielectric coat (lacquer, oxide): an uncoloured Fresnel reflection.
vec3 clearCoat(float f0, vec3 n, vec3 v, float rough) {
    float nv = max(dot(n, v), 1e-3);
    return (f0 + (1.0 - f0) * pow(1.0 - nv, 5.0)) * room(reflect(-v, n), rough);
}

// Colour on a letter: enamel fills the flat faces and leaves polished bevels;
// anodising colours the metal itself, bevels included.
vec3 tinted(vec3 base, vec4 tint, float finish, vec3 n, vec3 facet, vec3 v, float rough, float edge, float shine, vec3 plateLetter, float amount) {
    // The plate's own material: letters pressed out of (or into) the same steel.
    if (tint.a > 1.5) return plateLetter;
    if (tint.a < .5) return base;
    // Anodising: the dye colours the metal (metalTint) under a clear oxide (n ≈ 1.65), which
    // reflects ~6% of the room uncoloured. On dark dyes that coat is all the
    // shine there is — without it a black letter showed no gloss at any «Блеск».
    // «Блеск» sets how sharp both reflections are.
    float anodRough = mix(.55, max(.06, rough), shine);
    // Enamel (finish 0) never shows the anodised metal: not worked out.
    vec3 anod = finish > 0.0 ? metal(metalTint(tint.rgb), facet, v, anodRough) + clearCoat(.06, facet, v, anodRough) : vec3(0.0);
    vec3 full = mix(mix(gloss(tint.rgb * 1.9, n, v, mix(.55, .06, shine)), anod, finish), mix(base, anod, finish), edge);
    // A translucent colour: the plate's brushed steel shows through, tinted.
    if (amount > .999) return full;
    // A dye over steel is smoked steel: the grain and the highlights stay, the
    // metal darkens to the colour's own depth (a dark dye no longer turns
    // translucent letters into bare plate).
    vec3 dyed = plateLetter * mix(vec3(1.0), min(metalTint(tint.rgb) / .6, vec3(1.0)), amount);
    return mix(dyed, full, amount * amount);
}

vec3 gloss(vec3 albedo, vec3 n, vec3 v, float rough) {
    float nv = max(dot(n, v), 1e-3);
    float coat = .04 + .96 * pow(1.0 - nv, 5.0);
    // Lacquer over the colour: the full ~4% coat, sharp or soft with «Блеск».
    return albedo * room(n, 1.0) * 2.2 * (1.0 - coat) + coat * room(reflect(-v, n), rough);
}

// Integer hash: exact at any coordinate (a sine hash loses precision on
// phone GPUs far from the origin and starts to repeat).
float hashI(int a, int b) {
    uint h = uint(a) * 0x9E3779B1u ^ uint(b) * 0x85EBCA77u;
    h ^= h >> 15; h *= 0x2C1B3C6Du; h ^= h >> 12; h *= 0x297A2D39u; h ^= h >> 15;
    return float(h) * (1.0 / 4294967295.0);
}
// One scratch: its depth wanders along its length in steps of «len» px, and
// every row starts its pattern somewhere else, so scratches begin and fade out.
float scratch(int row, float along, float len, int seed) {
    float x = along / len + hashI(row, seed) * 97.0;
    float cell = floor(x), t = fract(x);
    int c = int(cell);
    return mix(hashI(row * 7 + seed, c), hashI(row * 7 + seed, c + 1), t * t * (3.0 - 2.0 * t));
}
// A layer of parallel scratches, «groove» counting rows across the grain.
float scratches(float groove, float along, float len, int seed) {
    float row = floor(groove), t = fract(groove);
    int r = int(row);
    return mix(scratch(r, along, len, seed), scratch(r + 1, along, len, seed), t * t * (3.0 - 2.0 * t));
}
// Smooth 2-D value noise for the sheet's slightly uneven sheen.
float cloud(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    ivec2 c = ivec2(i);
    return mix(mix(hashI(c.x, c.y), hashI(c.x + 1, c.y), f.x), mix(hashI(c.x, c.y + 1), hashI(c.x + 1, c.y + 1), f.x), f.y);
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
    // Lettering coverage, so the glow of the letters can be set on its own.
    float letterMask = 0.0;
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vec3(0.0, 0.0, 7.0) - vPosition);
    vec3 T = normalize(vTangent), B = normalize(vBitangent);
    vec2 surfacePx = vUV * uLayoutSize;
    float footprint = max(fwidth(vUV.x) * uLayoutSize.x, fwidth(vUV.y) * uLayoutSize.y);
    float resolved = 1.0 - smoothstep(.85, 1.8, footprint);
    // Where the lettering is sampled. Raised letters move it (below).
    vec2 texUV = vUV;
    ${logoShape === 'raised' || nameShape === 'raised' || bodyShape === 'raised' ? `
    // Parallax occlusion: raised letters stand proud of the plate by a few
    // layout px. The relief map alone only tilts their light, so seen at an
    // angle — a turn, a spin — they looked printed on a flat sheet. Here the
    // view ray is marched down through the relief heights (B: 0 plate, 1 top):
    // it meets a letter's top, its wall, or the plate beyond, so the letters
    // show their walls and hide the metal behind them. The geometry's plane is
    // the letters' top; the plate sits that height below it.
    if (uEdge < .5) {
        vec4 pad = vec4(-6.0, -6.0, 6.0, 6.0) / uLayoutSize.xyxy;
        float nearLogo = inRect(uLogoRect + pad);
        float nearName = inRect(uTitleRect + pad) * (1.0 - nearLogo);
        float nearText = inRect(uTextRect + pad) * (1.0 - nearLogo) * (1.0 - nearName);
        // Height follows the relief the shading shows: role and contacts keep
        // theirs only once magnified (see smallRelief), and nothing rises while
        // a stroke is under a pixel — walls with no relief to light them read
        // as a pale double of each letter.
        float smallShown = uBodyTint.a > 1.5 ? resolved : 1.0 - smoothstep(.35, .7, footprint);
        float height = (nearLogo * uRaisedHeight.y * uLogoScale + nearName * uRaisedHeight.x) * resolved
            + nearText * uRaisedHeight.z * smallShown;
        vec3 toEye = vec3(dot(v, T), dot(v, B), dot(v, n));
        if (height > 0.0 && toEye.z > .06) {
            // UV travelled from the top to the plate, and steps of ~⅓ layout px.
            vec2 shift = -toEye.xy / toEye.z * height / uLayoutSize;
            float layers = clamp(ceil(length(shift * uLayoutSize) * 3.0), 1.0, 40.0);
            vec2 stepUV = shift / layers;
            float stepDepth = 1.0 / layers;
            vec2 uv = vUV;
            float depth = 0.0;
            float below = 1.0 - bevelHeight(reliefT(textureLod(uEngraving, uv, 0.0).b));
            for (int i = 0; i < uLoopCounts.w; i++) {
                if (float(i) >= layers || depth >= below) break;
                uv += stepUV;
                depth += stepDepth;
                below = 1.0 - bevelHeight(reliefT(textureLod(uEngraving, uv, 0.0).b));
            }
            // Between the last two samples, where the ray crossed the surface.
            vec2 last = uv - stepUV;
            float after = below - depth;
            float before = (1.0 - bevelHeight(reliefT(textureLod(uEngraving, last, 0.0).b))) - (depth - stepDepth);
            texUV = depth > 0.0 ? mix(uv, last, clamp(after / (after - before - 1e-5), 0.0, 1.0)) : vUV;
        }
    }` : ''}
    vec4 ink = texture(uTexture, texUV);
    vec4 relief = texture(uEngraving, texUV);
    vec3 color;

    if (uEdge > .5) {
        // Diamond-cut chamfer: a narrow mirror facet. The side wall is satin.
        // The chamfer is a pixel or two wide on screen and a near-mirror: shaded
        // once per pixel, its line of light broke into steps and flickered as
        // the card turned. It is shaded at 8 points inside the pixel — normal and
        // facet position carried along their screen derivatives — and averaged.
        const vec2 EDGE_SS[8] = vec2[8](vec2(.0625, -.1875), vec2(-.0625, .1875), vec2(.3125, .0625), vec2(-.1875, -.3125),
                                        vec2(-.3125, .3125), vec2(-.4375, -.0625), vec2(.1875, .4375), vec2(.4375, -.4375));
        vec3 nDx = dFdx(n), nDy = dFdy(n);
        float facetDx = dFdx(vFacet), facetDy = dFdy(vFacet);
        // What is left of the normal's turn within a sample: roughness.
        float edgeRough = sqrt(min((dot(nDx, nDx) + dot(nDy, nDy)) * .6 / 8.0, .2));
        // The side wall is satin and steady: shaded once.
        vec3 wall = metal(SIDE_F0, n, v, max(${f(look.side.rough)}, edgeRough));
        color = vec3(0.0);
        for (int i = 0; i < uLoopCounts.z; i++) {
            vec2 o = EDGE_SS[i];
            vec3 ns = normalize(n + nDx * o.x + nDy * o.y);
            float facet = abs(vFacet + facetDx * o.x + facetDy * o.y);
            float chamfer = smoothstep(.25, .45, facet) * (1.0 - smoothstep(.95, .99, facet));
            vec3 cut = metal(CHAMFER_F0, ns, v, max(${f(look.chamfer.rough)}, edgeRough));
            // The chamfer mirrors the ring of directions around the card (square to
            // the view). Lamps cover only parts of it, which left dark gaps at the
            // rounded corners; a soft, even ring keeps the edge lit all the way round.
            vec3 around = uRoom * reflect(-v, ns);
            float ring = exp(-around.z * around.z * 6.0) * mix(.55, 1.0, smoothstep(-1.0, 1.0, around.y));
            cut += fresnel(CHAMFER_F0, max(dot(ns, v), 1e-3)) * ring * .8;
            color += mix(wall, cut, chamfer);
        }
        color /= 8.0;
    } else {
        // The orbiting light swept every letter's bevels at once — edges a pixel
        // or two wide — and lit them in a travelling shimmer, a fine ripple over
        // the lettering every few seconds. The letters take it only once the
        // plate is magnified and their bevels span pixels; the chamfer keeps it.
        orbitSeen = 1.0 - smoothstep(.12, .25, footprint);
        // Brushing direction and fine groove texture, filtered by pixel footprint.
        ${brushCircular ? `
        vec2 radial = surfacePx - uBrushCenter * uLayoutSize;
        float radius = length(radial);
        vec3 across = normalize(T * radial.x + B * radial.y + 1e-4);
        float groove = radius;
        float along = atan(radial.y, radial.x) * radius;` : `
        vec3 across = B;
        float groove = surfacePx.y;
        float along = surfacePx.x;`}
        // Hairline brushing, as on a real sheet: scratches of every length and
        // depth, broken along their run, in three sizes, and now and then a
        // deeper one. Each layer fades out once its rows are finer than a pixel.
        float fine = fwidth(groove);
        // Finish. Brushed: the grain below. Bead-blasted: an even frost with no
        // direction, rougher. Polished: nearly a mirror, the grain gone. Only the
        // finish in use is worked out: a uniform, so every pixel takes one branch.
        float blasted = 1.0 - step(.5, abs(uFinish - 1.0));
        float polished = step(1.5, uFinish);
        float brushing = 1.0 - blasted - polished;
        float grooves = 0.0, grainTilt = 0.0;
        if (brushing > 0.0) {
            float layer1 = (scratches(groove * 2.3, along, 38.0, 11) - .5) * (1.0 - smoothstep(.25, .6, fine * 2.3));
            float layer2 = (scratches(groove * .9, along, 95.0, 23) - .5) * (1.0 - smoothstep(.25, .6, fine * .9));
            // Single scratches are finer than a pixel, on screen as in the hand; what
            // the eye sees are bundles of them, 0.3–1 mm wide, a little brighter or
            // duller, running for a few centimetres. Those carry the texture.
            float bundles = (scratches(groove * .28, along, 160.0, 41) - .5) * (1.0 - smoothstep(.25, .6, fine * .28));
            float bands = (scratches(groove * .11, along, 330.0, 53) - .5);
            float deep = smoothstep(.92, .985, scratches(groove * .4, along, 240.0, 37)) * (1.0 - smoothstep(.25, .6, fine * .4));
            grooves = (layer1 * .8 + layer2 * .6 + bundles * .9 + bands * .6 + deep * .7) * brushing * uSurface;
            grainTilt = (layer2 * .3 + bundles + bands * .6) * uSurface;
        }
        // The sheet's sheen is a touch uneven over a fifth of the card.
        float sheen = cloud(surfacePx / 170.0) - .5;
        float plateRough = ${f(plate.rough)} * (1.0 + grooves * .12 + sheen * .16);
        plateRough = mix(mix(plateRough, .44 * (1.0 + sheen * .12), blasted), .055 * (1.0 + sheen * .3), polished);
        float plateAniso = ${f(plate.aniso)} * brushing;
        float nv = max(dot(n, v), 1e-3);
        ${plate.film ? 'vec3 plateF0 = filmF0(nv, vUV);' : 'vec3 plateF0 = PLATE_F0;'}
        // Bundles lie at slightly different angles across the grain (~1–2°): a
        // passing highlight breaks into streaks over them, as on real brushed
        // steel, while away from the highlights the metal stays calm.
        vec3 plateN = normalize(n + across * grainTilt * .035 * brushing);
        // Blasting leaves tiny dents tilted every way: a fine, even frost.
        vec2 frost = vec2(0.0);
        if (blasted > 0.0) frost = vec2(cloud(surfacePx * 1.1) - .5, cloud(surfacePx * 1.1 + 91.0) - .5) * (1.0 - smoothstep(.25, .6, fine * 1.1))
                   + vec2(cloud(surfacePx * .45 + 13.0) - .5, cloud(surfacePx * .45 + 57.0) - .5) * .35;
        frost *= uSurface;
        plateN = normalize(plateN + (T * frost.x + B * frost.y) * .04 * blasted);
        color = fresnel(plateF0, nv) * brushed(plateN, v, across, plateRough, plateAniso, 1.0);
        color *= 1.0 + grooves * .05 + sheen * mix(.05, .02, polished) + frost.x * .02 * blasted;
        // Sparkle: blasted steel is a field of dents a fraction of a millimetre
        // across, each a tiny mirror at its own tilt. The few that sit between
        // the key and the eye flash, and hand the flash on as the card moves.
        // One dent per cell; they fade once a cell is under a couple of pixels.
        if (blasted > 0.0 && uSparkle > 0.0) {
            vec2 dent = surfacePx / .75;
            ivec2 id = ivec2(floor(dent));
            vec2 tilt = (vec2(hashI(id.x, id.y * 3 + 1), hashI(id.x * 5 + 2, id.y)) - .5) * .9;
            vec2 centre = vec2(hashI(id.x + 11, id.y * 7 + 5), hashI(id.x * 3 + 7, id.y + 13)) - .5;
            vec3 halfway = normalize(normalize(uKeyDirection) + v);
            vec2 facing = vec2(dot(halfway, T), dot(halfway, B)) / max(dot(halfway, n), .2) - tilt;
            float glint = exp(-dot(facing, facing) / .0025);
            float cellPx = footprint / .75;
            float speck = 1.0 - smoothstep(.2 - cellPx * .5, .2 + cellPx * .5, length(fract(dent) - .5 - centre * .5));
            color += uSparkle * uKeyColor * uKeyGain * plateF0 * glint * speck * (1.0 - smoothstep(.8, 1.6, cellPx)) * .35;
        }
        ${plate.coat ? `
        // PVD coatings keep a faint clear reflection above the dark metal.
        color += ${f(plate.coat)} * roomFor(reflect(-v, n), .10, 1.0);` : ''}

        float logoRegion = inRect(uLogoRect);
        float titleRegion = inRect(uTitleRect) * (1.0 - logoRegion);
        float textRegion = 1.0 - logoRegion - titleRegion;
        float engraved = clamp(relief.a / max(ink.a, .001), 0.0, 1.0);
        // Role and contacts are 12–13 px: at their usual size a stroke is about a
        // pixel wide and mostly bevel, so the bevel split each letter into light
        // and dark outlines. Their relief shows only once the plate is magnified
        // (zoom, a phone held close); until then they read as clean print, with
        // the raised shadow for depth. The bigger type keeps its full relief.
        // Letters in the plate's own material are read by their relief alone: keep it.
        float smallRelief = uBodyTint.a > 1.5 ? resolved : 1.0 - smoothstep(.35, .7, footprint);
        float reliefShown = mix(resolved, smallRelief, textRegion);
        vec3 reliefRegion = vec3(titleRegion, logoRegion, textRegion);
        vec2 slopeXY = reliefSlopeXY(relief, reliefRegion, footprint) * reliefShown;
        vec3 facet = normalize(T * slopeXY.x + B * slopeXY.y + n * sqrt(max(.01, 1.0 - dot(slopeXY, slopeXY))));
        // Specular anti-aliasing (Kaplanyan–Hoffman): where the relief normal
        // turns faster than a pixel can show, widen the reflection instead of
        // letting a mirror flicker between a bright panel and dark room. This is
        // the spread over the whole pixel; each of the samples below covers part
        // of it (see normalSpread / samples).
        vec3 dnx = dFdx(facet), dny = dFdy(facet);
        float normalSpread = min((dot(dnx, dnx) + dot(dny, dny)) * .6, .20);
        // Supersampled lettering. A bevel is a pixel or two wide on screen, yet
        // holds a bright edge, a dark band and a reflection of the room: shaded
        // once per pixel, the pixels along it caught either a lamp or the dark
        // and the letters showed stair-steps, grain and a busy outline. Near the
        // letters the relief is shaded at several points inside the pixel (the
        // standard 4× and 8× patterns) and averaged, as a camera's pixel sums
        // the light falling on it. The more of a bevel a pixel holds, the more
        // samples; magnified, one is enough. Away from letters: one, as before.
        vec2 uvDx = dFdx(texUV), uvDy = dFdy(texUV);
        vec2 inkTexels = vec2(textureSize(uTexture, 0));
        float inkLod = log2(max(max(length(uvDx * inkTexels), length(uvDy * inkTexels)), 1.0));
        bool nearInk = textureLod(uTexture, texUV, inkLod + 2.5).a > .002;
        int samples = !nearInk ? 1 : footprint > .4 ? 8 : footprint > .15 ? 4 : 1;
        float sampleScale = inversesqrt(float(samples));

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
        // Soft, not sharp: the relief's mip levels are its coverage blurred, so
        // one fetch at the level of a letter's height is a penumbra that wide
        // (never finer than a pixel, which would shimmer).
        vec2 texels = vec2(textureSize(uEngraving, 0));
        float pixelLod = log2(max(max(fwidth(vUV.x) * texels.x, fwidth(vUV.y) * texels.y), 1.0));
        float softLod = max(pixelLod, log2(max(raisedHeight * texels.x / uLayoutSize.x, 1.0)));
        float occluder = textureLod(uEngraving, texUV + castStep * .5, softLod).a * .45
                       + textureLod(uEngraving, texUV + castStep, softLod).a * .35
                       + textureLod(uEngraving, texUV + castStep * 1.8, softLod + .5).a * .20;
        // Contact shadow: at a letter's foot the plate sees less of the room,
        // whatever the light — a soft darkening about the letter's height wide.
        // With the light square on, the cast shadow above is all but hidden
        // under the letter; this is what still sets it on the plate.
        float contact = textureLod(uEngraving, texUV, softLod + .6).a;
        // Role and contacts cast one only where they rise (smallRelief): under a
        // pixel, a shadow smeared each stroke into a bold, blurred double.
        float shadowShown = resolved * mix(1.0, smallRelief, nearText);
        color *= 1.0 - (occluder * .6 + contact * .22) * (1.0 - ink.a) * step(.001, raisedHeight) * shadowShown;` : ''}
        // 4× and 8× sample positions inside the pixel, in pixels from its centre.
        const vec2 SS4[4] = vec2[4](vec2(-.125, -.375), vec2(.375, -.125), vec2(.125, .375), vec2(-.375, .125));
        const vec2 SS8[8] = vec2[8](vec2(.0625, -.1875), vec2(-.0625, .1875), vec2(.3125, .0625), vec2(-.1875, -.3125),
                                    vec2(-.3125, .3125), vec2(-.4375, -.0625), vec2(.1875, .4375), vec2(.4375, -.4375));
        vec3 plate = color, shaded = vec3(0.0);
        float letterSum = 0.0;
        for (int sampleIndex = 0; sampleIndex < uLoopCounts.x; sampleIndex++) {
            if (sampleIndex >= samples) break;
            vec2 offset = samples == 8 ? SS8[sampleIndex] : samples == 4 ? SS4[sampleIndex] : vec2(0.0);
            vec2 uvS = texUV + uvDx * offset.x + uvDy * offset.y;
            // Each sample reads the relief as finely as its share of the pixel.
            vec4 inkS = textureGrad(uTexture, uvS, uvDx * sampleScale, uvDy * sampleScale);
            vec4 reliefS = textureGrad(uEngraving, uvS, uvDx * sampleScale, uvDy * sampleScale);
            vec2 slopeXY = reliefSlopeXY(reliefS, reliefRegion, footprint * sampleScale) * reliefShown;
            float slope = length(slopeXY);
            vec3 facet = normalize(T * slopeXY.x + B * slopeXY.y + n * sqrt(max(.01, 1.0 - dot(slopeXY, slopeXY))));
            float depth = reliefT(reliefS.b);
            // The letter's edge from its distance field, antialiased over one
            // pixel at any zoom — the mask's own edge is a texel wide and went
            // soft and stepped when the card was magnified. Regions without a
            // relief keep the mask.
            float pixelWidth = footprint * sampleScale;
            float fieldWidth = dot(reliefRegion, uReliefWidth);
            float fieldEdge = clamp((reliefS.b * 2.0 - 1.0) * fieldWidth / max(pixelWidth, 1e-4) + .5, 0.0, 1.0);
            // The field holds distances only out to one bevel width beyond the
            // outline. A pixel wider than two (a card turned far, seen almost
            // edge-on) read that clamped «one width outside» as partly inside,
            // and the whole block of text lit up as a faint slab. From one width
            // on the mask, filtered to the pixel, takes over.
            float fieldTrust = 1.0 - smoothstep(fieldWidth, 2.0 * fieldWidth, pixelWidth);
            float letterCover = mix(inkS.a, fieldEdge, dot(reliefRegion, uReliefHas) * fieldTrust);
            float letterRough = sqrt(normalSpread / float(samples));

            float coverage = max(letterCover, max(underline, focusStroke));
            letterSum += coverage;
            if (coverage <= .001) { shaded += plate; continue; }
            // The first letter of the wordmark is drawn red-only in the mask. Read
            // a little blurred, so the colour is known out to the drawn edge.
            vec4 inkTone = textureLod(uTexture, uvS, max(inkLod, 1.5));
            vec3 inkColor = inkTone.rgb / max(inkTone.a, .001);
            float firstLetter = smoothstep(.6, .3, inkColor.g);
            // Letters with a colour (a tint or the plate's material), against
            // letters left in the edition's own metal.
            float coloured = logoRegion * mix(step(.5, uLogoTint.a), step(.5, uLogoFirstTint.a), firstLetter)
                           + titleRegion * step(.5, uNameTint.a) + textRegion * step(.5, uBodyTint.a);
            // Raised letters in bare metal get satin shoulders: polished, a steep
            // shoulder mirrored the whole room at once — floor, horizon, lamps —
            // in a busy chrome outline of parallel dark and bright lines.
            float raisedRegion = ${[[logoShape, 'logoRegion'], [nameShape, 'titleRegion'], [bodyShape, 'textRegion']]
                .filter(([shape]) => shape === 'raised').map(([, region]) => region).join(' + ') || '0.0'};
            letterRough = max(letterRough, .45 * smoothstep(.1, .6, slope) * (1.0 - coloured) * raisedRegion);
            // Colour: enamel fills the flat faces and leaves polished bevels;
            // anodising colours the metal itself, bevels included.
            float letterEdge = smoothstep(.12, .45, slope) * resolved;
            // Blind embossing: the plate's brushed finish on the relief normal.
            vec3 plateLetter = vec3(0.0);
            if (max(max(uLogoTint.a, uLogoFirstTint.a), max(uNameTint.a, uBodyTint.a)) > 1.5
                || min(min(uTintAmount.x, uTintAmount.y), min(uTintAmount.z, uTintAmount.w)) < .999) {
                float fv = max(dot(facet, v), 1e-3);
                ${plate.film ? 'vec3 letterF0 = filmF0(fv, vUV);' : 'vec3 letterF0 = PLATE_F0;'}
                plateLetter = fresnel(letterF0, fv) * brushed(facet, v, across, plateRough, plateAniso, 1.0) * (1.0 + grooves * .05);
                ${plate.coat ? `plateLetter += ${f(plate.coat)} * roomFor(reflect(-v, facet), .10, 1.0);` : ''}
            }
            // Each pixel lies in one region (wordmark, name, or role and
            // contacts) and is lit with that region's process only: working out
            // all three and keeping one cost two thirds of the letters' light.
            // Links are drawn with the body text's process, so it is also
            // worked out wherever an underline or a focus ring falls.
            float linkMark = max(underline, focusStroke);
            vec3 textColor = vec3(0.0);
            if (textRegion > .5 || linkMark > 0.0) {
                ${letteringCode('text', bodyLook, bodyShape === 'edition', false)}
                ${bodyShape !== 'edition' && occlusion(bodyShape) ? `textColor *= mix(1.0, ${occlusion(bodyShape)}, depth);` : ''}
                textColor = tinted(textColor, uBodyTint, uTintFinish.w, n, facet, v, letterRough, letterEdge, uGloss.z, plateLetter, uTintAmount.w);
                // Role and contacts sit back: a shallower mark, closer to the plate.
                textColor = mix(textColor, plate, uTextMute);
            }
            vec3 lettering = textColor;
            if (logoRegion > .5) {
                ${letteringCode('logo', look.logo)}
                ${occlusion(logoShape) ? `
                // Recessed logo: the floor sees less of the room than the plate.
                logoColor *= mix(1.0, ${occlusion(logoShape)}, depth);` : ''}
                // The first letter's own colour only where it is, the wordmark's
                // elsewhere; both only across the first letter's edge.
                vec3 wordmark = firstLetter < 1.0 ? tinted(logoColor, uLogoTint, uTintFinish.y, n, facet, v, letterRough, letterEdge, uGloss.x, plateLetter, uTintAmount.y) : logoColor;
                vec3 first = firstLetter > 0.0 ? tinted(logoColor, uLogoFirstTint, uTintFinish.x, n, facet, v, letterRough, letterEdge, uGloss.x, plateLetter, uTintAmount.x) : logoColor;
                lettering = mix(wordmark, first, firstLetter);
            } else if (titleRegion > .5) {
                ${letteringCode('name', nameLook)}
                ${nameShape !== 'edition' && occlusion(nameShape) ? `nameColor *= mix(1.0, ${occlusion(nameShape)}, depth);` : ''}
                lettering = tinted(nameColor, uNameTint, uTintFinish.z, n, facet, v, letterRough, letterEdge, uGloss.y, plateLetter, uTintAmount.z);
            }
            ${logoShape === 'raised' || nameShape === 'raised' || bodyShape === 'raised' ? `
            // Raised letters have diamond-turned shoulders: the cut goes through
            // the colour to bare, polished steel, as on a machined badge. The
            // rounded shoulder mirrors the room over a range of angles, so each
            // letter shows a thin bright edge towards the light, a dark one away
            // from it — the cue that reads as height, even with the card square on.
            // Only the steep outer part is cut, so the letter keeps its colour;
            // role and contacts are too small for a cut and keep theirs whole.
            float cutRegion = ${[[logoShape, 'logoRegion'], [nameShape, 'titleRegion']]
                .filter(([shape]) => shape === 'raised').map(([, region]) => region).join(' + ') || '0.0'};
            // Only through a colour: letters in bare metal are that metal through
            // and through, and a mirror rim on them drew a chrome outline.
            float cut = smoothstep(.3, .65, slope) * .6 * resolved * cutRegion * letterCover * coloured;
            if (cut > 0.0) lettering = mix(lettering, metal(plateF0, facet, v, max(.05, letterRough)), cut);` : ''}
            // The wordmark and the name sit back towards the plate as a whole,
            // bevels included: muted letters with bright edges read as outlines.
            lettering = mix(lettering, plate, uMute.x * logoRegion + uMute.y * titleRegion);
            lettering = mix(lettering, textColor, linkMark);
            shaded += mix(plate, lettering, coverage);
        }
        color = shaded / float(samples);
        letterMask = letterSum / float(samples);
    }

    vec3 hdr = color * uExposure;
    if (uBloomPass > .5) {
        // Store the part above white, compressed, for the quarter-resolution glow.
        // The part above the threshold keeps the highlight's hue: subtracting the
        // same amount from every channel left gold glowing orange-red.
        float peak = max(hdr.r, max(hdr.g, hdr.b));
        vec3 glow = hdr * max(peak - 1.6, 0.0) / max(peak, 1e-4);
        outColor = vec4(glow * .25 * uOpacity * uReveal * mix(1.0, uLetterGlow, letterMask), 1.0);
        return;
    }
    // With headroom the curve's shoulder moves up by it: highlights run on past
    // white instead of flattening into it, the rest of the picture as before.
    vec3 display = toDisplay(uOutput.z * neutralTonemap(hdr / uOutput.z));
    // Dither to the 8-bit output: the dark plate's slow gradients on velvet
    // otherwise show as steps of one level. Triangular noise of ±1 level, fixed
    // to the screen so it does not crawl.
    ivec2 pixel = ivec2(gl_FragCoord.xy);
    display += (hashI(pixel.x, pixel.y) + hashI(pixel.x + 7919, pixel.y + 104729) - 1.0) / 255.0;
    outColor = vec4(display * uReveal * uOpacity, uOpacity);
}`;

// GLSL for one lettering process. Produces `<name>Color`.
// `declare: false` assigns to a colour declared outside (the body text, which
// links use in any region).
function letteringCode(name, m, flat = false, declare = true) {
    const out = `${name}Color`, type = declare ? 'vec3 ' : '';
    // Gloss from the lab (1 — as finished, 0 — matte): blends the roughness
    // towards a satin-matte .55. Component: x logo, y name, z role and contacts.
    const g = `uGloss.${{ logo: 'x', name: 'y', text: 'z' }[name]}`;
    const shine = rough => `mix(.55, ${rough}, ${g})`;
    if (m.process === 'vcut') return `
            // Diamond V-cut: both walls are polished; the lower groove is occluded.
            float ${name}Wall = smoothstep(.02, .20, slope);
            ${type}${out} = metal(${name.toUpperCase()}_F0, facet, v, ${shine(`max(${f(m.rough)}, letterRough)`)}) * mix(1.0, .9, ${name}Wall);`;
    if (m.process === 'enamel') return `
            // Cut-and-fill: gloss enamel sits a hair below a polished lip.
            float ${name}Lip = smoothstep(.25, .55, slope) * resolved;
            ${type}${out} = mix(gloss(${v3(m.albedo)}, n, v, ${shine('.12')}),
                metal(${v3(m.lip)}, facet, v, ${shine('max(.04, letterRough)')}), ${name}Lip * .55);`;
    if (m.process === 'ablate') return `
            // Laser ablation: coating removed, bare frosted steel below. The frost
            // scatters a little of the room evenly; more read as white print.
            ${type}${out} = metal(${name.toUpperCase()}_F0, ${flat ? 'n' : 'facet'}, v, ${shine(flat ? f(m.rough) : `max(${f(m.rough)}, letterRough)`)});
            ${out} += ${name.toUpperCase()}_F0 * room(n, 1.0) * .18;`;
    return `
            // Laser annealing: dark oxide with a faint, rough sheen.
            ${type}${out} = ${v3(m.albedo)} * room(n, 1.0) * 2.0 + .008 * room(reflect(-v, n), .55);`;
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

// Sets a program's uniforms from a frame's values by name (numbers and arrays,
// see draw), in the form its own declarations ask for. Names the compiler
// dropped are skipped.
function uniformSetter(gl, program) {
    const setters = {};
    for (let i = 0, count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i < count; i++) {
        const { name, type } = gl.getActiveUniform(program, i);
        const location = gl.getUniformLocation(program, name);
        setters[name.replace(/\[0\]$/, '')] = {
            [gl.FLOAT]: value => typeof value === 'number' ? gl.uniform1f(location, value) : gl.uniform1fv(location, value),
            [gl.FLOAT_VEC2]: value => gl.uniform2fv(location, value),
            [gl.FLOAT_VEC3]: value => gl.uniform3fv(location, value),
            [gl.FLOAT_VEC4]: value => gl.uniform4fv(location, value),
            [gl.FLOAT_MAT3]: value => gl.uniformMatrix3fv(location, false, value),
            [gl.FLOAT_MAT4]: value => gl.uniformMatrix4fv(location, false, value),
            [gl.INT]: value => gl.uniform1i(location, value),
            [gl.INT_VEC4]: value => gl.uniform4iv(location, value),
            [gl.SAMPLER_2D]: value => gl.uniform1i(location, value)
        }[type];
    }
    return values => { for (const name in values) setters[name]?.(values[name]); };
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
const hashCode = `float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}`;

const backdropFragment = `#version 300 es
precision highp float;
uniform sampler2D uShadow;
uniform vec2 uResolution;
uniform vec2 uPool;
uniform float uTime;
uniform vec3 uWall;
uniform vec3 uFloor;
uniform vec3 uPoolColor;
uniform float uGrain;
uniform float uShadowStrength;
uniform float uShadowFade;
// How tight the key's pool of light on the wall is (2.6 — broad).
uniform float uPoolFalloff;
// How far the room darkens towards the screen's edges.
uniform float uVignette;
// Touch screens: the scene melts into flat edge colours that Safari extends
// under its status bar and toolbar (fractions of height; 0 disables).
uniform vec4 uEdgeFade;
uniform vec3 uEdgeTop;
uniform vec3 uEdgeBottom;
in vec2 vUV;
out vec4 outColor;
${toneCode}
${hashCode}

// Screen position in units of the shorter side: a portrait phone gets the same
// pool and vignette as a landscape screen, turned, instead of a pool that fills
// the whole narrow screen and a vignette that never reaches its sides.
vec2 screenUnits(vec2 uv) {
    float aspect = uResolution.x / uResolution.y;
    return uv * vec2(aspect, 1.0) / min(aspect, 1.0);
}

// 0 on landscape and square screens, 1 on a phone held upright (2:1 and taller).
float tallness() {
    return clamp(uResolution.y / uResolution.x - 1.0, 0.0, 1.0);
}

// Wall lighting at a screen position: base tone and the key light's pool.
// The pool drifts and breathes slowly, so the room feels alive; on a tall
// screen it stretches upwards and downwards to fill it.
vec3 wallColor(vec2 uv) {
    vec2 drift = vec2(sin(uTime * .21), cos(uTime * .17 + 1.3)) * vec2(.035, .03);
    // An upright phone centres the pool vertically: the frame stays symmetric.
    vec2 pool = mix(uPool, vec2(uPool.x, .5), tallness());
    vec2 d = (screenUnits(uv) - screenUnits(pool + drift)) * vec2(.85, mix(1.1, .62, tallness()));
    float breath = 1.0 + .08 * sin(uTime * .33) + .04 * sin(uTime * .57 + 2.0);
    return uWall + uPoolColor * breath * exp(-dot(d, d) * uPoolFalloff);
}

void main() {
    vec2 p = screenUnits(vUV) - screenUnits(vec2(.5));
    float tall = tallness();
    // Cyclorama: the wall curves softly into a darker floor below the card.
    vec3 wall = wallColor(vUV);
    // No floor on an upright phone: the dark frame is the same above and below.
    vec3 color = mix(wall, uFloor + (wall - uWall) * .6, smoothstep(-.12, -.62, p.y) * (1.0 - tall));
    color *= 1.0 - uVignette * smoothstep(.3, 1.15, length(p * vec2(.78, mix(1.0, .62, tall))));
    color *= 1.0 - texture(uShadow, vUV).r * uShadowStrength * uShadowFade;
    vec3 display = toSRGB(neutralTonemap(color));
    display += (hash(gl_FragCoord.xy + 17.0) - .5) * uGrain;
    // Touch screens: the backdrop is only a core in the middle. Above and below
    // it ramps into the flat page colour, which continues under Safari's bars.
    // x/y: flat band at the top/bottom, z/w: length of the ramp before it.
    if (uEdgeFade.x > 0.0) display = mix(display, uEdgeTop, smoothstep(1.0 - uEdgeFade.x - uEdgeFade.z, 1.0 - uEdgeFade.x, vUV.y));
    if (uEdgeFade.y > 0.0) display = mix(display, uEdgeBottom, smoothstep(uEdgeFade.y + uEdgeFade.w, uEdgeFade.y, vUV.y));
    // The page around the canvas is sRGB: on a P3 buffer the backdrop is the
    // same colour exactly, so its edges still meet the page and Safari's bars.
    outColor = vec4(displayFromSRGB(display), 1.0);
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
// The glow's colour on a Display P3 buffer: sRGB to P3, near enough for a glow.
uniform mat3 uGlowSpace;
in vec2 vUV;
out vec4 outColor;
void main() {
    vec3 glow = (texture(uNear, vUV).rgb + texture(uWide, vUV).rgb * .55) * 4.0 * uStrength;
    glow = clamp(uGlowSpace * (1.0 - exp(-glow)), 0.0, 1.0);
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
        landscape: { logo: 145, logoY: 42, center: false, name: [130], nameSize: direction.relief.nameSize, role: [152], contacts: 188 },
        portrait: { logo: 110, logoY: 76, center: true, name: [164, 193], nameSize: 24, role: [223, 240], contacts: 290 }
    },
    accent: {
        landscape: { logo: 92, logoY: 46, center: false, name: [128], nameSize: 32, role: [154], contacts: 190 },
        portrait: { logo: 78, logoY: 76, center: false, name: [152, 185], nameSize: 27, role: [216, 233], contacts: 284 }
    },
    // The accent's type on a frame: the wordmark on the top margin, the contacts
    // on the bottom one, each as far from its edge as the text is from the left;
    // name and role at the optical centre between them.
    grid: {
        landscape: { logo: 92, logoY: 46, center: false, name: [128], nameSize: 32, role: [154], contacts: 190, anchored: true },
        portrait: { logo: 78, logoY: 76, center: false, name: [152, 185], nameSize: 27, role: [216, 233], contacts: 284, anchored: true }
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

function textureCanvas(lang, vertical, logo, maxSize) {
    const plan = LAYOUTS[currentLayout][vertical ? 'portrait' : 'landscape'];
    const width = vertical ? 300 : 545, height = vertical ? portraitHeight : 300;
    const data = cardContent(lang);
    const canvas = document.createElement('canvas');
    const textureSize = length => Math.min(maxSize, 2 ** Math.ceil(Math.log2(length * 2.5)));
    canvas.width = textureSize(width);
    canvas.height = textureSize(height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.scale(canvas.width / width, canvas.height / height);
    context.clearRect(0, 0, width, height);
    const links = [];
    // Portrait centres the block by its widest line (below); 34 is a start.
    let x = vertical ? 34 : 56;
    context.textAlign = 'left';
    context.fillStyle = '#fff';
    const logoWidth = plan.logo;
    const viewBox = logos[lang].viewBox.split(' ').map(Number);
    const logoHeight = logoWidth * viewBox[3] / viewBox[2];
    let logoX = plan.center ? (width - logoWidth) / 2 : x;
    const logoY = plan.logoY;
    // Role and contacts; the lab can add a px or two. Their line spacing grows with them.
    const baseTextSize = vertical ? 12.5 : 13;
    const textSize = baseTextSize + (globalThis.__cardLab?.bodySize ?? 0);
    const bodyGrow = textSize / baseTextSize;
    // Name and role stay on one line whenever they fit the plate; only a line
    // that does not fit is split in two, and everything below moves with it.
    const maxWidth = vertical ? width - 2 * 26 : 440;
    // «Тонкая типографика»: small type opened up a little and the large name set
    // a touch tighter, as type is set for print at those sizes (em fractions).
    const fine = (globalThis.__cardLab?.typography ?? 0) > 0;
    const trackName = fine ? -.01 : 0, trackBody = fine ? .025 : 0;
    // Tracking glyph by glyph (canvas letterSpacing is not in every browser):
    // each glyph where the untracked line puts it, kerning kept, plus spacing.
    const tracked = (value, size, tracking) => size * tracking * Math.max(0, [...value].length - 1);
    const fillTracked = (value, left, baseline, spacing) => {
        if (!spacing) { context.fillText(value, left, baseline); return; }
        let before = '';
        [...value].forEach((glyph, i) => {
            const at = context.measureText(before + glyph).width - context.measureText(glyph).width;
            context.fillText(glyph, left + at + i * spacing, baseline);
            before += glyph;
        });
    };
    const fits = (value, size, weight, tracking) => {
        context.font = `${weight} ${size}px "${cardFont()}", Arial, sans-serif`;
        return context.measureText(value).width + tracked(value, size, tracking) <= maxWidth;
    };
    // The lab can scale the name; the plans are drawn for the size in LAYOUTS.
    const nameScale = globalThis.__cardLab?.nameScale ?? direction.nameScale ?? 1;
    // Weights: role and contacts Regular by default, the name Medium; the lab
    // sets each to 400, 500 or 600 (the card fonts' range).
    const bodyWeight = globalThis.__cardLab?.bodyWeight ?? 400;
    const nameWeight = globalThis.__cardLab?.nameWeight ?? 500;
    let nameSize = plan.nameSize * nameScale;
    const nameLines = fits(data.name, nameSize, nameWeight, trackName) ? [data.name] : splitTwo(data.name);
    // A single long word can still be wider than the plate: shrink to fit.
    context.font = `${nameWeight} ${nameSize}px "${cardFont()}", Arial, sans-serif`;
    const widest = Math.max(...nameLines.map(line => context.measureText(line).width + tracked(line, nameSize, trackName)));
    if (widest > maxWidth) nameSize *= maxWidth / widest;
    const growth = nameSize - plan.nameSize;
    const roleLines = fits(data.position, textSize, bodyWeight, trackBody) ? [data.position] : (data.positionLines || splitTwo(data.position));
    const ink = (value, size, weight = 400) => {
        context.font = `${weight} ${size}px "${cardFont()}", Arial, sans-serif`;
        const metrics = context.measureText(value);
        return { ascent: metrics.actualBoundingBoxAscent, descent: Math.max(0, metrics.actualBoundingBoxDescent) };
    };
    // Email and Telegram sit at the role's own leading: one rhythm for the small text.
    let nameY, nameGap, roleYs, contactsY, lineHeight;
    if (vertical) {
        // Portrait: a rhythm from the real glyph sizes rather than fixed baselines.
        // The same white space separates name → role and role → contacts; the
        // logo gets a little more; the name lines sit at a heading's leading.
        const gap = 22, logoGap = 30, roleLeading = 17 * bodyGrow;
        nameGap = nameSize * 1.12;
        nameY = logoY + logoHeight + logoGap + ink(nameLines[0], nameSize, nameWeight).ascent;
        const nameBottom = nameY + (nameLines.length - 1) * nameGap + ink(nameLines.at(-1), nameSize, nameWeight).descent;
        const roleY = nameBottom + gap + ink(roleLines[0], textSize, bodyWeight).ascent;
        roleYs = roleLines.map((_, i) => roleY + i * roleLeading);
        lineHeight = roleLeading;
        const roleBottom = roleYs.at(-1) + ink(roleLines.at(-1), textSize, bodyWeight).descent;
        contactsY = roleBottom + gap + ink(data.email, textSize, bodyWeight).ascent;
    } else {
        // Landscape plans are drawn for one-line blocks.
        const planGap = plan.name.length > 1 ? plan.name[1] - plan.name[0] : Math.round(plan.nameSize * 1.22);
        nameGap = planGap * nameSize / plan.nameSize;
        const roleGap = (plan.role.length > 1 ? plan.role[1] - plan.role[0] : 17) * bodyGrow;
        // A larger name keeps its gap to the logo (the baseline moves down by the
        // cap height it gained) and pushes everything below by its extra size.
        nameY = plan.name[0] + growth * .75;
        const nameShift = nameY + (nameLines.length - 1) * nameGap + growth * .25
            - (plan.name[0] + (plan.name.length - 1) * planGap);
        const roleShift = nameShift + (roleLines.length - plan.role.length) * roleGap;
        roleYs = roleLines.map((_, i) => plan.role[0] + nameShift + i * roleGap);
        lineHeight = roleGap;
        contactsY = plan.contacts + roleShift;
    }
    const finalBaseline = contactsY + lineHeight;
    const blockTop = logoY;
    const blockBottom = finalBaseline + ink(`t.me/${data.telegram}`, textSize, bodyWeight).descent;
    // Centre the block on the plate. The portrait plate narrows into its point
    // over the last 13% of its height; the eye counts part of that point as
    // space below the text, so the block is centred on the top 92%. Landscape
    // sits a touch above the geometric centre, which reads as centred.
    const usable = vertical ? height * .92 : height;
    const yOffset = (usable - blockTop - blockBottom) / 2 - (vertical ? 0 : usable * .015);
    // Each group's vertical shift: one for the whole block, unless anchored.
    let logoShift = yOffset, middleShift = yOffset, contactsShift = yOffset;
    if (plan.anchored) {
        const margin = vertical ? 50 : x;
        logoShift = margin - logoY;
        contactsShift = usable - margin - blockBottom;
        const top = logoY + logoHeight + logoShift;
        const bottom = contactsY - ink(data.email, textSize, bodyWeight).ascent + contactsShift;
        const middleTop = nameY - ink(nameLines[0], nameSize, nameWeight).ascent;
        const middleBottom = roleYs.at(-1) + ink(roleLines.at(-1), textSize, bodyWeight).descent;
        // A little above the geometric middle, which reads as the centre.
        middleShift = (top + bottom - middleTop - middleBottom) / 2 - (bottom - top) * .04;
    }
    let shift = middleShift;
    function text(value, y, size, url, weight = 400, tracking = 0) {
        y += shift;
        context.font = `${weight} ${size}px "${cardFont()}", Arial, sans-serif`;
        const metrics = context.measureText(value);
        const extra = tracked(value, size, tracking);
        const drawX = x + metrics.actualBoundingBoxLeft;
        fillTracked(value, drawX, y, size * tracking);
        if (url) {
            const left = drawX - metrics.actualBoundingBoxLeft;
            const measure = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight + extra;
            links.push({ x: left, y: y - size, width: measure, height: size + 7,
                underlineY: y + Math.max(0, metrics.actualBoundingBoxDescent) + 2, url });
        }
        return [(drawX - metrics.actualBoundingBoxLeft - 2) / width,
            (y - metrics.actualBoundingBoxAscent - 2) / height,
            (drawX + metrics.actualBoundingBoxRight + extra + 2) / width,
            (y + metrics.actualBoundingBoxDescent + 2) / height];
    }
    if (vertical) {
        // Left-aligned lines, but equal metal on both sides of the widest one:
        // a fixed left margin left the long name almost touching the right edge.
        const inkWidth = (value, size, weight = 400, tracking = 0) => {
            context.font = `${weight} ${size}px "${cardFont()}", Arial, sans-serif`;
            const metrics = context.measureText(value);
            return metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight + tracked(value, size, tracking);
        };
        const widest = Math.max(plan.center ? 0 : logoWidth,
            ...nameLines.map(line => inkWidth(line, nameSize, nameWeight, trackName)),
            ...roleLines.map(line => inkWidth(line, textSize, bodyWeight, trackBody)),
            inkWidth(data.email, textSize, bodyWeight, trackBody), inkWidth(`t.me/${data.telegram}`, textSize, bodyWeight, trackBody));
        x = (width - widest) / 2;
        if (!plan.center) logoX = x;
    }
    context.drawImage(logo, logoX, logoY + logoShift, logoWidth, logoHeight);
    links.push({ x: logoX, y: logoY + logoShift, width: logoWidth, height: logoHeight, url: data.companyUrl });
    const titleRects = nameLines.map((line, i) => text(line, nameY + i * nameGap, nameSize, undefined, nameWeight, trackName));
    const titleRelief = [Math.min(...titleRects.map(r => r[0])), Math.min(...titleRects.map(r => r[1])),
        Math.max(...titleRects.map(r => r[2])), Math.max(...titleRects.map(r => r[3]))];
    const logoRelief = [(logoX - 2) / width, (logoY + logoShift - 2) / height,
        (logoX + logoWidth + 2) / width, (logoY + logoShift + logoHeight + 2) / height];
    const bodyRects = roleLines.map((line, i) => text(line, roleYs[i], textSize, undefined, bodyWeight, trackBody));
    const y = contactsY;
    const size = textSize;
    shift = contactsShift;
    bodyRects.push(text(data.email, y, size, `mailto:${data.email}`, bodyWeight, trackBody));
    bodyRects.push(text(`t.me/${data.telegram}`, y + lineHeight, size, `https://t.me/${data.telegram}`, bodyWeight, trackBody));
    const textRelief = [Math.min(...bodyRects.map(r => r[0])), Math.min(...bodyRects.map(r => r[1])),
        Math.max(...bodyRects.map(r => r[2])), Math.max(...bodyRects.map(r => r[3]))];
    return { canvas, links, width, height, titleRelief, logoRelief, textRelief, logoScale: logoWidth / 145 };
}

// A hand spin: the plate on an axle. It takes `gain` of the finger's speed,
// eased into `max` (rad/s, about 2.7 turns a second); air drag grows with the
// speed (`drag`, 1/s) and the bearing's friction is constant (`bearing`,
// rad/s²), so a fast spin sheds speed quickly, a slow one runs down evenly and
// stops in finite time rather than creeping. `spring` (rad/s) and `damping`
// bring a weak push back to its side.
const SPIN = { gain: .75, max: 17, drag: 1.1, bearing: 3, spring: 7, damping: .75 };
// How far a spin at `speed` coasts before drag and friction stop it.
const coastDistance = speed => (speed - SPIN.bearing / SPIN.drag * Math.log(1 + SPIN.drag * speed / SPIN.bearing)) / SPIN.drag;

// Which card a device gets: the studio, or light 3D (lite.js) where the GPU
// cannot draw the studio at a usable rate. A browser drawing in software (a
// blocklisted GPU on Linux, often) gets light 3D at once; otherwise a short
// probe decides (probe). The decision is remembered per GPU, screen and build,
// so the next visit starts on it. `?render=full` / `?render=lite` force one for
// that load (not remembered).
const PERFORMANCE_KEY = 'card-performance';
// Light 3D is a module of its own, fetched only by a device that draws it: the
// page itself carries the studio alone. Built pages name it in __CARD_LITE__
// (a content-hashed file beside the page); unbuilt, it lies beside this file.
const LITE_URL = typeof __CARD_LITE__ !== 'undefined' ? __CARD_LITE__ : new URL('./lite.js', import.meta.url).href;
async function cardFragment(mode) {
    if (mode !== 'lite') return fragmentSource;
    const { liteFragment } = await import(LITE_URL);
    return liteFragment({ toneCode, hashCode });
}
const shaderVersion = (() => {
    let hash = 5381;
    const source = fragmentSource + LITE_URL;
    for (let i = 0; i < source.length; i++) hash = (hash * 33 ^ source.charCodeAt(i)) >>> 0;
    return hash.toString(36);
})();
function assessDevice(gl, caveat) {
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    // With the probe's rules (the `p` number): decisions under older rules are redone.
    const key = `${gpu}|${screen.width}x${screen.height}@${devicePixelRatio}|${shaderVersion}|p2`;
    const forced = new URLSearchParams(location.search).get('render');
    if (forced === 'full' || forced === 'lite') return { gpu, key, mode: forced, reason: 'forced' };
    // The visitor's own choice (the graphics control, theme.js).
    let chosen = null;
    try { chosen = localStorage.getItem(RENDER_CHOICE_KEY); } catch {}
    if (chosen === 'full' || chosen === 'lite') return { gpu, key, mode: chosen, reason: 'chosen' };
    if (caveat || /swiftshader|llvmpipe|softpipe|basic render/i.test(gpu)) return { gpu, key, mode: 'lite', reason: 'software' };
    try {
        const saved = JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || 'null');
        if (saved && saved.key === key) return { gpu, key, mode: saved.mode, reason: 'remembered' };
    } catch {}
    return { gpu, key, mode: null, reason: null };
}
// A mode set by `?render=` or chosen by the visitor: kept whatever the probe,
// the compile time or the frames say.
const pinned = perf => perf.reason === 'forced' || perf.reason === 'chosen';
const RENDER_CHOICE_KEY = 'card-render';
function rememberMode(perf) {
    if (pinned(perf)) return;
    // A probe near the budget is not kept: a GPU busy with another window
    // for a moment must not leave a fast device on light 3D for good. Only a
    // device far over it (a mid-range phone: ten times) starts on light 3D
    // next time; the others are probed again.
    if (perf.reason === 'probe' && perf.mode === 'lite' && perf.probe?.estimate < STUDIO_BUDGET * 2) {
        try { localStorage.removeItem(PERFORMANCE_KEY); } catch {}
        return;
    }
    try { localStorage.setItem(PERFORMANCE_KEY, JSON.stringify({ key: perf.key, mode: perf.mode })); } catch {}
}
// The studio's card, estimated for a full frame at 2×, above which a device
// gets light 3D: with the backdrop and shadow, about 30 ms, 33 fps. A device
// that turns out slower while it runs still steps down (useLite, app.js).
const STUDIO_BUDGET = 24;
// How long the studio's shader may take to compile before the card starts on
// light 3D instead (create).
const COMPILE_LIMIT = 8000;

const ease = t => t * t * (3 - 2 * t);
const easeOutCubic = t => 1 - (1 - t) ** 3;
const easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
// Flip: accelerate, pass the target by a few degrees, settle — the plate has mass.
const mod2 = n => ((n % 2) + 2) % 2;
function flipCurve(t) {
    if (t < .78) return easeInOutCubic(t / .78) * 1.035;
    const k = (t - .78) / .22;
    return 1 + .035 * Math.cos(k * Math.PI / 2) ** 2 * (1 - k * .3) * (1 - ease(k));
}

export class CardRenderer {
    static async create(canvas) {
        const attributes = { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' };
        // Refused with a major performance caveat: the browser draws in software.
        let gl = canvas.getContext('webgl2', { ...attributes, failIfMajorPerformanceCaveat: true });
        const caveat = !gl;
        if (!gl) gl = canvas.getContext('webgl2', attributes);
        if (!gl) throw new Error('WebGL 2 unavailable');
        const perf = assessDevice(gl, caveat);
        // Light 3D already known: its module is fetched from the start.
        const card = cardFragment(perf.mode);
        // Let the loader reach the screen before compilation and warm-up start.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        performance.mark('card:create');
        // Only the card's own program: light 3D's is compiled if it comes to that.
        const passes = compilePrograms(gl, [[screenVertex, blurFragment], [screenVertex, compositeFragment],
            [shadowVertex, shadowFragment], [screenVertex, backdropFragment]]);
        let cardProgram = card.then(fragment => compilePrograms(gl, [[vertexSource, fragment]]));
        // A studio shader still compiling after COMPILE_LIMIT: start on light 3D.
        // Windows compiles WebGL through Direct3D, where a large shader can take
        // tens of seconds on the fastest GPU, and the page gave up and opened
        // the plain card. The driver finishes the studio's in the background and
        // caches it, and nothing is remembered: the next visit tries the studio.
        if (perf.mode !== 'lite' && !pinned(perf)) {
            const late = new Promise(resolve => setTimeout(resolve, COMPILE_LIMIT, null));
            cardProgram = Promise.race([cardProgram, late]).then(async programs => {
                if (programs) return programs;
                Object.assign(perf, { mode: 'lite', reason: 'compile' });
                return compilePrograms(gl, [[vertexSource, await cardFragment('lite')]]);
            });
        }
        const [images, programs] = await Promise.all([
            Promise.all([logoImage('ru'), logoImage('en')]),
            Promise.all([passes, cardProgram]).then(([shared, [program]]) => { performance.mark('card:compiled'); return [...shared, program]; }),
            loadCardFont().catch(() => {})
        ]);
        return new CardRenderer(canvas, gl, images, programs, perf).start();
    }

    // Shared by both backends once the renderer exists: probe, warm up, settle, hold.
    async start() {
        if (this.lite) this.pixelRatioCap = Math.min(this.pixelRatioCap, 2);
        this.resize();
        await this.layoutReady;
        performance.mark('card:relief');
        if (this.perf.mode === null) {
            await this.probe();
            performance.mark('card:probed');
        }
        await this.warmUp();
        // Light 3D is cheap everywhere: a short settle; the studio's is capped too.
        if (this.lite) await this.settle(300, 1000);
        else await this.settle(1000, 2500);
        // A deliberate pause: the loader holds for a moment even on fast devices,
        // then hands over to the intro.
        const hold = 1400 - performance.now();
        if (hold > 0) await new Promise(resolve => setTimeout(resolve, hold));
        performance.mark('card:ready');
        return this;
    }

    constructor(canvas, gl, images, programs, perf = { mode: 'full', reason: 'forced' }) {
        this.canvas = canvas;
        this.gl = gl;
        this.halfThickness = HALF_THICKNESS;
        this.images = images;
        // The card drawn (see assessDevice): `lite` for light 3D.
        this.perf = perf;
        this.lite = perf.mode === 'lite';
        if (globalThis.__cardLab) globalThis.__cardRenderer = this;
        this.lightSignature = null;
        // The frame's shader inputs by uniform name, worked out in draw() and
        // handed to whichever backend draws it.
        this.cardParams = {};
        this.backdropParams = {};
        this.output = [0, 0, 1];
        this.textures = [];
        this.engravingTextures = [];
        this.targets = [];
        // The layout drawn (vertical) and the one asked for (layoutVertical),
        // which may still be working out its relief (see rebuild).
        this.vertical = null;
        this.layoutVertical = null;
        this.layoutGeneration = 0;
        this.reliefGeneration = 0;
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
        // Render resolution: the screen's own up to 3× (see settle); `?dpr=2`
        // caps it, to compare.
        this.pixelRatioCap = Number(new URLSearchParams(location.search).get('dpr')) || 3;
        this.time = 0;
        this.keyLight = [-3, 4, 6];
        this.idleWeight = 0;
        this.hoverPointer = null;
        this.hoveredLink = null;
        this.wantsHighFrameRate = false;
        // Intro choreography: the plate turns in from the dark while a light sweeps across.
        this.intro = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0;
        this.introTime = 0;
        this.setupGraphics(programs);
    }

    setupGraphics(programs) {
        const gl = this.gl;
        let program;
        [this.blurProgram, this.compositeProgram, this.shadowProgram, this.backdropProgram, program] = programs;
        // Card programs, the studio's and light 3D's, as far as compiled (cardProgram).
        this.cards = { [this.lite ? 'lite' : 'full']: { program, setUniforms: uniformSetter(gl, program) } };
        this.setBackdropUniforms = uniformSetter(gl, this.backdropProgram);
        this.shadowUniforms = Object.fromEntries(['uModel', 'uProjection', 'uLight'].map(name => [name, gl.getUniformLocation(this.shadowProgram, name)]));
        // Fixed in the vertex shader (layout), the same for every card program.
        this.attributes = { aPosition: 0, aNormal: 1, aUV: 2 };
        this.blurUniforms = { source: gl.getUniformLocation(this.blurProgram, 'uSource'), step: gl.getUniformLocation(this.blurProgram, 'uStep') };
        this.compositeUniforms = { near: gl.getUniformLocation(this.compositeProgram, 'uNear'),
            wide: gl.getUniformLocation(this.compositeProgram, 'uWide'), strength: gl.getUniformLocation(this.compositeProgram, 'uStrength'),
            space: gl.getUniformLocation(this.compositeProgram, 'uGlowSpace') };
        this.bufferStorage = null;
        this.screenArray = gl.createVertexArray();
        this.buffers = [];
        this.arrays = [];
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this.anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
    }

    // Wait until the GPU has drawn what was sent.
    finish() {
        this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array(4));
    }

    // Can this GPU draw the studio? Its card, at 2×, only in a band across the
    // plate through the name (gl.scissor): letters are where it is costliest.
    // The first draws carry the driver's one-off work (the program finished on
    // first use, textures just uploaded) and a GPU still at idle clocks: two go
    // untimed, then up to six are timed one by one and the fastest counts. The
    // band's cost scaled to the plate's height estimates the whole card. Well
    // under a tenth of a second on a fast GPU or a slow one (which stops early).
    // Over budget, light 3D is fetched and compiled.
    async probe() {
        const gl = this.gl, cap = this.pixelRatioCap;
        this.pixelRatioCap = Math.min(cap, 2);
        this.resize();
        this.draw({ rx: 0, ry: 0, rz: 0, zoom: 1, flipped: false, animate: false, reduced: true, delta: 1 / 60, paint: false });
        const { width, height } = this.canvas, m = this.model, focal = this.projection[5];
        const screenY = (x, y) => {
            const z = this.halfThickness;
            const wy = m[1] * x + m[5] * y + m[9] * z + m[13], wz = m[2] * x + m[6] * y + m[10] * z + m[14] - 7;
            return (focal * wy / -wz * .5 + .5) * height;
        };
        const ys = this.outline.map(([x, y]) => screenY(x, y));
        const bottom = Math.max(0, Math.min(...ys)), top = Math.min(height, Math.max(...ys));
        const title = this.surfaces[0].titleRelief;
        const line = screenY(0, (.5 - (title[1] + title[3]) / 2) * this.height);
        const band = Math.max(8, Math.min(top - bottom, Math.round(height / 8)));
        const from = Math.round(Math.max(bottom, Math.min(top - band, line - band / 2)));
        const scale = (top - bottom) / band;
        const drawBand = card => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, width, height);
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(0, from, width, band);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.useProgram(card.program);
            card.setUniforms(this.cardParams);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            this.drawCard(0, null, card);
            gl.disable(gl.BLEND);
            gl.disable(gl.SCISSOR_TEST);
        };
        const estimate = card => {
            for (let i = 0; i < 2; i++) {
                drawBand(card);
                this.finish();
            }
            let bandMs = Infinity;
            for (let i = 0; i < 6; i++) {
                const start = performance.now();
                drawBand(card);
                this.finish();
                bandMs = Math.min(bandMs, performance.now() - start);
                // Far over the budget: nothing to wait for.
                if (i >= 1 && bandMs * scale > STUDIO_BUDGET * 3) break;
            }
            return Math.round(bandMs * scale * 10) / 10;
        };
        this.perf.probe = { estimate: estimate(this.cards.full) };
        this.pixelRatioCap = cap;
        await this.useMode(this.perf.probe.estimate > STUDIO_BUDGET ? 'lite' : 'full', 'probe');
    }

    // A card's program (see cardFragment), fetched and compiled once.
    cardProgram(mode) {
        this.cards[mode] ??= cardFragment(mode)
            .then(fragment => compilePrograms(this.gl, [[vertexSource, fragment]]))
            .then(([program]) => ({ program, setUniforms: uniformSetter(this.gl, program) }))
            .catch(error => { delete this.cards[mode]; throw error; });
        return Promise.resolve(this.cards[mode]);
    }

    // The card from now on: after the probe, or light 3D when a warm phone
    // slows the studio down while it runs (useLite). Its program is ready
    // (cardProgram); a module that failed to load leaves the card as it was.
    async useMode(mode, reason) {
        const card = await this.cardProgram(mode).catch(() => null);
        if (!card) return;
        this.cards[mode] = card;
        this.lite = mode === 'lite';
        this.perf.mode = mode;
        this.perf.reason = reason;
        rememberMode(this.perf);
        if (this.lite) this.pixelRatioCap = Math.min(this.pixelRatioCap, 2);
        this.resize();
        // The graphics control (theme.js) shows once the card is on light 3D.
        window.dispatchEvent(new CustomEvent('card-mode', { detail: mode }));
    }

    // Light 3D from now on, when a warm phone slows the studio down while it
    // runs (app.js): once its module is in. There is no way back until reload,
    // and `?render=full` keeps the studio whatever the frames do.
    useLite(reason) {
        if (this.lite || pinned(this.perf) || this.switching) return;
        this.switching = this.useMode('lite', reason).finally(() => { this.switching = null; });
    }

    // Drivers finish shader and pipeline work lazily, on first use. Draw the full
    // pipeline for both faces while the canvas is still hidden, then wait for
    // the GPU, so the intro starts on warm, full-rate frames.
    warmUp() {
        for (const flipped of [false, true]) {
            this.draw({ rx: 0, ry: 0, rz: 0, zoom: 1, flipped, animate: false, reduced: true, delta: 1 / 60 });
        }
        this.flipAngle = this.flipFrom = this.flipTarget = 0;
        this.spin = null;
        this.flipProgress = 1;
        const done = this.finish();
        performance.mark('card:warm');
        return done;
    }

    // Keep rendering hidden frames until their cost stops falling: drivers finish
    // deferred compilation, the GPU clocks up and uploads complete. Only then is
    // the scene shown and the intro clock started. The loader covers this time.
    async settle(minimum = 1000, limit = 4000) {
        const intervals = [];
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
            if (frames < 3) await this.finish();
            frames++;
            // The first finished frame is the studio the intro opens on, the plate
            // still at zero opacity: the loader can stand on it instead of on a
            // flat colour that the lit backdrop then replaced. (Without the intro
            // the plate is already opaque here, and these frames flip it.)
            if (frames === 1 && this.intro < 1) document.documentElement.classList.add('webgl-stage');
            if (now - start < minimum || intervals.length < 16) continue;
            // Steady: the last frames arrive at the best cadence seen so far.
            const recent = intervals.slice(-12);
            const best = Math.min(...intervals.slice(3));
            if (median(recent) <= best * 1.2 + 1 && Math.max(...recent) <= median(recent) * 1.5 + 2) break;
        }
        // Phones get their screen's own resolution, 3×: role and contacts are two
        // or three pixels a stroke, and at 2× they could neither show their relief
        // nor stay sharp on a turned card. A GPU that cannot draw such a frame well
        // inside a 60 fps budget falls back to 2×. Timed by a burst ended with a
        // read-back, not by frame intervals: iOS in Low Power Mode holds those at
        // 30 fps whatever the GPU could do.
        const burst = async () => {
            await this.finish();
            const from = performance.now();
            for (let i = 0; i < 6; i++) this.draw({ rx: 0, ry: 0, rz: 0, zoom: 1, flipped: false, animate: false, reduced: true, delta: 1 / 60 });
            await this.finish();
            return (performance.now() - from) / 6;
        };
        const ratio = () => Math.min(devicePixelRatio || 1, this.pixelRatioCap);
        let cost = await burst();
        // A burst can catch the GPU still busy with the page's own start-up work:
        // only a device that is slow every time falls back.
        for (let retry = 0; retry < 2 && ratio() > 2 && cost > 12; retry++) cost = Math.min(cost, await burst());
        if (ratio() > 2 && cost > 12) {
            this.pixelRatioCap = 2;
            this.resize();
            cost = await burst();
        }
        this.flipAngle = this.flipFrom = this.flipTarget = 0;
        this.spin = null;
        this.flipProgress = 1;
        const recent = intervals.slice(-12);
        this.settleStats = { frames, total: performance.now() - start, interval: median(recent), first: intervals[1] || 0, last: median(recent),
            ratio: ratio(), cost };
    }

    resize() {
        // Layout size, not the transformed screen rect: a CSS transform on the
        // scene (the lab's mobile sheet) must not change the render resolution.
        const rect = { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
        const dpr = Math.min(devicePixelRatio || 1, this.pixelRatioCap);
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
        this.touchLandscape = touchLandscape;
        // Safe-area insets in CSS px, read from a probe styled with env().
        let probe = document.querySelector('.safe-probe');
        if (!probe) {
            probe = Object.assign(document.createElement('div'), { className: 'safe-probe' });
            probe.setAttribute('aria-hidden', 'true');
            probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
                + 'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
            document.body.append(probe);
        }
        const insets = getComputedStyle(probe);
        this.safeInsets = { top: parseFloat(insets.paddingTop) || 0, bottom: parseFloat(insets.paddingBottom) || 0 };
        if (vertical !== this.layoutVertical) this.rebuild(vertical);
        this.updateProjection();
        this.resizeTargets(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)));
    }

    // Desktop draws the plate at a fixed pixel size: the original card's
    // 545 px wide (320 px in a narrow window) at the default card size .8.
    updateProjection() {
        if (!this.width) return;
        this.fixedCardWidth = matchMedia('(pointer: coarse)').matches ? 0 : (this.vertical ? 320 : 545) / .8;
        const focalLength = this.fixedCardWidth
            ? 14 * this.fixedCardWidth / (this.width * this.viewportHeight) : undefined;
        this.projection = projectionMatrix(this.aspect, focalLength);
    }

    // The drawing buffer for the lab's «Широкий цвет» and «Блики ярче белого»:
    // Display P3, and a half-float buffer shown in extended range. At 0 both
    // leave the browser's default 8-bit sRGB buffer untouched.
    applyOutput() {
        const gl = this.gl, lab = globalThis.__cardLab, support = this.support ??= outputSupport();
        const wide = support.p3 && lab?.wide > 0;
        const space = wide ? 'display-p3' : 'srgb';
        if (support.p3 && gl.drawingBufferColorSpace !== space) gl.drawingBufferColorSpace = space;
        const hdr = support.hdr && !this.hdrFailed && lab?.hdr > 0;
        const { width, height } = this.canvas;
        // Once set, the storage is kept at the canvas's size; resizing the
        // canvas is not guaranteed to keep the format.
        if (hdr || this.bufferStorage) {
            const format = hdr ? gl.RGBA16F : gl.RGBA8, key = `${format} ${width} ${height}`;
            if (this.bufferStorage !== key) {
                try {
                    // A half-float buffer needs float rendering switched on first.
                    if (hdr && !gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float');
                    gl.drawingBufferStorage(format, width, height);
                    if (gl.drawingBufferFormat !== format) throw new Error(`drawing buffer format ${gl.drawingBufferFormat}`);
                    const mode = hdr ? 'extended' : 'standard';
                    if (gl.drawingBufferToneMapping) gl.drawingBufferToneMapping({ mode });
                    else this.canvas.configureHighDynamicRange({ mode: hdr ? 'extended' : 'default' });
                    this.bufferStorage = key;
                } catch (error) {
                    // Tried once: the lab's slider then does nothing, as without the API.
                    console.warn('HDR output unavailable', error);
                    this.hdrFailed = hdr;
                    this.bufferStorage = null;
                }
            }
        }
        // Headroom: up to 4× the page's white where the screen allows.
        this.output = [wide ? 1 : 0, wide ? lab.wide : 0, hdr && this.bufferStorage ? 1 + 3 * lab.hdr : 1];
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

    // Setup lamps as uniform arrays; worked out only when the setup or key changes.
    // `size` scales every lamp; the light it emits (area × intensity) stays the same.
    uploadLights(setup, keyShape, keyGain, size) {
        const c = this.cardParams;
        const warmth = globalThis.__cardLab?.warmth ?? 0;
        const signature = `${setup.title}|${keyShape.title}|${keyGain}|${size}|${warmth}`;
        const toned = color => color === 'fill' ? tinted3(toneOf(color), coolTint(warmth))
            : color === 'key' || !color ? tinted3(toneOf(color), warmTint(warmth)) : toneOf(color);
        if (this.lightSignature === signature) return;
        this.lightSignature = signature;
        const key = panel(setup.key.c, keyShape.roll, keyShape.size, [0, 0, 0]);
        c.uKeyCenter = key.c;
        c.uKeyRight = key.right;
        c.uKeyUp = key.up;
        c.uKeyColor = scale(toned(setup.key.color), setup.key.power);
        const count = Math.min(MAX_LIGHTS, setup.lights.length);
        const pack = read => new Float32Array(setup.lights.slice(0, count).flatMap(read));
        c.uLightCount = count;
        c.uLoopCounts = LOOP_COUNTS;
        c.uLightCenter = pack((_, i) => setup.lamps[i].c);
        c.uLightRight = pack((_, i) => setup.lamps[i].right);
        c.uLightUp = pack((_, i) => setup.lamps[i].up);
        c.uLightShape = pack(light => [...scale(light.size, size), light.shape === 'rect' ? 0 : -1]);
        c.uLightColor = pack(light => scale(toned(light.color), light.power * (light.wrap ? keyGain : 1) / size ** 2));
        c.uLightFace = pack((light, i) => [light.face ?? faceSees(setup.lamps[i].c)]);
    }

    // Touch screens: the backdrop sits in a fixed dark frame. The safe areas
    // (status bar, home indicator) are flat dark, then a 160 px ramp leads into
    // the lit backdrop — the same distance at the top and at the bottom. The dark
    // colour is a constant per backdrop and also goes to the page, the scene and
    // thin fixed edge strips: Safari (iOS 26) tints its bars from those, once.
    applyEdges(backdrop) {
        if (!matchMedia('(pointer: coarse)').matches) { this.edges = null; return; }
        const height = this.viewportHeight, { top, bottom } = this.safeInsets || { top: 0, bottom: 0 };
        const key = `${backdrop.edge}:${height}:${top}:${bottom}`;
        if (key === this.edgeKey) return;
        this.edgeKey = key;
        const ramp = 160, pad = 8;
        const rgb = [1, 3, 5].map(i => parseInt(backdrop.edge.slice(i, i + 2), 16) / 255);
        this.edges = { fade: [(top + pad) / height, (bottom + pad) / height, ramp / height, ramp / height], top: rgb, bottom: rgb };
        if (backdrop.edge === this.edgeCss) return;
        this.edgeCss = backdrop.edge;
        const color = backdrop.edge;
        document.documentElement.style.backgroundColor = color;
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

    deleteTargets() {
        const gl = this.gl;
        this.targets.forEach(target => {
            gl.deleteTexture(target.texture);
            gl.deleteFramebuffer(target.framebuffer);
            if (target.renderbuffer) gl.deleteRenderbuffer(target.renderbuffer);
        });
        this.targets = [];
    }

    // The upright or landscape plate: meshes, text and relief. The relief is
    // worked out in workers (relief.js); until it is ready the layout before
    // keeps drawing, then all of it changes at once. A newer request wins.
    rebuild(vertical) {
        const generation = ++this.layoutGeneration, reliefGeneration = ++this.reliefGeneration;
        this.layoutVertical = vertical;
        const width = vertical ? 4.235 * 300 / portraitHeight : 4.235;
        const height = vertical ? 4.235 : 2.333;
        const surfaces = ['ru', 'en'].map((lang, i) => textureCanvas(lang, vertical, this.images[i], this.maxTextureSize));
        this.layoutReady = this.makeRelief(surfaces).then(relief => {
            if (generation !== this.layoutGeneration) return;
            this.vertical = vertical;
            this.width = width;
            this.height = height;
            this.outline = roundedOutline(width, height, vertical);
            const meshes = geometry(width, height, vertical);
            this.counts = meshes.map(mesh => mesh.length / 8);
            this.uploadMeshes(meshes);
            this.deleteTextures(this.textures);
            this.surfaces = surfaces;
            this.textures = surfaces.map(({ canvas }) => this.uploadTexture(canvas));
            this.applyRelief(relief);
            // A depth changed on the stand meanwhile: its relief was for the old text.
            if (reliefGeneration !== this.reliefGeneration) this.buildRelief();
            this.updateProjection();
        });
        return this.layoutReady;
    }

    // Face, back and rim: position, normal and UV, 32 bytes a vertex.
    uploadMeshes(meshes) {
        const gl = this.gl;
        this.buffers.forEach(buffer => gl.deleteBuffer(buffer));
        this.arrays.forEach(array => gl.deleteVertexArray(array));
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
    }

    // A mipmapped RGBA texture from a canvas, or from bytes of the given size.
    uploadTexture(source, width, height) {
        const gl = this.gl;
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
    }

    deleteTextures(textures) {
        textures.forEach(texture => this.gl.deleteTexture(texture));
    }

    // Card text changed on the demo stand: redraw textures, relief and links.
    refreshText() {
        return this.rebuild(this.layoutVertical);
    }

    // Relief maps only; the demo stand calls this when a depth slider moves.
    buildRelief() {
        const generation = ++this.reliefGeneration, surfaces = this.surfaces;
        return this.makeRelief(surfaces).then(relief => {
            if (generation === this.reliefGeneration && surfaces === this.surfaces) this.applyRelief(relief);
        });
    }

    // The surfaces' relief maps with the profiles as they are now. Light 3D
    // draws no relief: none are made (the studio never comes back after it).
    async makeRelief(surfaces) {
        const profiles = reliefProfiles();
        return { profiles, maps: this.lite ? [] : await createReliefMaps(surfaces, profiles) };
    }

    applyRelief({ profiles, maps }) {
        this.deleteTextures(this.engravingTextures);
        this.raisedHeight = [profiles.name.shape === 'raised' ? profiles.name.depth : 0,
            profiles.logo.shape === 'raised' ? profiles.logo.depth : 0,
            profiles.text && profiles.text.shape === 'raised' ? profiles.text.depth : 0];
        // How the shader shapes the distance map: full slope and direction per region.
        const regions = [profiles.name, profiles.logo, profiles.text];
        this.reliefSlope = regions.map(profile => profile ? profile.depth / profile.bevel : 0);
        this.reliefWidth = regions.map(profile => profile ? profile.bevel : 1);
        this.reliefHas = regions.map(profile => profile ? 1 : 0);
        this.reliefSign = regions.map(profile => profile && profile.shape === 'raised' ? 1 : -1);
        this.bevelCurve = regions.find(profile => profile && profile.shape === 'raised')?.curve ?? 0;
        this.engravingTextures = maps.map(relief => this.uploadTexture(relief.data, relief.width, relief.height));
    }

    // `paint: false` works out the frame's inputs without drawing it (probe).
    draw({ rx, ry, rz = 0, zoom, dragging = false, flipped, animate, idle = true, freezeTilt = false, freezeHover = false, focusLink = null, reduced, delta, paint = true }) {
        const dt = Math.min(delta, 0.05);
        if (animate) this.time += dt;
        if (animate && this.intro < 1) {
            this.introTime += dt;
            this.intro = Math.min(1, this.introTime / 3.2);
        }
        const introPose = 1 - easeOutCubic(clamp01(this.introTime / 2.4));
        const introLight = 1 - easeInOutCubic(this.intro);
        const introFade = this.intro >= 1 ? 1 : ease(clamp01(this.introTime / .9));
        // The shadow comes with the plate: arriving seconds later, it slid in
        // under a card that had hung ungrounded (see the shadow's light below).
        const shadowFade = introFade;

        // Demo stand overrides (only present on /lab/).
        const lab = globalThis.__cardLab;
        this.wantsHighFrameRate = Boolean(lab && !lab.exported) || (this.intro < 1 && !reduced);

        const lightPhase = this.time * Math.PI * 2 / variation.lightPeriod + variation.lightPhase;
        // The light orbit widens the key's path into a broad figure in front of
        // the card, across and up and down, and brings in the back light.
        const orbit = lab ? lab.orbit : (direction.orbit ?? 0);
        this.orbit = orbit;
        let settledYaw = Math.sin(lightPhase) * (.20 + .45 * orbit) * variation.lightTravel;
        let settledPitch = Math.sin(lightPhase * .8 + .7) * (.08 + .22 * orbit);
        if (lab && lab.manualLight) { settledYaw = lab.yaw; settledPitch = lab.pitch; }
        // The intro sweeps the key in from the side.
        const lightYaw = settledYaw + (lab && lab.manualLight ? 0 : introLight * 1.15 * variation.introSweep * variation.introSide);
        const lightPitch = settledPitch - (lab && lab.manualLight ? 0 : introLight * .12);
        // The room turns with the light path, so reflections slide across the
        // plate as on a physical card turned under lamps.
        this.room = roomMatrix(lightYaw, lightPitch);
        // Shadow and background follow the key: world key = roomᵀ · key.
        const setup = LIGHT_SETUPS[lab ? lab.lightSetup : direction.lightSetup] || Object.values(LIGHT_SETUPS)[0];
        this.lightSetup = setup;
        const r = this.room, k = setup.shadowDirection;
        const toWorld = m => [m[0] * k[0] + m[1] * k[1] + m[2] * k[2], m[3] * k[0] + m[4] * k[1] + m[5] * k[2], m[6] * k[0] + m[7] * k[1] + m[8] * k[2]];
        const keyWorld = toWorld(r);
        this.keyDirection = keyWorld;
        // The card's shadow falls from where the key settles, not from the
        // intro's sweep: from far off to the side it lay beside the card and
        // drove in under it as the light came round. Now it is under the card
        // from the first frame and turns with it; the sweep still shows in the
        // reflections and the backdrop's pool of light.
        this.keyLight = toWorld(roomMatrix(settledYaw, settledPitch)).map(value => value * 8);

        const idleTarget = animate && idle && !dragging ? 1 : 0;
        if (reduced) this.idleWeight = 0;
        else if (!freezeTilt) this.idleWeight += (idleTarget - this.idleWeight) * (1 - Math.exp(-dt * (idleTarget ? 1.6 : 10)));
        const idleTime = this.time * variation.idleSpeed;
        const idleStrength = variation.idleAmplitude * this.idleWeight * (this.touchLandscape ? .60 : this.vertical ? .85 : 1)
            * (lab ? lab.idle : 1);
        const breathX = (Math.sin(idleTime * .56 + variation.phaseX) * .10
            + Math.sin(idleTime * .89 + variation.phaseY) * .022) * idleStrength;
        const breathY = (Math.cos(idleTime * .43 + variation.phaseY) * .145
            + Math.sin(idleTime * .71 + variation.phaseX + .9) * .025) * idleStrength;
        let flipDepth;
        if (this.spin) {
            flipDepth = this.stepSpin(dt, reduced);
        } else {
            // The flip angle is unbounded (a spin can end several turns away): the
            // side is its parity. A tap or a key turns the plate on by half a turn.
            const side = mod2(Math.round(this.flipTarget / Math.PI));
            if (side !== (flipped ? 1 : 0)) {
                this.flipFrom = this.flipAngle;
                this.flipTarget += Math.PI;
                this.flipProgress = 0;
            }
            this.flipProgress = reduced ? 1 : Math.min(1, this.flipProgress + dt / 1.5);
            const progress = this.flipProgress;
            this.flipAngle = progress >= 1 ? this.flipTarget : this.flipFrom + (this.flipTarget - this.flipFrom) * flipCurve(progress);
            // The plate comes toward the viewer while it turns over.
            flipDepth = progress >= 1 ? 0 : Math.sin(Math.PI * Math.min(1, progress / .85)) * .45;
        }
        const targetX = variation.poseX + (reduced ? 0 : rx * Math.PI / 180 + breathX);
        const targetY = variation.poseY + (reduced ? 0 : ry * Math.PI / 180 + breathY);
        // A tall portrait plate shows any roll as a slanted left edge of the text:
        // it keeps its tilt and sway but no resting or idle roll.
        const roll = this.vertical ? 0 : 1;
        const targetZ = roll * variation.poseZ + (reduced ? 0 : rz * Math.PI / 180 + Math.sin(idleTime * .36 + variation.phaseZ) * .025 * idleStrength * roll);
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
        // The lab's card size scales the plate; the default .8 is the original size.
        const size = lab ? lab.cardSize : (direction.cardSize ?? .8);
        const wide = this.width * pixelsPerUnit, tall = this.height * pixelsPerUnit;
        // The original card's size — 545 × 300 px, 320 × 545 upright (narrow
        // windows, phones) — shrunk as a whole only where the screen is smaller.
        const target = (this.vertical ? 320 : 545) * size / .8;
        const insets = this.safeInsets ? this.safeInsets.top + this.safeInsets.bottom : 0;
        const [padX, padY] = this.fixedCardWidth ? [this.vertical ? 56 : 96, 192]
            : this.vertical ? [24, 96 + insets] : this.touchLandscape ? [64, 108] : [96, 192];
        const plateScale = Math.min(target / wide, (this.viewportWidth - padX) / wide, (this.viewportHeight - padY) / tall);
        if (reduced) { this.zoom = zoom; this.zoomVelocity = 0; }
        else [this.zoom, this.zoomVelocity] = follow(this.zoom, this.zoomVelocity, zoom, 10, dt);
        const lift = this.lift + (this.touchLandscape ? 24 / pixelsPerUnit : 0) - introPose * .18;
        // The plate turns in from slightly in front, never behind the backdrop.
        const tilt = modelMatrix(this.rotationX + introPose * variation.introTip, this.rotationY - introPose * variation.introTurn * variation.introSide,
            this.zoom * plateScale * (1 - introPose * .06), lift, this.rotationZ + introPose * variation.introRoll, flipDepth + introPose * variation.introDepth);
        const flip = modelMatrix(this.vertical ? 0 : this.flipAngle, this.vertical ? this.flipAngle : 0, 1, 0);
        this.model = multiplyMatrices(tilt, flip);
        this.hoveredLink = this.hoverPointer && !dragging && !freezeHover
            ? this.linkAt(this.hoverPointer.x, this.hoverPointer.y) : null;

        // The frame's shader inputs (see cardParams).
        const c = this.cardParams;
        c.uModel = this.model;
        c.uProjection = this.projection;
        c.uRoom = this.room;
        c.uExposure = look.studio.exposure * (lab ? lab.exposure : 1);
        this.applyOutput();
        c.uOutput = this.output;
        c.uKeyDirection = this.keyDirection;
        // Light 3D's flat plate and rim (lite.js): the edition's own, or its
        // metal's reflectance taken as a colour (about the studio's tone).
        c.uLitePlate = plate.lite?.plate || plate.f0 || [.5, .5, .5];
        c.uLiteRim = plate.lite?.rim || [.35, .9];
        // The plate is solid within a third of a second and lit over the
        // intro's fade: it comes out of the dark as a black shape the light
        // finds, not a translucent ghost of itself over the studio.
        c.uOpacity = this.intro >= 1 ? 1 : ease(clamp01(this.introTime / .3));
        c.uReveal = introFade;
        const backdrop = BACKDROPS[(lab && lab.backdrop) || defaultBackdrop] || null;
        this.backdrop = backdrop;
        c.uRoomBase = backdrop ? backdrop.roomBase : 0;
        c.uBounce = (backdrop ? backdrop.bounce : 1) * setup.bounce;
        const keyShape = KEY_SHAPES[lab ? lab.keyShape : direction.keyShape] || KEY_SHAPES.round;
        c.uRoundLights = (lab ? lab.lamps : (direction.lamps || 'round')) === 'capsule' ? 0 : 1;
        const keyGain = (lab ? lab.keyGain : (direction.keyGain ?? .7)) * keyShape.gain;
        const lampSize = lab ? lab.lampSize : (direction.lampSize ?? 1);
        c.uKeyGain = keyGain / lampSize ** 2;
        this.uploadLights(setup, keyShape, keyGain, lampSize);
        // The back light circles the card square to the view, once in ~7 s.
        const orbitAngle = this.time * Math.PI * 2 / 7 + variation.lightPhase;
        const back = panel([Math.cos(orbitAngle), Math.sin(orbitAngle) * .8, .05], 0, [.2, .2], [0, 0, 0]);
        c.uOrbitCenter = back.c;
        c.uOrbitRight = back.right;
        c.uOrbitUp = back.up;
        const warmth = lab ? lab.warmth : 0;
        c.uOrbitColor = scale(tinted3(toneOf('key'), coolTint(warmth)), 22 * this.orbit * this.orbit);
        c.uFillTint = coolTint(warmth);
        c.uStrip = scale(tinted3(toneOf('key'), warmTint(warmth)), STRIP_POWER * (lab ? lab.strip : 0));
        c.uKeySize = scale(keyShape.size, lampSize);
        c.uKeyRadius = keyShape.radius * lampSize;
        c.uKeySoft = lab ? lab.keySoft : (direction.keySoft ?? .05);
        c.uRaisedHeight = this.raisedHeight;
        c.uReliefSlope = this.reliefSlope;
        c.uReliefSign = this.reliefSign;
        c.uBevelCurve = this.bevelCurve;
        // Alpha: 0 — the process's own metal, 1 — a colour, 2 — the plate's material.
        const tintOf = hex => {
            if (!hex) return [0, 0, 0, 0];
            if (hex === 'plate') return [0, 0, 0, 2];
            const linear = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
            return [0, 2, 4].map(i => linear(parseInt(hex.slice(i, i + 2), 16) / 255)).concat(1);
        };
        const logoTint = lab ? lab.logoTint : direction.logoTint;
        const firstTint = lab ? lab.logoFirstTint : (direction.logoFirstTint ?? 'same');
        c.uLogoTint = tintOf(logoTint);
        // `same` follows the rest of the wordmark; '' is bare metal.
        c.uLogoFirstTint = tintOf(firstTint === 'same' ? logoTint : firstTint);
        c.uNameTint = tintOf(lab ? lab.nameTint : direction.nameTint);
        c.uBodyTint = tintOf(lab ? lab.bodyTint : direction.bodyTint);
        const finishes = lab ? lab.finish : (direction.finish || {});
        c.uTintFinish = ['logoFirst', 'logo', 'name', 'body'].map(key => finishes[key] === 'anod' ? 1 : 0);
        c.uTextMute = lab ? lab.textMute : (direction.textMute ?? .3);
        c.uMute = [lab ? lab.logoMute : 0, lab ? lab.nameMute : 0];
        c.uLetterGlow = lab ? lab.letterGlow : (direction.letterGlow ?? 1);
        c.uTintAmount = lab ? ['logoFirst', 'logo', 'name', 'body'].map(key => 1 - lab[`${key}Sheer`]) : [1, 1, 1, 1];
        c.uGloss = lab ? [lab.logoGloss, lab.nameGloss, lab.bodyGloss] : [1, 1, 1];
        c.uFinish = lab ? lab.plateFinish : 0;
        c.uSurface = lab ? lab.surface : 1;
        // A glint is a point of light far smaller than a pixel, drawn as about
        // one. On a Retina screen that pixel is at the edge of sight and the
        // glints read as fine glitter; a standard-density pixel is two to three
        // times larger, and the same glints read as dust on the plate. The
        // glint's light is the same on any screen: over a larger pixel it is
        // dimmer, by the pixel's area against a Retina one.
        const density = Math.min(1, (this.canvas.width / this.viewportWidth / 2) ** 2);
        c.uSparkle = (lab ? lab.sparkle : 0) * density;
        c.uTexture = 0;
        c.uEngraving = 1;
        this.bloomStrength = lab ? lab.bloom : .3;
        if (backdrop) {
            this.applyEdges(backdrop);
            const edge = this.edges || { fade: [0, 0, 0, 0], top: [0, 0, 0], bottom: [0, 0, 0] };
            // The pool sits behind the card, offset towards the key light.
            const k = this.keyDirection;
            Object.assign(this.backdropParams, {
                uShadow: 0, uResolution: [this.canvas.width, this.canvas.height],
                uWall: backdrop.wall, uFloor: backdrop.floor, uPoolColor: backdrop.pool, uPoolFalloff: backdrop.poolFalloff ?? 2.6, uVignette: backdrop.vignette ?? .55,
                uGrain: backdrop.grain, uShadowStrength: backdrop.shadow, uTime: reduced ? 0 : this.time,
                uEdgeFade: edge.fade, uEdgeTop: edge.top, uEdgeBottom: edge.bottom,
                // Light 3D casts no shadow (render skips it).
                uPool: [.5 + k[0] * .45, .5 + k[1] * .40], uShadowFade: this.lite ? 0 : shadowFade, uOutput: this.output
            });
        }
        if (paint) this.render(backdrop, focusLink);

        this.matchSafeAreas(backdrop);
        return this.intro < 1 || this.flipProgress < 1 || Boolean(this.spin) || Math.abs(targetX - this.rotationX) + Math.abs(targetY - this.rotationY)
            + Math.abs(zoom - this.zoom) + Math.abs(this.zoomVelocity)
            + Math.abs(targetZ - this.rotationZ) + Math.abs(this.velocityZ)
            + Math.abs(this.velocityX) + Math.abs(this.velocityY) > .0005;
    }

    // One face's shader inputs: 0 the front, 1 the back, 2 the rim.
    faceParams(i, focusLink) {
        const side = i === 1 ? 1 : 0, surface = this.surfaces[side];
        const hover = this.hoveredLink;
        return {
            uEdge: i === 2 ? 1 : 0,
            uUVBasis: [i === 1 && this.vertical ? -1 : 1, i === 1 && !this.vertical ? 1 : -1],
            uLayoutSize: [surface.width, surface.height],
            uLogoRect: surface.logoRelief,
            uTitleRect: surface.titleRelief,
            uTextRect: surface.textRelief,
            uLogoScale: surface.logoScale,
            uReliefWidth: [this.reliefWidth[0], this.reliefWidth[1] * surface.logoScale, this.reliefWidth[2]],
            uReliefHas: this.reliefHas,
            // The spun centre sits in empty metal: the arrow of either layout.
            uBrushCenter: (this.vertical ? plate.centerPortrait : plate.center) || [.5, .5],
            uHoverRect: hover && hover.side === i && hover.underlineY != null
                ? [hover.x / surface.width, hover.underlineY / surface.height, (hover.x + hover.width) / surface.width, (hover.underlineY + 1) / surface.height]
                : [-2, -2, -1, -1],
            uFocusRect: focusLink && focusLink.side === i
                ? [focusLink.x / surface.width, focusLink.y / surface.height, (focusLink.x + focusLink.width) / surface.width, (focusLink.y + focusLink.height) / surface.height]
                : [-2, -2, -1, -1]
        };
    }

    // The frame worked out in draw(), drawn with WebGL.
    render(backdrop, focusLink) {
        const gl = this.gl;
        const [bright, blurA, wideA, wideB, shadowA, shadowB] = this.targets;
        const pass = (source, target, x, y) => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
            gl.viewport(0, 0, target.width, target.height);
            gl.bindTexture(gl.TEXTURE_2D, source.texture);
            gl.uniform2f(this.blurUniforms.step, x / source.width, y / source.height);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        const card = this.cards[this.lite ? 'lite' : 'full'];
        // Light 3D has no glow: straight to the backdrop.
        if (!this.lite) {
            gl.useProgram(card.program);
            card.setUniforms(this.cardParams);

            // 1. Highlights above white at quarter resolution.
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
            pass(bright, blurA, 1, 0);
            pass(blurA, bright, 0, 1);
            pass(bright, wideA, 1.5, 0);
            pass(wideA, wideB, 0, 1.5);
            pass(wideB, wideA, 2.5, 0);
            pass(wideA, wideB, 0, 2.5);
        } else gl.disable(gl.DEPTH_TEST);
        if (backdrop && !this.lite) {
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
        // 3. Backdrop, then the card at full resolution with native MSAA.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (backdrop) {
            gl.useProgram(this.backdropProgram);
            gl.bindVertexArray(this.screenArray);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, shadowA.texture);
            this.setBackdropUniforms(this.backdropParams);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(card.program);
        if (this.lite) card.setUniforms(this.cardParams);
        // Over the backdrop, premultiplied: the plate's opacity (the intro's
        // fade) blends it into the studio. Written unblended, a fading plate
        // punched a hole in the scene down to the page colour — a dark
        // silhouette that the card then filled. Opaque, the result is the same.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.drawCard(0, focusLink);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        if (this.lite) {
            gl.bindVertexArray(null);
            gl.activeTexture(gl.TEXTURE0);
            return;
        }
        // 4. Glow over the card and the page, screen-blended.
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
        gl.uniform1f(this.compositeUniforms.strength, this.bloomStrength);
        gl.uniformMatrix3fv(this.compositeUniforms.space, false, this.output[0] ? SRGB_TO_P3 : IDENTITY3);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
        gl.activeTexture(gl.TEXTURE0);
    }

    drawCard(bloomPass, focusLink, card = this.cards[this.lite ? 'lite' : 'full']) {
        const gl = this.gl, setUniforms = card.setUniforms;
        setUniforms({ uBloomPass: bloomPass });
        for (let i = 0; i < 3; i++) {
            gl.bindVertexArray(this.arrays[i]);
            const side = i === 1 ? 1 : 0;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures[side]);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.engravingTextures[side]);
            setUniforms(this.faceParams(i, focusLink));
            gl.drawArrays(gl.TRIANGLES, 0, this.counts[i]);
        }
        gl.activeTexture(gl.TEXTURE0);
    }

    // Turning the plate over by hand: the angle follows the finger, and on
    // release it coasts on its axle and comes to rest on a side (see SPIN).
    // `onSpinSettle(side)` reports where it came to rest.
    spinStart() {
        this.spin = { angle: this.flipAngle, velocity: 0, dragging: true, plan: null };
        this.flipFrom = this.flipTarget = this.flipAngle;
        this.flipProgress = 1;
    }
    spinDrag(angle, velocity) {
        if (!this.spin) return;
        this.spin.angle = angle;
        this.spin.velocity = velocity;
    }
    spinRelease() {
        const spin = this.spin;
        if (!spin || !spin.dragging) return;
        spin.dragging = false;
        // The plate takes a share of the finger's speed, eased into a ceiling:
        // a harder fling always adds a little, never a sudden cap.
        spin.velocity = SPIN.max * Math.tanh(SPIN.gain * spin.velocity / SPIN.max);
        spin.plan = null;
    }
    get spinning() {
        return Boolean(this.spin);
    }
    // Where a released spin comes to rest. Left alone it would stop where drag
    // and friction take it (coastDistance); the side nearest that point is the
    // one it lands on, and the friction is scaled a little, all the way down,
    // so it glides onto that side and stops there — no spring snapping it into
    // place at the end. A weak push that would not carry it past edge-on lets
    // the plate fall back to its side instead, on a damped spring.
    planSpin(spin) {
        const direction = Math.sign(spin.velocity) || 1, speed = Math.abs(spin.velocity);
        const target = Math.round((spin.angle + direction * coastDistance(speed)) / Math.PI) * Math.PI;
        const ahead = (target - spin.angle) * direction;
        return { target, direction, glide: speed > 1 && ahead > .05 && coastDistance(speed) / ahead < 3 };
    }
    stepSpin(dt, reduced) {
        const spin = this.spin;
        if (!spin.dragging) {
            if (reduced) {
                spin.angle = Math.round(spin.angle / Math.PI) * Math.PI;
                spin.velocity = 0;
            } else {
                spin.plan ??= this.planSpin(spin);
                const { target, direction } = spin.plan;
                const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
                for (let i = 0; i < steps; i++) {
                    const h = dt / steps;
                    const ahead = (target - spin.angle) * direction, speed = spin.velocity * direction;
                    if (spin.plan.glide && ahead > 0 && speed > 0) {
                        // Drag and bearing friction, scaled to stop on the target.
                        const scale = Math.min(4, coastDistance(speed) / ahead);
                        const next = Math.max(0, speed - scale * (SPIN.bearing + SPIN.drag * speed) * h);
                        spin.angle += direction * (speed + next) / 2 * h;
                        spin.velocity = direction * next;
                    } else {
                        // Past the side, stalled short of it, or a weak push: a
                        // damped spring finishes the last of the way.
                        spin.plan.glide = false;
                        spin.velocity -= (SPIN.spring ** 2 * (spin.angle - target) + 2 * SPIN.damping * SPIN.spring * spin.velocity) * h;
                        spin.angle += spin.velocity * h;
                    }
                }
            }
            const target = Math.round(spin.angle / Math.PI) * Math.PI;
            if (reduced || (Math.abs(spin.angle - target) < .002 && Math.abs(spin.velocity) < .03)) {
                this.spin = null;
                this.flipAngle = this.flipFrom = this.flipTarget = target;
                this.flipProgress = 1;
                this.onSpinSettle?.(mod2(Math.round(target / Math.PI)));
                return 0;
            }
        }
        this.flipAngle = spin.angle;
        // Mid-turn the plate comes toward the viewer, as in a tap flip.
        return Math.abs(Math.sin(spin.angle)) * .35;
    }

    surfacePoint(clientX, clientY) {
        if (!this.model || this.flipProgress < 1 || this.spin) return null;
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
        this.buffers.forEach(buffer => gl.deleteBuffer(buffer));
        this.arrays.forEach(array => gl.deleteVertexArray(array));
        this.textures.forEach(texture => gl.deleteTexture(texture));
        this.engravingTextures.forEach(texture => gl.deleteTexture(texture));
        this.deleteTargets();
        gl.deleteVertexArray(this.screenArray);
        // Card programs still compiling (cardProgram) are promises: nothing to delete yet.
        for (const card of Object.values(this.cards)) if (card.program) gl.deleteProgram(card.program);
        for (const program of [this.blurProgram, this.compositeProgram, this.shadowProgram, this.backdropProgram]) gl.deleteProgram(program);
    }
}
