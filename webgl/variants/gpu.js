// WebGPU backend for the homepage's look (Noir, raised letters, velvet): the
// same frame as renderer.js — draw() works out every input, faceParams() each
// face's — drawn with WebGPU into a half-float canvas, so highlights can run
// brighter than the page's white on an HDR screen («Блики ярче белого»).
// The shaders are renderer.js's GLSL for that look, in WGSL: the edition's
// constants are baked in, everything the lab sets still arrives as uniforms.
// Without WebGPU, or for another edition, the page draws with WebGL as before.
import { CardRenderer as WebGLCardRenderer, loadCardFont, logoImage } from './renderer.js';
import { direction } from './directions.js';

// The look these shaders were written for (see directions.js and renderer.js).
const PORTED = direction.id === 'noir';
// How far above the page's white the brightest highlights may go on an HDR
// screen (the tone curve's shoulder moves up by it). `?headroom=1` shows SDR.
const HEADROOM = Number(new URLSearchParams(location.search).get('headroom')) || 3;
const SAMPLES = 4;

// Uniform blocks: [name, type]. The WGSL struct and the byte offsets both come
// from the list, so the two cannot drift apart. Types follow WGSL's uniform
// layout: vec3 aligns to 16 bytes, mat3 is three padded columns, and the lamp
// arrays are vec4 per lamp (renderer.js packs them 3 or 1 floats a lamp).
const TYPES = {
    f32: { wgsl: 'f32', align: 4, size: 4 },
    i32: { wgsl: 'i32', align: 4, size: 4 },
    vec2: { wgsl: 'vec2f', align: 8, size: 8 },
    vec3: { wgsl: 'vec3f', align: 16, size: 12 },
    vec4: { wgsl: 'vec4f', align: 16, size: 16 },
    mat3: { wgsl: 'mat3x3f', align: 16, size: 48 },
    mat4: { wgsl: 'mat4x4f', align: 16, size: 64 },
    lamps3: { wgsl: 'array<vec4f, 12>', align: 16, size: 192 },
    lamps1: { wgsl: 'array<vec4f, 12>', align: 16, size: 192 }
};
function block(name, fields) {
    let offset = 0;
    const members = fields.map(([field, type]) => {
        const t = TYPES[type];
        offset = Math.ceil(offset / t.align) * t.align;
        const member = { field, type, offset };
        offset += t.size;
        return member;
    });
    const size = Math.ceil(offset / 16) * 16;
    const wgsl = `struct ${name} {\n${members.map(m => `    ${m.field}: ${TYPES[m.type].wgsl},`).join('\n')}\n}`;
    const data = new ArrayBuffer(size), floats = new Float32Array(data), ints = new Int32Array(data);
    // Values by field name into the block's bytes; absent ones keep the last.
    const pack = values => {
        for (const { field, type, offset } of members) {
            const value = values[field];
            if (value === undefined) continue;
            const at = offset / 4;
            if (type === 'f32') floats[at] = value;
            else if (type === 'i32') ints[at] = value;
            else if (type === 'mat3') for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) floats[at + c * 4 + r] = value[c * 3 + r];
            else if (type === 'lamps3') for (let i = 0; i * 3 < value.length; i++) for (let k = 0; k < 3; k++) floats[at + i * 4 + k] = value[i * 3 + k];
            else if (type === 'lamps1') for (let i = 0; i < value.length; i++) floats[at + i * 4] = value[i];
            else for (let k = 0; k < value.length; k++) floats[at + k] = value[k];
        }
        return data;
    };
    return { wgsl, size, pack };
}

const FRAME = block('Frame', [
    ['uModel', 'mat4'], ['uProjection', 'mat4'], ['uRoom', 'mat3'], ['uOutput', 'vec3'], ['uExposure', 'f32'],
    ['uKeyDirection', 'vec3'], ['uOpacity', 'f32'], ['uRaisedHeight', 'vec3'], ['uReveal', 'f32'],
    ['uReliefSlope', 'vec3'], ['uKeyGain', 'f32'], ['uReliefSign', 'vec3'], ['uBevelCurve', 'f32'],
    ['uLogoTint', 'vec4'], ['uNameTint', 'vec4'], ['uLogoFirstTint', 'vec4'], ['uBodyTint', 'vec4'],
    ['uTintFinish', 'vec4'], ['uTintAmount', 'vec4'], ['uGloss', 'vec3'], ['uTextMute', 'f32'],
    ['uMute', 'vec2'], ['uLetterGlow', 'f32'], ['uFinish', 'f32'], ['uSurface', 'f32'], ['uSparkle', 'f32'],
    ['uRoomBase', 'f32'], ['uBounce', 'f32'],
    ['uKeyRight', 'vec3'], ['uKeyRadius', 'f32'], ['uKeyUp', 'vec3'], ['uKeySoft', 'f32'],
    ['uKeyCenter', 'vec3'], ['uRoundLights', 'f32'], ['uKeyColor', 'vec3'], ['uLightCount', 'i32'], ['uKeySize', 'vec2'],
    ['uOrbitCenter', 'vec3'], ['uOrbitRight', 'vec3'], ['uOrbitUp', 'vec3'], ['uOrbitColor', 'vec3'],
    ['uStrip', 'vec3'], ['uFillTint', 'vec3'],
    ['uLightCenter', 'lamps3'], ['uLightRight', 'lamps3'], ['uLightUp', 'lamps3'], ['uLightShape', 'lamps3'],
    ['uLightColor', 'lamps3'], ['uLightFace', 'lamps1']
]);
// One face in one pass: 0 front, 1 back, 2 rim; the bloom pass or the picture.
const FACE = block('Face', [
    ['uLogoRect', 'vec4'], ['uTitleRect', 'vec4'], ['uTextRect', 'vec4'], ['uHoverRect', 'vec4'], ['uFocusRect', 'vec4'],
    ['uReliefWidth', 'vec3'], ['uEdge', 'f32'], ['uReliefHas', 'vec3'], ['uBloomPass', 'f32'],
    ['uUVBasis', 'vec2'], ['uLayoutSize', 'vec2'], ['uLogoScale', 'f32']
]);
const BACKDROP = block('Backdrop', [
    ['uWall', 'vec3'], ['uTime', 'f32'], ['uFloor', 'vec3'], ['uGrain', 'f32'], ['uPoolColor', 'vec3'], ['uShadowStrength', 'f32'],
    ['uEdgeTop', 'vec3'], ['uShadowFade', 'f32'], ['uEdgeBottom', 'vec3'], ['uPoolFalloff', 'f32'], ['uOutput', 'vec3'],
    ['uEdgeFade', 'vec4'], ['uResolution', 'vec2'], ['uPool', 'vec2']
]);
const SHADOW = block('Shadow', [['uModel', 'mat4'], ['uProjection', 'mat4'], ['uLight', 'vec3']]);
const COMPOSITE = block('Composite', [['uGlowSpace', 'mat3'], ['uStrength', 'f32']]);
const BLUR = block('Blur', [['uStep', 'vec2']]);

// Tone curve and output encoding, as renderer.js's toneCode.
const toneCode = /* wgsl */`
fn neutralTonemap(input: vec3f) -> vec3f {
    let start = .76;
    let desaturation = .15;
    var color = input;
    let x = min(color.r, min(color.g, color.b));
    let offset = select(.04, x - 6.25 * x * x, x < .08);
    // In proportion to each channel, so the hue survives the toe (renderer.js).
    color -= offset * color / max(max(color.r, max(color.g, color.b)), 1e-5);
    let peak = max(color.r, max(color.g, color.b));
    if (peak < start) { return color; }
    let d = 1.0 - start;
    let newPeak = 1.0 - d * d / (peak + d - start);
    color *= newPeak / peak;
    let g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
    return mix(color, vec3f(newPeak), g);
}

fn toSRGB(input: vec3f) -> vec3f {
    let c = clamp(input, vec3f(0.0), vec3f(1.0));
    return mix(c * 12.92, 1.055 * pow(c, vec3f(1.0 / 2.4)) - .055, step(vec3f(.0031308), c));
}

// Linear sRGB to linear Display P3.
const SRGB_TO_P3 = mat3x3f(.8224621, .0331941, .0170827, .1775380, .9668058, .0723974, 0.0, 0.0, .9105199);

fn fromSRGB(c: vec3f) -> vec3f {
    return mix(c / 12.92, pow((c + .055) / 1.055, vec3f(2.4)), step(vec3f(.04045), c));
}

// output: x — the canvas is Display P3; y — how far saturated colours reach
// into it; z — the headroom above white (1 — none). See renderer.js.
fn toDisplay(input: vec3f, output: vec3f) -> vec3f {
    var c = input;
    if (output.x > .5) {
        let peak = max(c.r, max(c.g, c.b));
        let saturation = select(0.0, 1.0 - min(c.r, min(c.g, c.b)) / peak, peak > 1e-5);
        c = mix(SRGB_TO_P3 * c, c, output.y * smoothstep(.25, .9, saturation));
    }
    // Above white only with headroom; the sRGB curve extends past 1.
    c = clamp(c, vec3f(0.0), vec3f(output.z));
    return mix(c * 12.92, 1.055 * pow(c, vec3f(1.0 / 2.4)) - .055, step(vec3f(.0031308), c));
}

fn displayFromSRGB(c: vec3f, output: vec3f) -> vec3f {
    return select(c, toSRGB(SRGB_TO_P3 * fromSRGB(clamp(c, vec3f(0.0), vec3f(1.0)))), output.x > .5);
}`;

