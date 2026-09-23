import { cards, logos } from './data.js';
import { createEngravingMap } from './engraving.js';
import { art } from './art-direction.js';

const HALF_THICKNESS = 0.055;
const BEVEL = 0.018;

const finishes = {
    silver: { metal: [.847, .859, .878], edge: [.50, .54, .58], ink: '#20252b', secondary: '#30353a', link: '#30353a' },
    titanium: { metal: [.86, .81, .72], edge: [.55, .51, .43], ink: '#292722', secondary: '#35312a', link: '#35312a' },
    graphite: { metal: [.28, .31, .35], edge: [.23, .26, .30], ink: '#f0f1f2', secondary: '#e1e4e9', link: '#e1e4e9' }
};
const requestedFinish = new URLSearchParams(location.search).get('finish');
const finish = Object.hasOwn(finishes, requestedFinish) ? finishes[requestedFinish] : finishes.silver;

// Sample once per page, not per frame or resize. Context recovery keeps the
// same composition; reloading gives the card and light new, bounded trajectories.
const between = (min, max) => min + Math.random() * (max - min);
const variation = {
    poseX: between(-.035, .035), poseY: between(-.045, .045), poseZ: between(-.012, .012),
    phaseX: between(0, Math.PI * 2), phaseY: between(0, Math.PI * 2), phaseZ: between(0, Math.PI * 2),
    floatPhase: between(0, Math.PI * 2), idleSpeed: between(.85, 1.15), idleAmplitude: between(.8, 1.15),
    lightPhase: between(0, Math.PI * 2), lightPeriod: between(19, 27),
    lightX: between(-3.3, -2.7), lightY: between(3.7, 4.3), lightTravel: between(1.25, 1.85),
    backgroundPhase: between(0, Math.PI * 2)
};

const vertexSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;
uniform mat4 uModel;
uniform mat4 uProjection;
uniform vec2 uUVBasis;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vTangent;
varying vec3 vBitangent;
void main() {
    vec4 world = uModel * vec4(aPosition, 1.0);
    vPosition = world.xyz;
    vNormal = mat3(uModel) * aNormal;
    vUV = aUV;
    vTangent = mat3(uModel) * vec3(uUVBasis.x, 0.0, 0.0);
    vBitangent = mat3(uModel) * vec3(0.0, uUVBasis.y, 0.0);
    gl_Position = uProjection * vec4(world.xyz - vec3(0.0, 0.0, 7.0), 1.0);
}`;

const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTexture;
uniform float uEdge;
uniform vec3 uGlowPosition;
uniform float uGlowIntensity;
uniform vec3 uKeyPosition;
uniform vec3 uMetalTone;
uniform vec3 uEdgeTone;
uniform vec4 uHoverRect;
uniform vec4 uFocusRect;
uniform vec3 uHoverColor;
uniform sampler2D uEngraving;
uniform vec2 uLayoutSize;
uniform vec4 uLogoRect;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vTangent;
varying vec3 vBitangent;

vec3 metalLighting(vec3 normal, vec3 view, vec3 light) {
    // One moving softbox drives the illumination, reflection and cast shadow.
    vec3 lightOffset = normalize(uKeyPosition) - normalize(vec3(-3.0, 4.0, 6.0));
    vec3 halfVector = normalize(light + view);
    vec3 reflection = reflect(-view, normal);
    float diffuse = max(dot(normal, light), 0.0);
    float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 4.0);
    float softbox = exp(-pow((reflection.x + 0.35 - lightOffset.x) * 1.6, 2.0)
                       -pow((reflection.y - 0.50 - lightOffset.y) * 1.5, 2.0));
    float specular = pow(max(dot(normal, halfVector), 0.0), 24.0);
    // A circular source has falloff in both directions, rather than an infinite stripe.
    vec2 reflectionOffset = reflection.xy - lightOffset.xy - vec2(0.02, 0.08);
    float reflectionDistance = dot(reflectionOffset, reflectionOffset);
    float finishVariation = sin(vUV.y * 17.0 + sin(vUV.x * 6.0)) * 0.025;
    float polishedReflection = exp(-reflectionDistance * 12.0);
    float highlightCore = exp(-reflectionDistance * 34.0);
    float edgeGlint = pow(max(dot(normal, halfVector), 0.0), 96.0);
    vec3 silver = mix(uMetalTone, uEdgeTone, uEdge);
    float grain = (sin(vUV.y * 420.0 + sin(vUV.x * 4.0) * 0.3)
                 + sin(vUV.y * 193.0)) * 0.0012;
    vec3 color = silver * (0.43 + 0.22 * diffuse + grain);
    color += vec3(0.15, 0.17, 0.19) * softbox + vec3(0.11) * specular;
    color += vec3(0.22, 0.235, 0.25) * polishedReflection * (1.0 + finishVariation);
    color += vec3(0.12, 0.12, 0.115) * highlightCore;
    color += vec3(0.30, 0.34, 0.39) * fresnel;
    color += vec3(0.22, 0.24, 0.27) * edgeGlint * uEdge;
    // The same source drives the background glow and its reflection on the rim.
    vec3 toGlow = uGlowPosition - vPosition;
    float facingGlow = max(dot(normal, normalize(toGlow)), 0.0);
    float falloff = 1.0 / (1.0 + dot(toGlow, toGlow) * 0.15);
    vec3 glowColor = mix(vec3(0.16, 0.67, 0.88), vec3(0.57, 0.28, 0.86),
                         smoothstep(-2.0, 2.0, vPosition.x - uGlowPosition.x));
    color += glowColor * facingGlow * falloff * (0.48 * uEdge + 0.06 * fresnel) * uGlowIntensity;
    // Roll off the brightest reflection rather than clipping it into a white patch.
    color = max(color, vec3(0.0));
    color = color / (vec3(1.0) + color * 0.12);
    return color;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 view = normalize(vec3(0.0, 0.0, 7.0) - vPosition);
    vec3 light = normalize(uKeyPosition - vPosition);
    vec3 color = metalLighting(normal, view, light);
    vec4 ink = texture2D(uTexture, vUV);
    vec4 relief = texture2D(uEngraving, vUV);
    float engraved = clamp(relief.a / max(ink.a, 0.001), 0.0, 1.0) * (1.0 - uEdge);
    vec3 paint = ink.rgb / max(ink.a, 0.001);
    // Flat body text remains matte and is not turned into a height field.
    vec3 inkColor = paint;
    // Derivatives must be evaluated outside non-uniform glyph branches.
    #ifdef HAS_DERIVATIVES
    float footprint = max(fwidth(vUV.x) * uLayoutSize.x, fwidth(vUV.y) * uLayoutSize.y);
    float resolved = 1.0 - smoothstep(0.85, 1.8, footprint);
    #else
    float resolved = smoothstep(0.18, 0.55, abs(dot(normal, view)));
    #endif
    if (engraved > 0.001) {
        vec2 mappedXY = (relief.rg * 255.0 - 128.0) / 127.0;
        mappedXY *= resolved;
        float slope = length(mappedXY);
        vec3 facetNormal = normalize(normalize(vTangent) * mappedXY.x
                         + normalize(vBitangent) * mappedXY.y
                         + normal * sqrt(max(0.01, 1.0 - dot(mappedXY, mappedXY))));
        float wall = smoothstep(0.035, 0.30, slope) * 0.58 * resolved;
        // Dark matte fill on the floor; the narrow cut wall reflects the same
        // studio source as the plate, with mild cavity occlusion.
        vec3 floorInk = paint * (0.91 + 0.09 * max(dot(normal, light), 0.0)) * (1.0 - 0.18 * relief.b);
        float facetLight = max(dot(facetNormal, light), 0.0);
        float wallExposure = smoothstep(-0.20, 0.10, facetLight - max(dot(normal, light), 0.0));
        vec3 litWall = metalLighting(facetNormal, view, light) * (0.65 + 0.28 * facetLight);
        // The occluded wall must become darker, not a second silver outline.
        vec3 cutMetal = mix(floorInk * 0.58, litWall, wallExposure);
        float logoRegion = step(uLogoRect.x, vUV.x) * step(uLogoRect.y, vUV.y)
                         * step(vUV.x, uLogoRect.z) * step(vUV.y, uLogoRect.w);
        vec3 stampedFace = metalLighting(normal, view, light) * ${art.logo.face.toFixed(3)} + uMetalTone * 0.018;
        stampedFace += vec3(${art.logo.warmth.toFixed(3)}, ${(art.logo.warmth * .5).toFixed(3)}, 0.0);
        stampedFace *= ${art.logo.raised ? '1.0' : '(1.0 - 0.14 * relief.b)'};
        vec3 stampedWall = mix(stampedFace * 0.64,
                               metalLighting(facetNormal, view, light) * (1.02 + 0.12 * facetLight),
                               smoothstep(-0.16, 0.13, facetLight - max(dot(normal, light), 0.0)));
        float stampedBevel = smoothstep(0.035, 0.30, slope) * ${art.logo.wall.toFixed(3)} * resolved;
        vec3 stampedMetal = mix(stampedFace, stampedWall, stampedBevel);
        inkColor = mix(paint, mix(floorInk, cutMetal, wall), engraved);
        // The chosen monochrome relief catches the same moving softbox as the
        // plate. Coverage is preserved, so no exterior outline is introduced.
        inkColor = mix(inkColor, stampedMetal, engraved * logoRegion);
    }
    // Preserve the original glyph coverage: the bevel cannot create an outer halo.
    color = mix(color, inkColor, ink.a * (1.0 - uEdge));
    #ifdef HAS_DERIVATIVES
    vec2 aa = max(fwidth(vUV) * 0.7, vec2(0.00001));
    #else
    vec2 aa = vec2(0.0006, 0.001);
    #endif
    vec2 enter = smoothstep(uHoverRect.xy - aa, uHoverRect.xy + aa, vUV);
    vec2 leave = 1.0 - smoothstep(uHoverRect.zw - aa, uHoverRect.zw + aa, vUV);
    float underline = enter.x * enter.y * leave.x * leave.y;
    color = mix(color, uHoverColor, underline * (1.0 - uEdge));
    vec2 focusInside = step(uFocusRect.xy, vUV) * step(vUV, uFocusRect.zw);
    #ifdef HAS_DERIVATIVES
    vec2 focusThickness = max(fwidth(vUV) * 2.4, vec2(0.0014));
    #else
    vec2 focusThickness = vec2(0.0025);
    #endif
    vec2 focusEdge = min(vUV - uFocusRect.xy, uFocusRect.zw - vUV);
    float focusStroke = focusInside.x * focusInside.y
        * (1.0 - step(focusThickness.x, focusEdge.x))
        + focusInside.x * focusInside.y * (1.0 - step(focusThickness.y, focusEdge.y));
    color = mix(color, uHoverColor, min(focusStroke, 1.0) * (1.0 - uEdge));
    gl_FragColor = vec4(color, 1.0);
}`;