// Integer hash, exact at any coordinate (renderer.js).
const hashCode = /* wgsl */`
fn hashI(a: i32, b: i32) -> f32 {
    var h = (u32(a) * 0x9E3779B1u) ^ (u32(b) * 0x85EBCA77u);
    h ^= h >> 15u; h *= 0x2C1B3C6Du; h ^= h >> 12u; h *= 0x297A2D39u; h ^= h >> 15u;
    return f32(h) * (1.0 / 4294967295.0);
}`;

// The card: renderer.js's vertexSource and fragmentSource for the Noir look.
// Comments there explain the shading; here they only mark the parts.
// dFdy is -dpdy: WebGPU counts pixels downwards, GL upwards, and the
// supersampling patterns are laid out in GL's pixels.
const cardShader = /* wgsl */`
${FRAME.wgsl}
${FACE.wgsl}
@group(0) @binding(0) var<uniform> u: Frame;
@group(0) @binding(1) var<uniform> f: Face;
@group(0) @binding(2) var linear: sampler;
@group(0) @binding(3) var uTexture: texture_2d<f32>;
@group(0) @binding(4) var uEngraving: texture_2d<f32>;

struct Varyings {
    @builtin(position) position: vec4f,
    @location(0) vPosition: vec3f,
    @location(1) vNormal: vec3f,
    @location(2) vUV: vec2f,
    @location(3) vTangent: vec3f,
    @location(4) vBitangent: vec3f,
    @location(5) vFacet: f32,
}

@vertex fn vertexMain(@location(0) aPosition: vec3f, @location(1) aNormal: vec3f, @location(2) aUV: vec2f) -> Varyings {
    var out: Varyings;
    let world = u.uModel * vec4f(aPosition, 1.0);
    let model = mat3x3f(u.uModel[0].xyz, u.uModel[1].xyz, u.uModel[2].xyz);
    out.vPosition = world.xyz;
    out.vNormal = model * aNormal;
    out.vUV = aUV;
    out.vTangent = model * vec3f(f.uUVBasis.x, 0.0, 0.0);
    out.vBitangent = model * vec3f(0.0, f.uUVBasis.y, 0.0);
    out.vFacet = aNormal.z;
    var clip = u.uProjection * vec4f(world.xyz - vec3f(0.0, 0.0, 7.0), 1.0);
    // GL's depth range, −1…1, to WebGPU's 0…1.
    clip.z = (clip.z + clip.w) * .5;
    out.position = clip;
    return out;
}

const CHAMFER_F0 = vec3f(0.0750, 0.0750, 0.0800);
const SIDE_F0 = vec3f(0.0500, 0.0500, 0.0550);
const LOGO_F0 = vec3f(0.9200, 0.9200, 0.9400);
const NAME_F0 = vec3f(0.9200, 0.9200, 0.9400);
const TEXT_F0 = vec3f(0.9200, 0.9200, 0.9400);
const PLATE_F0 = vec3f(0.0500, 0.0510, 0.0560);
const STRIP_C = vec3f(0.0430, 0.0000, 0.9991);
const STRIP_R = vec3f(0.8996, 0.4350, -0.0387);
const STRIP_U = vec3f(-0.4346, 0.9004, 0.0187);
const EDGE_SS = array<vec2f, 8>(vec2f(.0625, -.1875), vec2f(-.0625, .1875), vec2f(.3125, .0625), vec2f(-.1875, -.3125),
                                vec2f(-.3125, .3125), vec2f(-.4375, -.0625), vec2f(.1875, .4375), vec2f(.4375, -.4375));
const SS4 = array<vec2f, 4>(vec2f(-.125, -.375), vec2f(.375, -.125), vec2f(.125, .375), vec2f(-.375, .125));

fn reliefT(b: f32) -> f32 { return clamp(b * 2.0 - 1.0, 0.0, 1.0); }

fn bevelHeight(input: f32) -> f32 {
    let t = clamp(input, 0.0, 1.0);
    if (u.uBevelCurve < .5) { return sin(t * 1.5707963); }
    if (u.uBevelCurve < 1.5) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
    return t;
}

fn bevelSlope(input: f32, edge: f32) -> f32 {
    let t = clamp(input, 0.0, 1.0);
    if (u.uBevelCurve < .5) { return 1.5707963 * cos(t * 1.5707963); }
    if (u.uBevelCurve < 1.5) { return 30.0 * t * t * (1.0 - t) * (1.0 - t); }
    return 1.0 - smoothstep(1.0 - edge, 1.0, t);
}

fn reliefSlopeXY(r: vec4f, region: vec3f, pixel: f32) -> vec2f {
    let dir = (r.rg * 255.0 - 128.0) / 127.0;
    let raised = dot(region, step(vec3f(0.0), u.uReliefSign));
    let edge = clamp(pixel / max(dot(region, f.uReliefWidth), 1e-4), .03, 1.0);
    let t = reliefT(r.b);
    let g = dot(region, u.uReliefSlope * u.uReliefSign) * mix(1.0 - smoothstep(1.0 - edge, 1.0, t), bevelSlope(t, edge), raised);
    return -g * dir / sqrt(1.0 + g * g * dot(dir, dir));
}

fn stripLight(d: vec3f, blur: f32) -> f32 {
    let z = dot(d, STRIP_C);
    let p = vec2f(dot(d, STRIP_R), dot(d, STRIP_U)) / max(z, .08);
    let edge = blur + .02;
    let inside = smoothstep(edge, -edge, abs(p.y) - 0.0350) * smoothstep(edge, -edge, abs(p.x) - 2.0000);
    return inside * 0.0350 / (0.0350 + edge) * smoothstep(0.0, .25, z);
}

fn keyPanel(d: vec3f, c: vec3f, blur: f32) -> f32 {
    let z = dot(d, c);
    let p = vec2f(dot(d, u.uKeyRight), dot(d, u.uKeyUp)) / max(z, .08);
    let q = abs(p) - u.uKeySize + u.uKeyRadius;
    let sd = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - u.uKeyRadius;
    let edge = blur + u.uKeySoft;
    let inside = smoothstep(edge, -edge, sd);
    let span = u.uKeySize + edge;
    let body = 1.0 - .25 * dot(p / span, p / span);
    let energy = (u.uKeySize.x * u.uKeySize.y) / (span.x * span.y);
    return inside * max(body, 0.0) * smoothstep(0.0, .25, z) * energy;
}

fn panel(d: vec3f, c: vec3f, r: vec3f, up: vec3f, size: vec2f, blur: f32, roundness: f32) -> f32 {
    let z = dot(d, c);
    let p = vec2f(dot(d, r), dot(d, up)) / max(z, .08);
    let disc = sqrt(size.x * size.y);
    let radius = min(size.x, size.y);
    let q = abs(p) - size + radius;
    let capsule = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - radius;
    let sd = mix(capsule, length(p) - disc, roundness);
    let shape = mix(size, vec2f(disc), roundness);
    let edge = blur + u.uKeySoft;
    let inside = smoothstep(edge, -edge, sd);
    let span = shape + edge;
    let body = 1.0 - .25 * dot(p / span, p / span);
    let energy = (shape.x * shape.y) / (span.x * span.y);
    return inside * max(body, 0.0) * smoothstep(0.0, .25, z) * energy;
}

// How much of the orbiting back light the surface being shaded takes.
var<private> orbitSeen: f32 = 1.0;

// The room as the chamfer and lettering (face 0) or the plate's face (face 1) see it.
fn roomFor(world: vec3f, rough: f32, face: f32) -> vec3f {
    let d = u.uRoom * world;
    let blur = .004 + rough * rough * 1.5;
    var col = mix(vec3f(.006, .006, .007), vec3f(.045, .047, .052), smoothstep(-.6, .9, d.y));
    col += vec3f(.10, .10, .095) * exp(-d.y * d.y * mix(40.0, 5.0, rough)) * smoothstep(.3, -.2, d.z);
    col += vec3f(.04) * u.uFillTint * (.55 + .45 * smoothstep(-1.0, 1.0, d.y));
    let bounce = panel(d, vec3f(0.0, 0.0, 1.0), vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec2f(1.35, 1.05), blur + .22, u.uRoundLights);
    var tent = .52 + .14 * d.x * clamp(u.uKeyCenter.x * 4.0, -1.0, 1.0) + .06 * d.y;
    tent *= mix(.32, 1.0, smoothstep(-.85, .25, d.z));
    tent += .30 * smoothstep(.45, 1.0, dot(d, vec3f(-.33, .14, -.93)));
    tent += 1.1 * (1.0 - smoothstep(.0, .09, abs(-d.z - .82)));
    let wall = mix(.45 * (1.0 - smoothstep(.45, .95, abs(d.y))), tent, face);
    col += vec3f(0.3000) * u.uFillTint * u.uBounce * max(bounce, wall);
    col += vec3f(u.uRoomBase) * smoothstep(-.9, .3, d.y);
    col += u.uKeyColor * u.uKeyGain * keyPanel(d, u.uKeyCenter, blur);
    if (u.uStrip.g > 0.0) { col += u.uStrip * stripLight(world, blur); }
    for (var i = 0; i < 12; i++) {
        if (i >= u.uLightCount) { break; }
        let shape = u.uLightShape[i].xyz;
        let seen = mix(1.0, u.uLightFace[i].x, face);
        if (seen <= 0.0) { continue; }
        let soften = face * (1.0 - u.uLightFace[i].x) * .6;
        col += u.uLightColor[i].xyz * seen * panel(d, u.uLightCenter[i].xyz, u.uLightRight[i].xyz, u.uLightUp[i].xyz, shape.xy, blur + soften,
            select(shape.z, u.uRoundLights, shape.z < 0.0));
    }
    if (face < .5 && u.uOrbitColor.r > 0.0) {
        col += u.uOrbitColor * orbitSeen * panel(d, u.uOrbitCenter, u.uOrbitRight, u.uOrbitUp, vec2f(.20), blur, 1.0);
    }
    return col;
}

fn room(world: vec3f, rough: f32) -> vec3f { return roomFor(world, rough, 0.0); }

fn fresnel(f0: vec3f, nv: f32) -> vec3f {
    return f0 + (1.0 - f0) * pow(1.0 - nv, 5.0);
}

fn brushed(n: vec3f, v: vec3f, across: vec3f, rough: f32, aniso: f32, face: f32) -> vec3f {
    if (aniso <= 0.0) { return roomFor(reflect(-v, n), rough, face); }
    var sum = vec3f(0.0);
    for (var i = 0; i < 7; i++) {
        let s = (f32(i) - 3.0) / 3.0;
        let ni = normalize(n + across * s * aniso);
        sum += roomFor(reflect(-v, ni), rough, face) * (1.0 - .5 * s * s);
    }
    return sum / 5.4444;
}

fn metal(f0: vec3f, n: vec3f, v: vec3f, rough: f32) -> vec3f {
    let nv = max(dot(n, v), 1e-3);
    return fresnel(f0, nv) * room(reflect(-v, n), rough);
}

fn metalTint(c: vec3f) -> vec3f {
    let l = dot(c, vec3f(.2126, .7152, .0722));
    let lifted = mix(.07, 1.0, l);
    let hue = select(vec3f(1.0), c / l, l > 1e-4);
    return min(hue * lifted, vec3f(1.0));
}

fn clearCoat(f0: f32, n: vec3f, v: vec3f, rough: f32) -> vec3f {
    let nv = max(dot(n, v), 1e-3);
    return (f0 + (1.0 - f0) * pow(1.0 - nv, 5.0)) * room(reflect(-v, n), rough);
}

fn gloss(albedo: vec3f, n: vec3f, v: vec3f, rough: f32) -> vec3f {
    let nv = max(dot(n, v), 1e-3);
    let coat = .04 + .96 * pow(1.0 - nv, 5.0);
    return albedo * room(n, 1.0) * 2.2 * (1.0 - coat) + coat * room(reflect(-v, n), rough);
}

fn tinted(base: vec3f, tint: vec4f, finish: f32, n: vec3f, facet: vec3f, v: vec3f, rough: f32, edge: f32, shine: f32, plateLetter: vec3f, amount: f32) -> vec3f {
    if (tint.a > 1.5) { return plateLetter; }
    if (tint.a < .5) { return base; }
    let anodRough = mix(.55, max(.06, rough), shine);
    let anod = metal(metalTint(tint.rgb), facet, v, anodRough) + clearCoat(.06, facet, v, anodRough);
    let full = mix(mix(gloss(tint.rgb * 1.9, n, v, mix(.55, .06, shine)), anod, finish), mix(base, anod, finish), edge);
    if (amount > .999) { return full; }
    let dyed = plateLetter * mix(vec3f(1.0), min(metalTint(tint.rgb) / .6, vec3f(1.0)), amount);
    return mix(dyed, full, amount * amount);
}

${hashCode}

fn scratch(row: i32, along: f32, len: f32, seed: i32) -> f32 {
    let x = along / len + hashI(row, seed) * 97.0;
    let cell = floor(x);
    let t = fract(x);
    let c = i32(cell);
    return mix(hashI(row * 7 + seed, c), hashI(row * 7 + seed, c + 1), t * t * (3.0 - 2.0 * t));
}

fn scratches(groove: f32, along: f32, len: f32, seed: i32) -> f32 {
    let row = floor(groove);
    let t = fract(groove);
    let r = i32(row);
    return mix(scratch(r, along, len, seed), scratch(r + 1, along, len, seed), t * t * (3.0 - 2.0 * t));
}

fn cloud(p: vec2f) -> f32 {
    let i = floor(p);
    var w = fract(p);
    w = w * w * (3.0 - 2.0 * w);
    let c = vec2i(i);
    return mix(mix(hashI(c.x, c.y), hashI(c.x + 1, c.y), w.x), mix(hashI(c.x, c.y + 1), hashI(c.x + 1, c.y + 1), w.x), w.y);
}

${toneCode}

fn inRect(r: vec4f, uv: vec2f) -> f32 {
    return step(r.x, uv.x) * step(r.y, uv.y) * step(uv.x, r.z) * step(uv.y, r.w);
}

@fragment fn fragmentMain(in: Varyings) -> @location(0) vec4f {
    let vUV = in.vUV;
    var letterMask = 0.0;
    let n = normalize(in.vNormal);
    let v = normalize(vec3f(0.0, 0.0, 7.0) - in.vPosition);
    let T = normalize(in.vTangent);
    let B = normalize(in.vBitangent);
    let surfacePx = vUV * f.uLayoutSize;
    let footprint = max(fwidth(vUV.x) * f.uLayoutSize.x, fwidth(vUV.y) * f.uLayoutSize.y);
    let resolved = 1.0 - smoothstep(.85, 1.8, footprint);
    var texUV = vUV;

    // Parallax occlusion: the view ray marched down through the raised letters.
    if (f.uEdge < .5) {
        let pad = vec4f(-6.0, -6.0, 6.0, 6.0) / f.uLayoutSize.xyxy;
        let nearLogo = inRect(f.uLogoRect + pad, vUV);
        let nearName = inRect(f.uTitleRect + pad, vUV) * (1.0 - nearLogo);
        let nearText = inRect(f.uTextRect + pad, vUV) * (1.0 - nearLogo) * (1.0 - nearName);
        let smallShown = select(1.0 - smoothstep(.35, .7, footprint), resolved, u.uBodyTint.a > 1.5);
        let height = (nearLogo * u.uRaisedHeight.y * f.uLogoScale + nearName * u.uRaisedHeight.x) * resolved
            + nearText * u.uRaisedHeight.z * smallShown;
        let toEye = vec3f(dot(v, T), dot(v, B), dot(v, n));
        if (height > 0.0 && toEye.z > .06) {
            let shift = -toEye.xy / toEye.z * height / f.uLayoutSize;
            let layers = clamp(ceil(length(shift * f.uLayoutSize) * 3.0), 1.0, 40.0);
            let stepUV = shift / layers;
            let stepDepth = 1.0 / layers;
            var uv = vUV;
            var depth = 0.0;
            var below = 1.0 - bevelHeight(reliefT(textureSampleLevel(uEngraving, linear, uv, 0.0).b));
            for (var i = 0; i < 40; i++) {
                if (f32(i) >= layers || depth >= below) { break; }
                uv += stepUV;
                depth += stepDepth;
                below = 1.0 - bevelHeight(reliefT(textureSampleLevel(uEngraving, linear, uv, 0.0).b));
            }
            let last = uv - stepUV;
            let after = below - depth;
            let before = (1.0 - bevelHeight(reliefT(textureSampleLevel(uEngraving, linear, last, 0.0).b))) - (depth - stepDepth);
            texUV = select(vUV, mix(uv, last, clamp(after / (after - before - 1e-5), 0.0, 1.0)), depth > 0.0);
        }
    }
    let ink = textureSample(uTexture, linear, texUV);
    let relief = textureSample(uEngraving, linear, texUV);
    var color: vec3f;

    if (f.uEdge > .5) {
        // Diamond-cut chamfer, supersampled 8× inside the pixel; the satin wall once.
        var edgeSS = EDGE_SS;
        let nDx = dpdx(n);
        let nDy = -dpdy(n);
        let facetDx = dpdx(in.vFacet);
        let facetDy = -dpdy(in.vFacet);
        let edgeRough = sqrt(min((dot(nDx, nDx) + dot(nDy, nDy)) * .6 / 8.0, .2));
        let wall = metal(SIDE_F0, n, v, max(0.3000, edgeRough));
        color = vec3f(0.0);
        for (var i = 0; i < 8; i++) {
            let o = edgeSS[i];
            let ns = normalize(n + nDx * o.x + nDy * o.y);
            let facet = abs(in.vFacet + facetDx * o.x + facetDy * o.y);
            let chamfer = smoothstep(.25, .45, facet) * (1.0 - smoothstep(.95, .99, facet));
            var cut = metal(CHAMFER_F0, ns, v, max(0.0250, edgeRough));
            let around = u.uRoom * reflect(-v, ns);
            let ring = exp(-around.z * around.z * 6.0) * mix(.55, 1.0, smoothstep(-1.0, 1.0, around.y));
            cut += fresnel(CHAMFER_F0, max(dot(ns, v), 1e-3)) * ring * .8;
            color += mix(wall, cut, chamfer);
        }
        color /= 8.0;
    } else {
        orbitSeen = 1.0 - smoothstep(.12, .25, footprint);
        let across = B;
        let groove = surfacePx.y;
        let along = surfacePx.x;
        let fine = fwidth(groove);
        // Finish: brushed, bead-blasted or polished (a uniform: one branch per frame).
        let blasted = 1.0 - step(.5, abs(u.uFinish - 1.0));
        let polished = step(1.5, u.uFinish);
        let brushing = 1.0 - blasted - polished;
        var grooves = 0.0;
        var grainTilt = 0.0;
        if (brushing > 0.0) {
            let layer1 = (scratches(groove * 2.3, along, 38.0, 11) - .5) * (1.0 - smoothstep(.25, .6, fine * 2.3));
            let layer2 = (scratches(groove * .9, along, 95.0, 23) - .5) * (1.0 - smoothstep(.25, .6, fine * .9));
            let bundles = (scratches(groove * .28, along, 160.0, 41) - .5) * (1.0 - smoothstep(.25, .6, fine * .28));
            let bands = (scratches(groove * .11, along, 330.0, 53) - .5);
            let deep = smoothstep(.92, .985, scratches(groove * .4, along, 240.0, 37)) * (1.0 - smoothstep(.25, .6, fine * .4));
            grooves = (layer1 * .8 + layer2 * .6 + bundles * .9 + bands * .6 + deep * .7) * brushing * u.uSurface;
            grainTilt = (layer2 * .3 + bundles + bands * .6) * u.uSurface;
        }
        let sheen = cloud(surfacePx / 170.0) - .5;
        var plateRough = 0.3000 * (1.0 + grooves * .12 + sheen * .16);
        plateRough = mix(mix(plateRough, .44 * (1.0 + sheen * .12), blasted), .055 * (1.0 + sheen * .3), polished);
        let plateAniso = 0.2200 * brushing;
        let nv = max(dot(n, v), 1e-3);
        let plateF0 = PLATE_F0;
        var plateN = normalize(n + across * grainTilt * .035 * brushing);
        var frost = vec2f(0.0);
        if (blasted > 0.0) {
            frost = vec2f(cloud(surfacePx * 1.1) - .5, cloud(surfacePx * 1.1 + 91.0) - .5) * (1.0 - smoothstep(.25, .6, fine * 1.1))
                  + vec2f(cloud(surfacePx * .45 + 13.0) - .5, cloud(surfacePx * .45 + 57.0) - .5) * .35;
        }
        frost *= u.uSurface;
        plateN = normalize(plateN + (T * frost.x + B * frost.y) * .04 * blasted);
        color = fresnel(plateF0, nv) * brushed(plateN, v, across, plateRough, plateAniso, 1.0);
        color *= 1.0 + grooves * .05 + sheen * mix(.05, .02, polished) + frost.x * .02 * blasted;
        // Sparkle: the dents between the key and the eye flash.
        if (blasted > 0.0 && u.uSparkle > 0.0) {
            let dent = surfacePx / .75;
            let id = vec2i(floor(dent));
            let tilt = (vec2f(hashI(id.x, id.y * 3 + 1), hashI(id.x * 5 + 2, id.y)) - .5) * .9;
            let centre = vec2f(hashI(id.x + 11, id.y * 7 + 5), hashI(id.x * 3 + 7, id.y + 13)) - .5;
            let halfway = normalize(normalize(u.uKeyDirection) + v);
            let facing = vec2f(dot(halfway, T), dot(halfway, B)) / max(dot(halfway, n), .2) - tilt;
            let glint = exp(-dot(facing, facing) / .0025);
            let cellPx = footprint / .75;
            let speck = 1.0 - smoothstep(.2 - cellPx * .5, .2 + cellPx * .5, length(fract(dent) - .5 - centre * .5));
            color += u.uSparkle * u.uKeyColor * u.uKeyGain * plateF0 * glint * speck * (1.0 - smoothstep(.8, 1.6, cellPx)) * .35;
        }
        // PVD coatings keep a faint clear reflection above the dark metal.
        color += 0.0120 * roomFor(reflect(-v, n), .10, 1.0);

        let logoRegion = inRect(f.uLogoRect, vUV);
        let titleRegion = inRect(f.uTitleRect, vUV) * (1.0 - logoRegion);
        let textRegion = 1.0 - logoRegion - titleRegion;
        let smallRelief = select(1.0 - smoothstep(.35, .7, footprint), resolved, u.uBodyTint.a > 1.5);
        let reliefShown = mix(resolved, smallRelief, textRegion);
        let reliefRegion = vec3f(titleRegion, logoRegion, textRegion);
        let slopeXY = reliefSlopeXY(relief, reliefRegion, footprint) * reliefShown;
        let facet = normalize(T * slopeXY.x + B * slopeXY.y + n * sqrt(max(.01, 1.0 - dot(slopeXY, slopeXY))));
        // Specular anti-aliasing: the relief normal's spread over the pixel.
        let dnx = dpdx(facet);
        let dny = dpdy(facet);
        let normalSpread = min((dot(dnx, dnx) + dot(dny, dny)) * .6, .20);
        // Supersampled lettering: 8, 4 or 1 samples by how much bevel a pixel holds.
        let uvDx = dpdx(texUV);
        let uvDy = -dpdy(texUV);
        let inkTexels = vec2f(textureDimensions(uTexture, 0));
        let inkLod = log2(max(max(length(uvDx * inkTexels), length(uvDy * inkTexels)), 1.0));
        let nearInk = textureSampleLevel(uTexture, linear, texUV, inkLod + 2.5).a > .002;
        var samples = 1;
        if (nearInk && footprint > .4) { samples = 8; } else if (nearInk && footprint > .15) { samples = 4; }
        let sampleScale = inverseSqrt(f32(samples));

        // Links: underline and keyboard focus.
        let aa = max(fwidth(vUV) * .7, vec2f(1e-5));
        let enter = smoothstep(f.uHoverRect.xy - aa, f.uHoverRect.xy + aa, vUV);
        let leave = 1.0 - smoothstep(f.uHoverRect.zw - aa, f.uHoverRect.zw + aa, vUV);
        let underline = enter.x * enter.y * leave.x * leave.y;
        let focusInside = step(f.uFocusRect.xy, vUV) * step(vUV, f.uFocusRect.zw);
        let focusThickness = max(fwidth(vUV) * 2.4, vec2f(.0014));
        let focusEdge = min(vUV - f.uFocusRect.xy, f.uFocusRect.zw - vUV);
        let focusStroke = min(1.0, focusInside.x * focusInside.y
            * ((1.0 - step(focusThickness.x, focusEdge.x)) + (1.0 - step(focusThickness.y, focusEdge.y))));

        // Raised letters' soft cast shadow and contact shadow on the plate.
        let L = normalize(u.uKeyDirection);
        let lightSlope = vec2f(dot(L, T), dot(L, B)) / max(dot(L, n), .35);
        let pad = vec4f(-6.0, -6.0, 6.0, 6.0) / f.uLayoutSize.xyxy;
        let nearLogo = inRect(f.uLogoRect + pad, vUV);
        let nearName = inRect(f.uTitleRect + pad, vUV) * (1.0 - nearLogo);
        let nearText = inRect(f.uTextRect + pad, vUV) * (1.0 - nearLogo) * (1.0 - nearName);
        let raisedHeight = nearLogo * u.uRaisedHeight.y * f.uLogoScale + nearName * u.uRaisedHeight.x + nearText * u.uRaisedHeight.z;
        let castStep = lightSlope * raisedHeight * 1.6 / f.uLayoutSize;
        let texels = vec2f(textureDimensions(uEngraving, 0));
        let pixelLod = log2(max(max(fwidth(vUV.x) * texels.x, fwidth(vUV.y) * texels.y), 1.0));
        let softLod = max(pixelLod, log2(max(raisedHeight * texels.x / f.uLayoutSize.x, 1.0)));
        let occluder = textureSampleLevel(uEngraving, linear, texUV + castStep * .5, softLod).a * .45
                     + textureSampleLevel(uEngraving, linear, texUV + castStep, softLod).a * .35
                     + textureSampleLevel(uEngraving, linear, texUV + castStep * 1.8, softLod + .5).a * .20;
        let contact = textureSampleLevel(uEngraving, linear, texUV, softLod + .6).a;
        let shadowShown = resolved * mix(1.0, smallRelief, nearText);
        color *= 1.0 - (occluder * .6 + contact * .22) * (1.0 - ink.a) * step(.001, raisedHeight) * shadowShown;

        var ss4 = SS4;
        var ss8 = EDGE_SS;
        let plate = color;
        var shaded = vec3f(0.0);
        var letterSum = 0.0;
        for (var sampleIndex = 0; sampleIndex < 8; sampleIndex++) {
            if (sampleIndex >= samples) { break; }
            var offset = vec2f(0.0);
            if (samples == 8) { offset = ss8[sampleIndex]; } else if (samples == 4) { offset = ss4[sampleIndex]; }
            let uvS = texUV + uvDx * offset.x + uvDy * offset.y;
            let inkS = textureSampleGrad(uTexture, linear, uvS, uvDx * sampleScale, uvDy * sampleScale);
            let reliefS = textureSampleGrad(uEngraving, linear, uvS, uvDx * sampleScale, uvDy * sampleScale);
            let slopeS = reliefSlopeXY(reliefS, reliefRegion, footprint * sampleScale) * reliefShown;
            let slope = length(slopeS);
            let facetS = normalize(T * slopeS.x + B * slopeS.y + n * sqrt(max(.01, 1.0 - dot(slopeS, slopeS))));
            // The letter's edge from its distance field, a pixel wide at any zoom.
            let pixelWidth = footprint * sampleScale;
            let fieldEdge = clamp((reliefS.b * 2.0 - 1.0) * dot(reliefRegion, f.uReliefWidth) / max(pixelWidth, 1e-4) + .5, 0.0, 1.0);
            let letterCover = mix(inkS.a, fieldEdge, dot(reliefRegion, f.uReliefHas));
            var letterRough = sqrt(normalSpread / f32(samples));

            let coverage = max(letterCover, max(underline, focusStroke));
            letterSum += coverage;
            if (coverage <= .001) { shaded += plate; continue; }
            // The wordmark's first letter is red-only in the mask, read a little blurred.
            let inkTone = textureSampleLevel(uTexture, linear, uvS, max(inkLod, 1.5));
            let inkColor = inkTone.rgb / max(inkTone.a, .001);
            let firstLetter = smoothstep(.6, .3, inkColor.g);
            let coloured = logoRegion * mix(step(.5, u.uLogoTint.a), step(.5, u.uLogoFirstTint.a), firstLetter)
                         + titleRegion * step(.5, u.uNameTint.a) + textRegion * step(.5, u.uBodyTint.a);
            let raisedRegion = logoRegion + titleRegion + textRegion;
            letterRough = max(letterRough, .45 * smoothstep(.1, .6, slope) * (1.0 - coloured) * raisedRegion);

            // Laser ablation: bare frosted steel below the coating.
            var logoColor = metal(LOGO_F0, facetS, v, mix(.55, max(0.3000, letterRough), u.uGloss.x));
            logoColor += LOGO_F0 * room(n, 1.0) * .18;
            var nameColor = metal(NAME_F0, facetS, v, mix(.55, max(0.3000, letterRough), u.uGloss.y));
            nameColor += NAME_F0 * room(n, 1.0) * .18;
            var textColor = metal(TEXT_F0, facetS, v, mix(.55, max(0.3000, letterRough), u.uGloss.z));
            textColor += TEXT_F0 * room(n, 1.0) * .18;

            let letterEdge = smoothstep(.12, .45, slope) * resolved;
            var plateLetter = vec3f(0.0);
            if (max(max(u.uLogoTint.a, u.uLogoFirstTint.a), max(u.uNameTint.a, u.uBodyTint.a)) > 1.5
                || min(min(u.uTintAmount.x, u.uTintAmount.y), min(u.uTintAmount.z, u.uTintAmount.w)) < .999) {
                let fv = max(dot(facetS, v), 1e-3);
                plateLetter = fresnel(PLATE_F0, fv) * brushed(facetS, v, across, plateRough, plateAniso, 1.0) * (1.0 + grooves * .05);
                plateLetter += 0.0120 * roomFor(reflect(-v, facetS), .10, 1.0);
            }
            logoColor = mix(tinted(logoColor, u.uLogoTint, u.uTintFinish.y, n, facetS, v, letterRough, letterEdge, u.uGloss.x, plateLetter, u.uTintAmount.y),
                            tinted(logoColor, u.uLogoFirstTint, u.uTintFinish.x, n, facetS, v, letterRough, letterEdge, u.uGloss.x, plateLetter, u.uTintAmount.x), firstLetter);
            nameColor = tinted(nameColor, u.uNameTint, u.uTintFinish.z, n, facetS, v, letterRough, letterEdge, u.uGloss.y, plateLetter, u.uTintAmount.z);
            textColor = tinted(textColor, u.uBodyTint, u.uTintFinish.w, n, facetS, v, letterRough, letterEdge, u.uGloss.z, plateLetter, u.uTintAmount.w);
            textColor = mix(textColor, plate, u.uTextMute);
            var lettering = logoColor * logoRegion + nameColor * titleRegion + textColor * textRegion;
            // Diamond-turned shoulders through the colour, on the wordmark and the name.
            let cutRegion = logoRegion + titleRegion;
            let cut = smoothstep(.3, .65, slope) * .6 * resolved * cutRegion * letterCover * coloured;
            lettering = mix(lettering, metal(plateF0, facetS, v, max(.05, letterRough)), cut);
            lettering = mix(lettering, plate, u.uMute.x * logoRegion + u.uMute.y * titleRegion);
            let linkMark = max(underline, focusStroke);
            lettering = mix(lettering, textColor, linkMark);
            shaded += mix(plate, lettering, coverage);
        }
        color = shaded / f32(samples);
        letterMask = letterSum / f32(samples);
    }

    let hdr = color * u.uExposure;
    if (f.uBloomPass > .5) {
        let peak = max(hdr.r, max(hdr.g, hdr.b));
        let glow = hdr * max(peak - 1.6, 0.0) / max(peak, 1e-4);
        return vec4f(glow * .25 * u.uOpacity * u.uReveal * mix(1.0, u.uLetterGlow, letterMask), 1.0);
    }
    var display = toDisplay(u.uOutput.z * neutralTonemap(hdr / u.uOutput.z), u.uOutput);
    // Dither, ±1 level of 8 bits, fixed to the screen.
    let pixel = vec2i(in.position.xy);
    display += (hashI(pixel.x, pixel.y) + hashI(pixel.x + 7919, pixel.y + 104729) - 1.0) / 255.0;
    return vec4f(display * u.uReveal * u.uOpacity, u.uOpacity);
}`;

// A triangle over the screen. uv: GL's (y up) for the backdrop's own
// geometry; screen: WebGPU's texture coordinates for reading targets.
const screenCode = /* wgsl */`
struct Screen {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) screen: vec2f,
}
@vertex fn screenMain(@builtin(vertex_index) index: u32) -> Screen {
    let p = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
    var out: Screen;
    out.position = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
    out.uv = p;
    out.screen = vec2f(p.x, 1.0 - p.y);
    return out;
}`;

const backdropShader = /* wgsl */`
${BACKDROP.wgsl}
@group(0) @binding(0) var<uniform> b: Backdrop;
@group(0) @binding(1) var linear: sampler;
@group(0) @binding(2) var uShadow: texture_2d<f32>;
${screenCode}
${toneCode}

fn hash(input: vec2f) -> f32 {
    var p = fract(input * vec2f(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

fn screenUnits(uv: vec2f) -> vec2f {
    let aspect = b.uResolution.x / b.uResolution.y;
    return uv * vec2f(aspect, 1.0) / min(aspect, 1.0);
}

fn tallness() -> f32 {
    return clamp(b.uResolution.y / b.uResolution.x - 1.0, 0.0, 1.0);
}

fn wallColor(uv: vec2f) -> vec3f {
    let drift = vec2f(sin(b.uTime * .21), cos(b.uTime * .17 + 1.3)) * vec2f(.035, .03);
    let pool = mix(b.uPool, vec2f(b.uPool.x, .5), tallness());
    let d = (screenUnits(uv) - screenUnits(pool + drift)) * vec2f(.85, mix(1.1, .62, tallness()));
    let breath = 1.0 + .08 * sin(b.uTime * .33) + .04 * sin(b.uTime * .57 + 2.0);
    return b.uWall + b.uPoolColor * breath * exp(-dot(d, d) * b.uPoolFalloff);
}

@fragment fn backdropMain(in: Screen) -> @location(0) vec4f {
    let vUV = in.uv;
    let p = screenUnits(vUV) - screenUnits(vec2f(.5));
    let tall = tallness();
    let wall = wallColor(vUV);
    var color = mix(wall, b.uFloor + (wall - b.uWall) * .6, smoothstep(-.12, -.62, p.y) * (1.0 - tall));
    color *= 1.0 - .55 * smoothstep(.3, 1.15, length(p * vec2f(.78, mix(1.0, .62, tall))));
    color *= 1.0 - textureSample(uShadow, linear, in.screen).r * b.uShadowStrength * b.uShadowFade;
    var display = toSRGB(neutralTonemap(color));
    display += (hash(in.position.xy + 17.0) - .5) * b.uGrain;
    if (b.uEdgeFade.x > 0.0) { display = mix(display, b.uEdgeTop, smoothstep(1.0 - b.uEdgeFade.x - b.uEdgeFade.z, 1.0 - b.uEdgeFade.x, vUV.y)); }
    if (b.uEdgeFade.y > 0.0) { display = mix(display, b.uEdgeBottom, smoothstep(b.uEdgeFade.y + b.uEdgeFade.w, b.uEdgeFade.y, vUV.y)); }
    return vec4f(displayFromSRGB(display, b.uOutput), 1.0);
}`;