function program(gl) {
    const derivatives = gl.getExtension('OES_standard_derivatives');
    const shaders = [];
    const result = gl.createProgram();
    try {
        for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
            const shader = gl.createShader(type);
            shaders.push(shader);
            const prefix = type === gl.FRAGMENT_SHADER && derivatives
                ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIVATIVES\n' : '';
            gl.shaderSource(shader, prefix + source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
            gl.attachShader(result, shader);
        }
        gl.linkProgram(result);
        if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result));
        return result;
    } catch (error) {
        gl.deleteProgram(result);
        throw error;
    } finally {
        shaders.forEach(shader => gl.deleteShader(shader));
    }
}

// Column-major rotation RY * RX; uniform scale keeps normals correct after normalization.
function modelMatrix(x, y, scale, lift, z = 0) {
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y);
    const matrix = new Float32Array([
        cy * scale, 0, -sy * scale, 0,
        sy * sx * scale, cx * scale, cy * sx * scale, 0,
        sy * cx * scale, -sx * scale, cy * cx * scale, 0,
        0, lift, 0, 1
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

// Analytic critically damped spring: velocity stays continuous when the target
// changes abruptly. Unlike a lerp, a pointer jump does not create an instant kick.
function follow(value, velocity, target, frequency, dt) {
    const offset = value - target;
    const decay = Math.exp(-frequency * dt);
    const step = (velocity + frequency * offset) * dt;
    return [target + (offset + step) * decay, (velocity - frequency * step) * decay];
}

function projectionMatrix(aspect) {
    const f = 1 / Math.tan(Math.PI / 8), near = 0.1, far = 30;
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
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

function geometry(width, height, vertical) {
    const outline = roundedOutline(width, height, vertical);
    // Average adjacent contour normals so the rounded rim reflects smoothly.
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
    const depth = HALF_THICKNESS;
    const inset = point => [point[0] * (1 - BEVEL * 2 / width), point[1] * (1 - BEVEL * 2 / height)];
    function vertex(target, x, y, z, nx, ny, nz, back = false) {
        let u = x / width + .5, v = .5 - y / height;
        if (back) { if (vertical) u = 1 - u; else v = 1 - v; }
        target.push(x, y, z, nx, ny, nz, u, v);
    }
    outline.forEach((a, i) => {
        const b = outline[(i + 1) % outline.length];
        const ai = inset(a), bi = inset(b);
        for (const p of [[0, 0], bi, ai]) vertex(faces[0], ...p, depth, 0, 0, 1);
        for (const p of [[0, 0], ai, bi]) vertex(faces[1], ...p, -depth, 0, 0, -1, true);
        const normalA = rimNormals[i], normalB = rimNormals[(i + 1) % outline.length];
        function ring(topA, topB, topZ, bottomA, bottomB, bottomZ, nz) {
            const length = Math.hypot(1, nz);
            for (const [p, z, n] of [[topA, topZ, normalA], [topB, topZ, normalB], [bottomA, bottomZ, normalA], [bottomA, bottomZ, normalA], [topB, topZ, normalB], [bottomB, bottomZ, normalB]]) {
                vertex(faces[2], ...p, z, n[0] / length, n[1] / length, nz / length);
            }
        }
        ring(ai, bi, depth, a, b, depth - BEVEL, 1);
        ring(a, b, depth - BEVEL, a, b, -depth + BEVEL, 0);
        ring(a, b, -depth + BEVEL, ai, bi, -depth, -1);
    });
    return faces.map(face => new Float32Array(face));
}

function logoImage(lang) {
    const logo = logos[lang];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logo.viewBox}" width="${logo.viewBox.split(' ')[2]}" height="${logo.viewBox.split(' ')[3]}"><path d="${logo.text}" fill="${finish.ink}"/><path d="${logo.ya}" fill="${finish.ink}"/></svg>`;
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
}

function textureCanvas(lang, vertical, logo, maxSize) {
    const width = vertical ? 300 : 545, height = vertical ? 545 : 300;
    const data = cards[lang];
    const canvas = document.createElement('canvas');
    // WebGL 1 requires power-of-two dimensions for mipmapped textures.
    const textureSize = length => Math.min(maxSize, 2 ** Math.ceil(Math.log2(length * 2.5)));
    canvas.width = textureSize(width);
    canvas.height = textureSize(height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.scale(canvas.width / width, canvas.height / height);
    // Transparent substrate: alpha is the printed-ink mask for the paint shader.
    context.clearRect(0, 0, width, height);
    const links = [];
    const x = vertical ? width / 2 : 56;
    context.textAlign = vertical ? 'center' : 'left';
    const logoWidth = vertical ? 100 : 145;
    const viewBox = logos[lang].viewBox.split(' ').map(Number);
    const logoHeight = logoWidth * viewBox[3] / viewBox[2];
    const logoX = vertical ? (width - logoWidth) / 2 : 56;
    const logoY = vertical ? 104 : 42;
    const textSize = vertical ? 12 : 13;
    const finalBaseline = vertical ? 278 + 18 * 3 : 188 + 18;
    context.font = `400 ${textSize}px "Card Onest", Arial, sans-serif`;
    const finalMetrics = context.measureText(vertical ? data.site : 't.me/sbmaxx');
    const blockTop = logoY;
    const blockBottom = finalBaseline + finalMetrics.actualBoundingBoxDescent;
    const yOffset = (height - blockTop - blockBottom) / 2;
    function text(value, y, size, color = finish.ink, url, weight = 400) {
        y += yOffset;
        context.font = `${weight} ${size}px "Card Onest", Arial, sans-serif`;
        context.fillStyle = color;
        const metrics = context.measureText(value);
        // Align visible glyph edges, not their differing left side bearings.
        const drawX = vertical ? x : x + metrics.actualBoundingBoxLeft;
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
    const titleRelief = text(data.name, vertical ? 187 : 130, vertical ? 22 : art.nameSize, finish.ink, undefined, 500);
    const logoRelief = [(logoX - 2) / width, (logoY + yOffset - 2) / height,
        (logoX + logoWidth + 2) / width, (logoY + yOffset + logoHeight + 2) / height];
    text(data.position, vertical ? 212 : 152, vertical ? 12 : 13, finish.secondary);
    const y = vertical ? 278 : 188;
    const size = vertical ? 12 : 13, lineHeight = vertical ? 18 : 18;
    // The email and personal site use name ink; Telegram retains secondary ink.
    text('sbmaxx@yandex-team.ru', y, size, finish.ink, 'mailto:sbmaxx@yandex-team.ru');
    text('t.me/sbmaxx', y + lineHeight, size, finish.secondary, 'https://t.me/sbmaxx');
    if (vertical) text(data.site, y + lineHeight * 3, size, finish.ink, `https://${data.site}`);
    return { canvas, links, width, height, titleRelief, logoRelief };
}

export class CardRenderer {
    static async create(canvas) {
        const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: 'low-power' });
        if (!gl) throw new Error('WebGL unavailable');
        const [images] = await Promise.all([
            Promise.all([logoImage('ru'), logoImage('en')]),
            Promise.all([document.fonts.load('400 12px "Card Onest"'), document.fonts.load('500 20px "Card Onest"')]).catch(() => {})
        ]);
        return new CardRenderer(canvas, gl, images);
    }

    constructor(canvas, gl, images) {
        this.canvas = canvas;
        this.gl = gl;
        this.images = images;
        this.program = program(gl);
        this.attributes = Object.fromEntries(['aPosition', 'aNormal', 'aUV'].map(name => [name, gl.getAttribLocation(this.program, name)]));
        this.uniforms = Object.fromEntries(['uModel', 'uProjection', 'uEdge', 'uTexture', 'uGlowPosition', 'uGlowIntensity', 'uKeyPosition', 'uMetalTone', 'uEdgeTone', 'uHoverRect', 'uFocusRect', 'uHoverColor', 'uEngraving', 'uUVBasis', 'uLayoutSize', 'uLogoRect'].map(name => [name, gl.getUniformLocation(this.program, name)]));
        this.buffers = [];
        this.textures = [];
        this.engravingTextures = [];
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
        this.anisotropy = gl.getExtension('EXT_texture_filter_anisotropic')
            || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.clearColor(0, 0, 0, 0);
    }

    resize() {
        const gl = this.gl;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width; this.canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        this.aspect = width / height;
        this.viewportWidth = rect.width;
        this.viewportHeight = rect.height;
        const vertical = innerWidth <= 700;
        if (vertical !== this.vertical) this.rebuild(vertical);
        this.projection = projectionMatrix(this.aspect);
    }

    rebuild(vertical) {
        const gl = this.gl;
        this.buffers.forEach(buffer => gl.deleteBuffer(buffer));
        this.textures.forEach(texture => gl.deleteTexture(texture));
        this.engravingTextures.forEach(texture => gl.deleteTexture(texture));
        this.vertical = vertical;
        this.width = vertical ? 2.333 : 4.235;
        this.height = vertical ? 4.235 : 2.333;
        this.outline = roundedOutline(this.width, this.height, vertical);
        const meshes = geometry(this.width, this.height, vertical);
        this.counts = meshes.map(mesh => mesh.length / 8);
        this.buffers = meshes.map(mesh => {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
            return buffer;
        });
        const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this.surfaces = ['ru', 'en'].map((lang, i) => textureCanvas(lang, vertical, this.images[i], maxSize));
        this.textures = this.surfaces.map(({ canvas }) => {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            if (this.anisotropy) {
                gl.texParameterf(gl.TEXTURE_2D, this.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
                    Math.min(8, gl.getParameter(this.anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
            }
            return texture;
        });
        this.engravingTextures = this.surfaces.map(surface => {
            const relief = createEngravingMap(surface);
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, relief.width, relief.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, relief.data);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            if (this.anisotropy) gl.texParameterf(gl.TEXTURE_2D, this.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
                Math.min(8, gl.getParameter(this.anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
            return texture;
        });
    }

    draw({ rx, ry, rz = 0, zoom, dragging = false, flipped, animate, idle = true, freezeTilt = false, freezeHover = false, focusLink = null, reduced, delta }) {
        const gl = this.gl;
        const dt = Math.min(delta, 0.05);
        if (animate) this.time += dt;
        const lightPhase = this.time * Math.PI * 2 / variation.lightPeriod + variation.lightPhase;
        this.keyLight = [variation.lightX + Math.sin(lightPhase) * variation.lightTravel, variation.lightY + Math.sin(lightPhase + .7) * .65, 6];
        const idleTarget = animate && idle && !dragging ? 1 : 0;
        if (reduced) this.idleWeight = 0;
        else if (!freezeTilt) this.idleWeight += (idleTarget - this.idleWeight) * (1 - Math.exp(-dt * (idleTarget ? 1.6 : 10)));
        const idleTime = this.time * variation.idleSpeed;
        const breathX = Math.sin(idleTime * .48 + variation.phaseX) * .065 * variation.idleAmplitude * this.idleWeight;
        const breathY = Math.cos(idleTime * .36 + variation.phaseY) * .085 * variation.idleAmplitude * this.idleWeight;
        const nextFlip = flipped ? Math.PI : 0;
        if (nextFlip !== this.flipTarget) {
            this.flipFrom = this.flipAngle;
            this.flipTarget = nextFlip;
            this.flipProgress = 0;
        }
        this.flipProgress = reduced ? 1 : Math.min(1, this.flipProgress + dt / 1.65);
        const progress = this.flipProgress;
        const ease = progress * progress * (3 - 2 * progress);
        this.flipAngle = this.flipFrom + (this.flipTarget - this.flipFrom) * ease;
        const targetX = variation.poseX + (reduced ? 0 : rx * Math.PI / 180 + breathX);
        const targetY = variation.poseY + (reduced ? 0 : ry * Math.PI / 180 + breathY);
        const targetZ = variation.poseZ + (reduced ? 0 : rz * Math.PI / 180 + Math.sin(idleTime * .28 + variation.phaseZ) * .012 * this.idleWeight);
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
            const targetLift = Math.sin(idleTime * .55 + variation.floatPhase) * .035 * this.idleWeight;
            this.lift += (targetLift - this.lift) * blend;
        }
        const fit = Math.min(1, this.aspect * (this.vertical ? 2.2 : 1.23)) * (this.vertical ? 1 : .81);
        // Pointer tilt lives in screen space; the card flips in its own space.
        // Adding Euler angles inverted pitch on the portrait back face.
        if (reduced) { this.zoom = zoom; this.zoomVelocity = 0; }
        else [this.zoom, this.zoomVelocity] = follow(this.zoom, this.zoomVelocity, zoom, 10, dt);
        const tilt = modelMatrix(this.rotationX, this.rotationY, this.zoom * fit, this.lift, this.rotationZ);

        const flip = modelMatrix(this.vertical ? 0 : this.flipAngle, this.vertical ? this.flipAngle : 0, 1, 0);
        this.model = multiplyMatrices(tilt, flip);
        this.hoveredLink = this.hoverPointer && !dragging && !freezeHover
            ? this.linkAt(this.hoverPointer.x, this.hoverPointer.y) : null;
        this.updateShadow();
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uniforms.uModel, false, this.model);
        gl.uniformMatrix4fv(this.uniforms.uProjection, false, this.projection);
        gl.uniform3f(this.uniforms.uKeyPosition, ...this.keyLight);
        gl.uniform3f(this.uniforms.uMetalTone, ...finish.metal);
        gl.uniform3f(this.uniforms.uEdgeTone, ...finish.edge);
        gl.uniform3f(this.uniforms.uHoverColor, ...[1, 3, 5].map(index => parseInt(finish.ink.slice(index, index + 2), 16) / 255));
        const phase = this.time * Math.PI * 2 / 18 + variation.backgroundPhase;
        this.ambientOpacity = .62 + Math.sin(phase) * .055;
        // Background and subtle coloured rim breathe together; no travelling spot.
        gl.uniform3f(this.uniforms.uGlowPosition, -1.4, .6, -1.5);
        gl.uniform1f(this.uniforms.uGlowIntensity, this.ambientOpacity / .62);
        gl.uniform1i(this.uniforms.uTexture, 0);
        gl.uniform1i(this.uniforms.uEngraving, 1);
        gl.activeTexture(gl.TEXTURE0);
        for (let i = 0; i < 3; i++) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[i]);
            for (const [name, size, offset] of [['aPosition', 3, 0], ['aNormal', 3, 12], ['aUV', 2, 24]]) {
                gl.enableVertexAttribArray(this.attributes[name]);
                gl.vertexAttribPointer(this.attributes[name], size, gl.FLOAT, false, 32, offset);
            }
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures[i === 1 ? 1 : 0]);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.engravingTextures[i === 1 ? 1 : 0]);
            gl.activeTexture(gl.TEXTURE0);
            gl.uniform1f(this.uniforms.uEdge, i === 2 ? 1 : 0);
            const inkSurface = this.surfaces[i === 1 ? 1 : 0];
            gl.uniform2f(this.uniforms.uUVBasis, i === 1 && this.vertical ? -1 : 1, i === 1 && !this.vertical ? 1 : -1);
            gl.uniform2f(this.uniforms.uLayoutSize, inkSurface.width, inkSurface.height);
            gl.uniform4f(this.uniforms.uLogoRect, ...inkSurface.logoRelief);
            const hover = this.hoveredLink;
            if (hover && hover.side === i && hover.underlineY != null) {
                const surface = this.surfaces[i];
                gl.uniform4f(this.uniforms.uHoverRect, hover.x / surface.width, hover.underlineY / surface.height,
                    (hover.x + hover.width) / surface.width, (hover.underlineY + 1) / surface.height);
            } else gl.uniform4f(this.uniforms.uHoverRect, -2, -2, -1, -1);
            if (focusLink && focusLink.side === i) {
                const surface = this.surfaces[i];
                gl.uniform4f(this.uniforms.uFocusRect,
                    focusLink.x / surface.width, focusLink.y / surface.height,
                    (focusLink.x + focusLink.width) / surface.width,
                    (focusLink.y + focusLink.height) / surface.height);
            } else gl.uniform4f(this.uniforms.uFocusRect, -2, -2, -1, -1);
            gl.drawArrays(gl.TRIANGLES, 0, this.counts[i]);
        }
        return this.flipProgress < 1 || Math.abs(targetX - this.rotationX) + Math.abs(targetY - this.rotationY)
            + Math.abs(zoom - this.zoom) + Math.abs(this.zoomVelocity)
            + Math.abs(targetZ - this.rotationZ) + Math.abs(this.velocityZ)
            + Math.abs(this.velocityX) + Math.abs(this.velocityY) > .0005;
    }

    updateShadow() {
        // Project the rounded card contour, not an axis-aligned bounding ellipse.
        const m = this.model;
        const [lx, ly, lz] = this.keyLight;
        const f = 1 / Math.tan(Math.PI / 8);
        const points = this.outline.map(([x, y]) => {
            const wx = m[0] * x + m[4] * y + m[12];
            const wy = m[1] * x + m[5] * y + m[13];
            const wz = m[2] * x + m[6] * y + m[14];
            const distance = (-0.9 - lz) / (wz - lz);
            const sx = lx + (wx - lx) * distance;
            const sy = ly + (wy - ly) * distance;
            return [(sx * f / (7.9 * this.aspect) + 1) * this.viewportWidth / 2,
                (1 - sy * f / 7.9) * this.viewportHeight / 2];
        });
        this.shadowPoints = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    }

    // Ray / local card plane intersection. Links follow the actual GPU transform.
    surfacePoint(clientX, clientY) {
        if (!this.model || this.flipProgress < 1) return null;
        const rect = this.canvas.getBoundingClientRect();
        const f = 1 / Math.tan(Math.PI / 8);
        const ray = [(2 * (clientX - rect.left) / rect.width - 1) * this.aspect / f, (1 - 2 * (clientY - rect.top) / rect.height) / f, -1];
        const m = this.model;
        const scale2 = m[0] ** 2 + m[1] ** 2 + m[2] ** 2;
        const inverse = v => [0, 4, 8].map(i => (m[i] * v[0] + m[i + 1] * v[1] + m[i + 2] * v[2]) / scale2);
        const origin = inverse([-m[12], -m[13], 7 - m[14]]);
        const direction = inverse(ray);
        if (Math.abs(direction[2]) < .001) return null;
        const back = origin[2] < 0;
        const faceZ = back ? -HALF_THICKNESS : HALF_THICKNESS;
        const t = (faceZ - origin[2]) / direction[2];
        if (t < 0) return null;
        const px = origin[0] + direction[0] * t, py = origin[1] + direction[1] * t;
        const outline = this.outline;
        for (let i = 0; i < outline.length; i++) {
            const a = outline[i], b = outline[(i + 1) % outline.length];
            if ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]) > .0001) return null;
        }
        let u = (origin[0] + direction[0] * t) / this.width + .5;
        let v = .5 - (origin[1] + direction[1] * t) / this.height;
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
        this.buffers.forEach(buffer => this.gl.deleteBuffer(buffer));
        this.textures.forEach(texture => this.gl.deleteTexture(texture));
        this.engravingTextures.forEach(texture => this.gl.deleteTexture(texture));
        this.gl.deleteProgram(this.program);
    }
}