const blurShader = /* wgsl */`
${BLUR.wgsl}
@group(0) @binding(0) var<uniform> blur: Blur;
@group(0) @binding(1) var linear: sampler;
@group(0) @binding(2) var uSource: texture_2d<f32>;
${screenCode}
@fragment fn blurMain(in: Screen) -> @location(0) vec4f {
    let uv = in.screen;
    var s = textureSample(uSource, linear, uv).rgb * .2270;
    s += (textureSample(uSource, linear, uv + blur.uStep * 1.3846).rgb + textureSample(uSource, linear, uv - blur.uStep * 1.3846).rgb) * .3162;
    s += (textureSample(uSource, linear, uv + blur.uStep * 3.2308).rgb + textureSample(uSource, linear, uv - blur.uStep * 3.2308).rgb) * .0703;
    return vec4f(s, 1.0);
}`;

const compositeShader = /* wgsl */`
${COMPOSITE.wgsl}
@group(0) @binding(0) var<uniform> c: Composite;
@group(0) @binding(1) var linear: sampler;
@group(0) @binding(2) var uNear: texture_2d<f32>;
@group(0) @binding(3) var uWide: texture_2d<f32>;
${screenCode}
@fragment fn compositeMain(in: Screen) -> @location(0) vec4f {
    var glow = (textureSample(uNear, linear, in.screen).rgb + textureSample(uWide, linear, in.screen).rgb * .55) * 4.0 * c.uStrength;
    glow = clamp(c.uGlowSpace * (1.0 - exp(-glow)), vec3f(0.0), vec3f(1.0));
    return vec4f(glow, max(glow.r, max(glow.g, glow.b)));
}`;

const shadowShader = /* wgsl */`
${SHADOW.wgsl}
@group(0) @binding(0) var<uniform> s: Shadow;
@vertex fn shadowVertex(@location(0) aPosition: vec3f) -> @builtin(position) vec4f {
    let world = (s.uModel * vec4f(aPosition, 1.0)).xyz;
    let t = (-0.9 - s.uLight.z) / min(world.z - s.uLight.z, -1e-3);
    let onWall = s.uLight + (world - s.uLight) * t;
    var clip = s.uProjection * vec4f(onWall - vec3f(0.0, 0.0, 7.0), 1.0);
    clip.z = (clip.z + clip.w) * .5;
    return clip;
}
@fragment fn shadowFragment() -> @location(0) vec4f { return vec4f(1.0); }`;

// Mipmaps, as GL's generateMipmap: each level the 2×2 average of the one above.
const mipShader = /* wgsl */`
@group(0) @binding(0) var linear: sampler;
@group(0) @binding(1) var uSource: texture_2d<f32>;
${screenCode}
@fragment fn mipMain(in: Screen) -> @location(0) vec4f { return textureSample(uSource, linear, in.screen); }`;

const PREMULTIPLIED = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
const MESH = [{ arrayStride: 32, attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x2' }] }];

// Every pipeline, compiled in parallel. A shader error rejects: the page then
// draws with WebGL.
async function createPipelines(device) {
    const module = async (code, label) => {
        const shader = device.createShaderModule({ code, label });
        const info = await shader.getCompilationInfo?.();
        const errors = info?.messages.filter(message => message.type === 'error') ?? [];
        if (errors.length) throw new Error(`${label}: ${errors.map(e => `${e.lineNum}:${e.linePos} ${e.message}`).join('; ')}`);
        return shader;
    };
    const [card, backdrop, blur, composite, shadow, mip] = await Promise.all([
        module(cardShader, 'card'), module(backdropShader, 'backdrop'), module(blurShader, 'blur'),
        module(compositeShader, 'composite'), module(shadowShader, 'shadow'), module(mipShader, 'mip')]);
    const visible = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    const cardLayout = device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: visible, buffer: {} },
        { binding: 1, visibility: visible, buffer: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: {} }] });
    const cardPipeline = (format, sampleCount, depthFormat, blend) => device.createRenderPipelineAsync({
        layout: device.createPipelineLayout({ bindGroupLayouts: [cardLayout] }),
        vertex: { module: card, entryPoint: 'vertexMain', buffers: MESH },
        fragment: { module: card, entryPoint: 'fragmentMain', targets: [{ format, blend }] },
        primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
        depthStencil: { format: depthFormat, depthCompare: 'less', depthWriteEnabled: true },
        multisample: { count: sampleCount }
    });
    const screenPipeline = (shader, entryPoint, format, options = {}) => device.createRenderPipelineAsync({
        layout: 'auto',
        vertex: { module: shader, entryPoint: 'screenMain' },
        fragment: { module: shader, entryPoint, targets: [{ format, blend: options.blend }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: options.depth ? { format: 'depth24plus', depthCompare: 'always', depthWriteEnabled: false } : undefined,
        multisample: { count: options.samples ?? 1 }
    });
    const [cardMain, cardBloom, backdropPipeline, compositePipeline, blurPipeline, shadowPipeline, mipPipeline] = await Promise.all([
        cardPipeline('rgba16float', SAMPLES, 'depth24plus', PREMULTIPLIED),
        cardPipeline('rgba8unorm', 1, 'depth16unorm'),
        screenPipeline(backdrop, 'backdropMain', 'rgba16float', { depth: true, samples: SAMPLES }),
        screenPipeline(composite, 'compositeMain', 'rgba16float', { depth: true, samples: SAMPLES, blend: PREMULTIPLIED }),
        screenPipeline(blur, 'blurMain', 'rgba8unorm'),
        device.createRenderPipelineAsync({
            layout: 'auto',
            vertex: { module: shadow, entryPoint: 'shadowVertex', buffers: [{ arrayStride: 32, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }] },
            fragment: { module: shadow, entryPoint: 'shadowFragment', targets: [{ format: 'rgba8unorm' }] },
            primitive: { topology: 'triangle-list', cullMode: 'none' }
        }),
        screenPipeline(mip, 'mipMain', 'rgba8unorm')
    ]);
    return { cardLayout, cardMain, cardBloom, backdrop: backdropPipeline, composite: compositePipeline, blur: blurPipeline,
        shadow: shadowPipeline, mip: mipPipeline };
}

const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const SRGB_TO_P3 = [.8224621, .0331941, .0170827, .1775380, .9668058, .0723974, 0, 0, .9105199];
const USAGE = () => ({ target: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    uniform: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

export class CardRenderer extends WebGLCardRenderer {
    static async create(canvas) {
        let gpu;
        try {
            gpu = await openDevice();
        } catch (error) {
            console.warn('WebGPU unavailable; drawing with WebGL.', error);
        }
        if (!gpu) {
            label('WebGL');
            return WebGLCardRenderer.create(canvas);
        }
        const { device } = gpu;
        // Let the loader reach the screen before compilation and warm-up start.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        performance.mark('card:create');
        let images, pipelines;
        try {
            [images, pipelines] = await Promise.all([
                Promise.all([logoImage('ru'), logoImage('en')]),
                createPipelines(device).then(result => { performance.mark('card:compiled'); return result; }),
                loadCardFont().catch(() => {})
            ]);
        } catch (error) {
            // The canvas has no context yet: WebGL can still have it.
            console.warn('WebGPU pipelines failed; drawing with WebGL.', error);
            device.destroy();
            label('WebGL');
            return WebGLCardRenderer.create(canvas);
        }
        const context = canvas.getContext('webgpu');
        const renderer = new CardRenderer(canvas, null, images, { device, context, pipelines });
        return renderer.start();
    }

    setupGraphics({ device, context, pipelines }) {
        this.device = device;
        this.context = context;
        this.pipelines = pipelines;
        this.maxTextureSize = device.limits.maxTextureDimension2D;
        const usage = USAGE();
        // The letters' textures as GL has them: trilinear, anisotropic, clamped.
        this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear',
            addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', maxAnisotropy: 8 });
        this.screenSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        const uniform = size => device.createBuffer({ size, usage: usage.uniform });
        this.frameBuffer = uniform(FRAME.size);
        // [pass][face]: 0 the picture, 1 the bloom pass.
        this.faceBuffers = [0, 1].map(() => [0, 1, 2].map(() => uniform(FACE.size)));
        this.backdropBuffer = uniform(BACKDROP.size);
        this.shadowBuffer = uniform(SHADOW.size);
        this.compositeBuffer = uniform(COMPOSITE.size);
        this.meshBuffers = [];
        this.targets = [];
        this.screen = null;
        this.watchScreen = matchMedia('(dynamic-range: high)');
        this.onScreenChange = () => this.configure();
        this.watchScreen.addEventListener('change', this.onScreenChange);
        this.configure();
        device.lost.then(info => console.warn('WebGPU device lost', info.message));
    }

    // Display P3, half-float, in extended range on an HDR screen: values past 1
    // are brighter than the page's white. The headroom is used only where the
    // browser confirms the extended range (or cannot say, on an HDR screen).
    configure() {
        const hdr = this.watchScreen.matches;
        this.context.configure({ device: this.device, format: 'rgba16float', colorSpace: 'display-p3',
            toneMapping: { mode: hdr ? 'extended' : 'standard' }, alphaMode: 'premultiplied' });
        const mode = this.context.getConfiguration?.()?.toneMapping?.mode;
        this.headroom = hdr && (mode === undefined || mode === 'extended') ? HEADROOM : 1;
        label(this.headroom > 1 ? `WebGPU · HDR ×${this.headroom}` : 'WebGPU');
    }

    applyOutput() {
        this.output = [1, 1, this.headroom];
    }

    finish() {
        return this.device.queue.onSubmittedWorkDone();
    }

    uploadMeshes(meshes) {
        this.meshBuffers.forEach(buffer => buffer.destroy());
        this.meshBuffers = meshes.map(mesh => {
            const buffer = this.device.createBuffer({ size: mesh.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            this.device.queue.writeBuffer(buffer, 0, mesh);
            return buffer;
        });
    }

    uploadTexture(source, width, height) {
        const device = this.device;
        const w = width || source.width, h = height || source.height;
        const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
        const texture = device.createTexture({ size: [w, h], format: 'rgba8unorm', mipLevelCount: levels,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
        if (width) device.queue.writeTexture({ texture }, source, { bytesPerRow: w * 4 }, [w, h]);
        // Not premultiplied, as GL uploads a canvas by default.
        else device.queue.copyExternalImageToTexture({ source }, { texture, premultipliedAlpha: false }, [w, h]);
        const encoder = device.createCommandEncoder();
        for (let level = 1; level < levels; level++) {
            const group = device.createBindGroup({ layout: this.pipelines.mip.getBindGroupLayout(0), entries: [
                { binding: 0, resource: this.screenSampler },
                { binding: 1, resource: texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 }) }] });
            const pass = encoder.beginRenderPass({ colorAttachments: [{
                view: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
            pass.setPipeline(this.pipelines.mip);
            pass.setBindGroup(0, group);
            pass.draw(3);
            pass.end();
        }
        device.queue.submit([encoder.finish()]);
        return texture;
    }

    deleteTextures(textures) {
        textures.forEach(texture => texture.destroy());
    }

    // Bloom chain and shadow at 1/4 of the canvas, as the WebGL backend.
    resizeTargets(width, height) {
        if (this.targets.length && this.targets[0].width === width && this.targets[0].height === height) return;
        this.deleteTargets();
        const device = this.device, usage = USAGE();
        const make = (w, h) => {
            const texture = device.createTexture({ size: [w, h], format: 'rgba8unorm', usage: usage.target });
            return { texture, view: texture.createView(), width: w, height: h };
        };
        const w8 = Math.max(1, Math.round(width / 2)), h8 = Math.max(1, Math.round(height / 2));
        this.targets = [make(width, height), make(width, height), make(w8, h8), make(w8, h8), make(width, height), make(width, height)];
        const [bright, blurA, wideA, wideB, shadowA, shadowB] = this.targets;
        this.brightDepth = device.createTexture({ size: [width, height], format: 'depth16unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT });
        // Every blur pass reads and writes fixed targets with a fixed step.
        const blurPass = (source, target, x, y) => {
            const buffer = device.createBuffer({ size: BLUR.size, usage: usage.uniform });
            device.queue.writeBuffer(buffer, 0, BLUR.pack({ uStep: [x / source.width, y / source.height] }));
            const group = device.createBindGroup({ layout: this.pipelines.blur.getBindGroupLayout(0), entries: [
                { binding: 0, resource: { buffer } }, { binding: 1, resource: this.screenSampler }, { binding: 2, resource: source.view }] });
            return { target, group, buffer };
        };
        this.bloomPasses = [blurPass(bright, blurA, 1, 0), blurPass(blurA, bright, 0, 1), blurPass(bright, wideA, 1.5, 0),
            blurPass(wideA, wideB, 0, 1.5), blurPass(wideB, wideA, 2.5, 0), blurPass(wideA, wideB, 0, 2.5)];
        this.shadowPasses = [1, 2.2, 4].flatMap(radius => [blurPass(shadowA, shadowB, radius, 0), blurPass(shadowB, shadowA, 0, radius)]);
        this.backdropGroup = device.createBindGroup({ layout: this.pipelines.backdrop.getBindGroupLayout(0), entries: [
            { binding: 0, resource: { buffer: this.backdropBuffer } }, { binding: 1, resource: this.screenSampler }, { binding: 2, resource: shadowA.view }] });
        this.compositeGroup = device.createBindGroup({ layout: this.pipelines.composite.getBindGroupLayout(0), entries: [
            { binding: 0, resource: { buffer: this.compositeBuffer } }, { binding: 1, resource: this.screenSampler },
            { binding: 2, resource: bright.view }, { binding: 3, resource: wideB.view }] });
        this.shadowGroup = device.createBindGroup({ layout: this.pipelines.shadow.getBindGroupLayout(0), entries: [
            { binding: 0, resource: { buffer: this.shadowBuffer } }] });
    }

    deleteTargets() {
        this.targets.forEach(target => target.texture.destroy());
        [...(this.bloomPasses || []), ...(this.shadowPasses || [])].forEach(pass => pass.buffer.destroy());
        this.brightDepth?.destroy();
        this.targets = [];
    }

    // The canvas-sized multisampled colour and depth the picture is drawn into.
    screenTargets() {
        const { width, height } = this.canvas;
        if (this.screen && this.screen.width === width && this.screen.height === height) return this.screen;
        this.screen?.color.destroy();
        this.screen?.depth.destroy();
        const make = format => this.device.createTexture({ size: [width, height], format, sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        const color = make('rgba16float'), depth = make('depth24plus');
        this.screen = { width, height, color, depth, colorView: color.createView(), depthView: depth.createView() };
        return this.screen;
    }

    // Bind groups for [pass][face]; rebuilt when the textures are.
    cardGroups() {
        if (this.groupsFor === this.engravingTextures && this.groupsText === this.textures) return this.groups;
        this.groupsFor = this.engravingTextures;
        this.groupsText = this.textures;
        this.groups = this.faceBuffers.map(buffers => buffers.map((buffer, face) => {
            const side = face === 1 ? 1 : 0;
            return this.device.createBindGroup({ layout: this.pipelines.cardLayout, entries: [
                { binding: 0, resource: { buffer: this.frameBuffer } }, { binding: 1, resource: { buffer } },
                { binding: 2, resource: this.sampler },
                { binding: 3, resource: this.textures[side].createView() }, { binding: 4, resource: this.engravingTextures[side].createView() }] });
        }));
        return this.groups;
    }

    render(backdrop, focusLink) {
        const { device, pipelines } = this, queue = device.queue;
        queue.writeBuffer(this.frameBuffer, 0, FRAME.pack(this.cardParams));
        for (let face = 0; face < 3; face++) {
            const params = this.faceParams(face, focusLink);
            for (const bloom of [0, 1]) queue.writeBuffer(this.faceBuffers[bloom][face], 0, FACE.pack({ ...params, uBloomPass: bloom }));
        }
        const groups = this.cardGroups();
        const encoder = device.createCommandEncoder();
        const drawCard = (pass, bloom) => {
            pass.setPipeline(bloom ? pipelines.cardBloom : pipelines.cardMain);
            for (let face = 0; face < 3; face++) {
                pass.setBindGroup(0, groups[bloom][face]);
                pass.setVertexBuffer(0, this.meshBuffers[face]);
                pass.draw(this.counts[face]);
            }
        };
        const blur = passes => {
            for (const { target, group } of passes) {
                const pass = encoder.beginRenderPass({ colorAttachments: [{ view: target.view, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
                pass.setPipeline(pipelines.blur);
                pass.setBindGroup(0, group);
                pass.draw(3);
                pass.end();
            }
        };
        // 1. Highlights above white at quarter resolution, 2. blurred twice.
        const bright = this.targets[0];
        let pass = encoder.beginRenderPass({
            colorAttachments: [{ view: bright.view, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }],
            depthStencilAttachment: { view: this.brightDepth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' } });
        drawCard(pass, 1);
        pass.end();
        blur(this.bloomPasses);
        if (backdrop) {
            // 2b. The card's silhouette from the key light, blurred wide.
            queue.writeBuffer(this.shadowBuffer, 0, SHADOW.pack({ uModel: this.model, uProjection: this.projection, uLight: this.keyLight }));
            pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.targets[4].view, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
            pass.setPipeline(pipelines.shadow);
            pass.setBindGroup(0, this.shadowGroup);
            pass.setVertexBuffer(0, this.meshBuffers[0]);
            pass.draw(this.counts[0]);
            pass.end();
            blur(this.shadowPasses);
        }
        // 3. Backdrop, the card with 4× MSAA, 4. the glow over both.
        const screen = this.screenTargets();
        pass = encoder.beginRenderPass({
            colorAttachments: [{ view: screen.colorView, resolveTarget: this.context.getCurrentTexture().createView(),
                loadOp: 'clear', storeOp: 'discard', clearValue: [0, 0, 0, 0] }],
            depthStencilAttachment: { view: screen.depthView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' } });
        if (backdrop) {
            queue.writeBuffer(this.backdropBuffer, 0, BACKDROP.pack(this.backdropParams));
            pass.setPipeline(pipelines.backdrop);
            pass.setBindGroup(0, this.backdropGroup);
            pass.draw(3);
        }
        drawCard(pass, 0);
        queue.writeBuffer(this.compositeBuffer, 0, COMPOSITE.pack({ uStrength: this.bloomStrength, uGlowSpace: this.output[0] ? SRGB_TO_P3 : IDENTITY3 }));
        pass.setPipeline(pipelines.composite);
        pass.setBindGroup(0, this.compositeGroup);
        pass.draw(3);
        pass.end();
        queue.submit([encoder.finish()]);
    }

    destroy() {
        if (this.onOrientation) window.removeEventListener('deviceorientation', this.onOrientation);
        this.watchScreen.removeEventListener('change', this.onScreenChange);
        this.device.destroy();
    }
}

async function openDevice() {
    if (!PORTED) throw new Error(`WebGPU shaders are written for Noir, not ${direction.id}`);
    if (!navigator.gpu) throw new Error('no navigator.gpu');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('no adapter');
    return { device: await adapter.requestDevice() };
}

// This page is a trial: a quiet note of what draws it, bottom left.
function label(text) {
    let note = document.querySelector('.renderer-note');
    if (!note) {
        note = Object.assign(document.createElement('div'), { className: 'renderer-note' });
        note.setAttribute('aria-hidden', 'true');
        note.style.cssText = 'position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));'
            + 'z-index:12;font:11px/1 system-ui,sans-serif;letter-spacing:.02em;color:rgb(var(--loader)/.45);pointer-events:none';
        document.body.append(note);
    }
    note.textContent = text;
    document.documentElement.dataset.renderer = text.startsWith('WebGPU') ? 'webgpu' : 'webgl';
}
