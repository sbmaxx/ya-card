import { cards, logos } from '../data.js';
import { createEngravingMap } from '../engraving.js';
import { art } from './art-direction.js';
import { direction } from './directions.js';

const edgeOptions = { standard: [.055, .018], thin: [.022, .008], soft: [.032, .012] };
const edgeStudy = new URLSearchParams(location.search).get('edge');
const HALF_THICKNESS = direction.thickness, BEVEL = direction.bevel;
const portraitOptions = { tall: 545, balanced: 500, compact: 460 };
const portraitStudy = new URLSearchParams(location.search).get('proportion');
const portraitHeight = Object.hasOwn(portraitOptions, portraitStudy) ? portraitOptions[portraitStudy] : 460;

const finishes = {
    silver: { metal: [.847, .859, .878], edge: [.50, .54, .58], ink: '#20252b', secondary: '#30353a', link: '#30353a' },
    titanium: { metal: [.86, .81, .72], edge: [.55, .51, .43], ink: '#292722', secondary: '#35312a', link: '#35312a' },
    graphite: { metal: [.28, .31, .35], edge: [.23, .26, .30], ink: '#f0f1f2', secondary: '#e1e4e9', link: '#e1e4e9' }
};
const requestedFinish = new URLSearchParams(location.search).get('finish');
const finish = direction.finish;

// Sample once per page, not per frame or resize. Context recovery keeps the
// same composition; reloading gives the card and light new, bounded trajectories.
const between = (min, max) => min + Math.random() * (max - min);
const variation = {
    poseX: between(-.035, .035), poseY: between(-.045, .045), poseZ: between(-.012, .012),
    phaseX: between(0, Math.PI * 2), phaseY: between(0, Math.PI * 2), phaseZ: between(0, Math.PI * 2),
    floatPhase: between(0, Math.PI * 2), idleSpeed: between(.85, 1.15), idleAmplitude: between(.8, 1.15),
    lightPhase: between(0, Math.PI * 2), lightPeriod: between(14, 20),
    lightX: between(-3.3, -2.7), lightY: between(3.7, 4.3), lightTravel: between(1.8, 2.4)
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

vec3 metalLighting(vec3 normal, vec3 view, vec3 light, float polish, float brushVisibility) {
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
    // Horizontal tooling, below one percent contrast; fade before subpixel
    // frequencies can shimmer. Polished walls and edges have no brushing.
    vec2 surface = vUV * uLayoutSize;
    float grain = (sin(surface.y * 5.2 + sin(surface.x * .13) * .7) * .65
                 + sin(surface.y * 3.8 + sin(surface.x * .31)) * .35)
                 * .009 * brushVisibility * (1.0 - smoothstep(0.0, 0.5, polish));
    vec3 color = silver * (0.43 + 0.22 * diffuse);
    color += vec3(0.15, 0.17, 0.19) * softbox + vec3(0.11) * specular;
    color += vec3(0.22, 0.235, 0.25) * polishedReflection * (1.0 + finishVariation);
    color += vec3(0.12, 0.12, 0.115) * highlightCore;
    color += vec3(0.30, 0.34, 0.39) * fresnel;
    color += vec3(0.22, 0.24, 0.27) * edgeGlint * uEdge;
    ${art.studio ? `
    // A single round studio source: satin broadens its reflected cone, while
    // the engraved floor below uses a narrower lobe around the same direction.
    float sourceDistance = 1.0 - max(dot(reflection, light), 0.0);
    float satinReflection = exp(-sourceDistance * mix(5.0, 18.0, polish));
    float sourceCore = exp(-sourceDistance * mix(30.0, 72.0, polish));
    color = silver * (0.51 + 0.14 * diffuse) + vec3(0.10, 0.11, 0.12);
    color += vec3(0.45, 0.47, 0.49) * satinReflection * (1.0 + .12 * polish);
    color += vec3(1.0, 1.04, 1.09) * mix(.11, .26, polish) * sourceCore;
    color += vec3(0.24, 0.28, 0.33) * fresnel;
    color += vec3(0.22, 0.24, 0.27) * edgeGlint * uEdge;
    ` : ''}
    ${direction.id === 'ivory' ? `
    float pearlLight = exp(-(1.0 - max(dot(reflection, light), 0.0)) * 4.0);
    color = mix(vec3(.97, .94, .86), vec3(.70, .60, .43), uEdge) * (.95 + .06 * diffuse);
    color += vec3(.16, .15, .12) * pearlLight + vec3(.12) * fresnel;
    ` : direction.id === 'obsidian' ? `
    vec2 room = reflection.xy - vec2(.12, .27) - lightOffset.xy * .6;
    float chromeRoom = exp(-dot(room, room) * 14.0);
    float chromeFlash = exp(-(1.0 - max(dot(reflection, light), 0.0)) * 64.0);
    color = vec3(.035, .046, .062) * (.55 + .45 * diffuse);
    color += vec3(.42, .49, .59) * chromeRoom + vec3(.82, .93, 1.08) * chromeFlash;
    color += vec3(.30, .39, .51) * fresnel + vec3(.18) * edgeGlint * uEdge;
    ` : `
    float filmPhase = vUV.x * 3.8 + vUV.y * 2.2 + reflection.x * 3.1 - lightOffset.y * 2.2;
    vec3 film = mix(vec3(.34, .83, .88), vec3(.68, .48, .94), .5 + .5 * sin(filmPhase));
    film = mix(film, vec3(.96, .71, .82), (.5 + .5 * sin(filmPhase * .8 + 2.0)) * .62);
    color = film * (.76 + .20 * diffuse);
    color += vec3(.36) * exp(-(1.0 - max(dot(reflection, light), 0.0)) * 12.0);
    color += vec3(.24, .31, .40) * fresnel;
    color = mix(color, color * .65 + vec3(.18, .17, .30) * edgeGlint, uEdge);
    `}
    // The same source drives the background glow and its reflection on the rim.
    vec3 toGlow = uGlowPosition - vPosition;
    float facingGlow = max(dot(normal, normalize(toGlow)), 0.0);
    float falloff = 1.0 / (1.0 + dot(toGlow, toGlow) * 0.15);
    vec3 glowColor = mix(vec3(0.28, 0.44, 0.65), vec3(0.40, 0.44, 0.60),
                         smoothstep(-2.0, 2.0, vPosition.x - uGlowPosition.x));
    color += glowColor * facingGlow * falloff * (0.78 * uEdge + 0.06 * fresnel) * uGlowIntensity;
    color *= 1.0 + grain;
    // Roll off the brightest reflection rather than clipping it into a white patch.
    color = max(color, vec3(0.0));
    color = color / (vec3(1.0) + color * 0.12);
    ${art.studio ? `
    // Compress only the highlight shoulder; preserve midtone contrast and
    // avoid a clipped white patch when the source reflects straight at us.
    vec3 shoulder = max(color - vec3(0.82), vec3(0.0));
    color = min(color, vec3(0.82)) + shoulder / (vec3(1.0) + shoulder / 0.18);
    ` : ''}
    return color;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 view = normalize(vec3(0.0, 0.0, 7.0) - vPosition);
    vec3 light = normalize(uKeyPosition - vPosition);
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
    float footprint = 1.0;
    #endif
    // Subpixel tooling marks fade out before they can alias during rotation.
    float grainVisibility = 1.0 - smoothstep(0.28, 0.65, footprint);
    vec3 color = metalLighting(normal, view, light, uEdge, grainVisibility);
    float logoRegion = step(uLogoRect.x, vUV.x) * step(uLogoRect.y, vUV.y)
                     * step(vUV.x, uLogoRect.z) * step(vUV.y, uLogoRect.w);
    ${art.cavity ? `
    // A recessed floor is occluded by its opening. Read these masks outside
    // the glyph branch so mip derivatives remain valid on WebGL 1.
    float logoScale = max(0.1, ((uLogoRect.z - uLogoRect.x) * uLayoutSize.x - 4.0) / 145.0);
    float cutDepth = mix(${art.name.depth.toFixed(3)}, ${art.logo.depth.toFixed(3)} * logoScale, logoRegion);
    vec2 viewSlope = vec2(dot(view, normalize(vTangent)), dot(view, normalize(vBitangent))) / max(dot(view, normal), 0.4);
    vec2 lightSlope = vec2(dot(light, normalize(vTangent)), dot(light, normalize(vBitangent))) / max(dot(light, normal), 0.35);
    float visibleInnerWall = 1.0 - texture2D(uEngraving, vUV - viewSlope * cutDepth / uLayoutSize).a;
    float cavityShadow = 1.0 - texture2D(uEngraving, vUV + lightSlope * cutDepth * 1.3 / uLayoutSize).a;
    ` : ''}
    if (engraved > 0.001) {
        vec2 mappedXY = (relief.rg * 255.0 - 128.0) / 127.0;
        mappedXY *= resolved;
        float slope = length(mappedXY);
        vec3 facetNormal = normalize(normalize(vTangent) * mappedXY.x
                         + normalize(vBitangent) * mappedXY.y
                         + normal * sqrt(max(0.01, 1.0 - dot(mappedXY, mappedXY))));
        float wall = smoothstep(0.035, 0.30, slope) * ${(art.name.wall ?? .58).toFixed(3)} * resolved;
        // Dark matte fill on the floor; the narrow cut wall reflects the same
        // studio source as the plate, with mild cavity occlusion.
        vec3 floorInk = paint * (0.91 + 0.09 * max(dot(normal, light), 0.0)) * (1.0 - 0.18 * relief.b);
        float facetLight = max(dot(facetNormal, light), 0.0);
        float wallExposure = smoothstep(-0.20, 0.10, facetLight - max(dot(normal, light), 0.0));
        vec3 litWall = metalLighting(facetNormal, view, light, .55, 0.0) * (0.65 + 0.28 * facetLight);
        // The occluded wall must become darker, not a second silver outline.
        vec3 cutMetal = mix(floorInk * 0.58, litWall, wallExposure);
        vec3 stampedFace = metalLighting(normal, view, light, .45, 0.0) * ${art.logo.face.toFixed(3)} + uMetalTone * 0.018;
        stampedFace += vec3(${art.logo.warmth.toFixed(3)}, ${(art.logo.warmth * .5).toFixed(3)}, 0.0);
        stampedFace *= ${art.logo.raised ? '1.0' : '(1.0 - 0.14 * relief.b)'};
        vec3 stampedWall = mix(stampedFace * 0.64,
                               metalLighting(facetNormal, view, light, .55, 0.0) * (1.02 + 0.12 * facetLight),
                               smoothstep(-0.16, 0.13, facetLight - max(dot(normal, light), 0.0)));
        float stampedBevel = smoothstep(0.035, 0.30, slope) * ${art.logo.wall.toFixed(3)} * resolved;
        vec3 stampedMetal = mix(stampedFace, stampedWall, stampedBevel);
        ${art.logo.machined ? `
        // The cut face is polished more than the satin plate. Its compact,
        // round reflection moves with the same light, while the bevel normals
        // turn that reflection around each letter's contour.
        vec3 reflected = reflect(-view, normal);
        vec3 sourceDirection = normalize(uKeyPosition);
        vec2 studioOffset = reflected.xy - (sourceDirection.xy - vec2(-0.42, 0.56)) - vec2(0.10, 0.14);
        float faceReflection = ${art.studio ? `exp(-(1.0 - max(dot(reflected, light), 0.0)) * ${(art.logo.broadPower ?? 8).toFixed(1)})` : 'exp(-dot(studioOffset, studioOffset) * 7.0)'};
        float polish = ${art.studio ? `exp(-(1.0 - max(dot(reflected, light), 0.0)) * ${(art.logo.polishPower ?? 36).toFixed(1)})` : 'exp(-dot(studioOffset, studioOffset) * 28.0)'};
        vec3 faceMetal = uMetalTone * ${(.18 + art.logo.face * .24).toFixed(3)};
        faceMetal += vec3(0.23, 0.25, 0.28) * faceReflection + vec3(${(art.logo.sheen ?? .15).toFixed(3)}) * polish;
        faceMetal += vec3(${art.logo.warmth.toFixed(3)}, ${(art.logo.warmth * .5).toFixed(3)}, 0.0);
        float tooling = sin(vUV.x * uLayoutSize.x * 7.8 + sin(vUV.y * uLayoutSize.y * 0.23));
        faceMetal += vec3(tooling * 0.009 * grainVisibility);
        faceMetal *= ${art.logo.raised ? '1.0' : '(1.0 - 0.17 * relief.b)'};
        float facetExposure = smoothstep(-0.28, 0.22, dot(facetNormal, light) - dot(normal, light));
        vec3 bevelMetal = mix(faceMetal * 0.42, metalLighting(facetNormal, view, light, .55, 0.0) * 1.08, facetExposure);
        stampedMetal = mix(faceMetal, bevelMetal, smoothstep(0.025, 0.34, slope) * ${art.logo.wall.toFixed(3)} * resolved);
        ` : ''}
        inkColor = mix(paint, mix(floorInk, cutMetal, wall), engraved);
        // The chosen monochrome relief catches the same moving softbox as the
        // plate. Coverage is preserved, so no exterior outline is introduced.
        inkColor = mix(inkColor, stampedMetal, engraved * logoRegion);
        // Each edition gives the wordmark its own visible metal treatment.
        vec3 markLow = vec3(${direction.markLow.join(', ')});
        vec3 markHigh = vec3(${direction.markHigh.map(v => v.toFixed(3)).join(', ')});
        float markReflection = pow(max(dot(normal, normalize(light + view)), 0.0), 18.0);
        vec3 markFace = mix(markLow, markHigh, .18 + .58 * markReflection);
        vec3 markWall = mix(markLow * .40, markHigh, wallExposure);
        inkColor = mix(inkColor, mix(markFace, markWall, smoothstep(.03, .35, slope) * .9 * resolved), engraved * logoRegion);
        ${art.cavity ? `
        // Internal shadow separates the bottom from the bevel. The visible
        // wall shifts with the viewing angle, while the letter opening stays fixed.
        float floorAmount = smoothstep(0.20, 0.85, relief.b);
        inkColor *= 1.0 - cavityShadow * floorAmount * 0.62 * resolved;
        vec3 innerWall = mix(paint * 0.36, metalLighting(facetNormal, view, light, .55, 0.0) * 1.03, wallExposure);
        inkColor = mix(inkColor, innerWall, visibleInnerWall * mix(0.64, 0.80, logoRegion) * resolved);
        ` : ''}
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

function projectionMatrix(aspect, f = 1 / Math.tan(Math.PI / 8)) {
    const near = 0.1, far = 30;
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}

function roundedOutline(width, height, vertical) {
    const w = width / 2, h = height / 2;
    const cut = .34;
    const points = direction.shape === 'rounded' ? [[-w, h], [w, h], [w, -h], [-w, -h]]
        : direction.shape === 'cut' ? [[-w + cut, h], [w, h], [w, -h + cut], [w - cut, -h], [-w, -h], [-w, h - cut]]
        : vertical ? [[-w, h], [w, h], [w, -h * .74], [0, -h], [-w, -h * .74]]
            : [[-w, h], [w * .74, h], [w, 0], [w * .74, -h], [-w, -h]];
    const result = [];
    points.forEach((p, index) => {
        const previous = points[(index + points.length - 1) % points.length], next = points[(index + 1) % points.length];
        const a = Math.hypot(previous[0] - p[0], previous[1] - p[1]);
        const b = Math.hypot(next[0] - p[0], next[1] - p[1]);
        const r = direction.radius;
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
    const inset = (point, normal, amount) => [point[0] - normal[0] * amount, point[1] - normal[1] * amount];
    // Two segments trace each quarter-circle; adjacent bands share position
    // and normal at the face, rounded bevel and straight sidewall.
    const section = (angle, back = false) => [BEVEL * (1 - Math.sin(angle)),
        (back ? -1 : 1) * (depth - BEVEL * (1 - Math.cos(angle))),
        Math.sin(angle), (back ? -1 : 1) * Math.cos(angle)];
    const profile = [section(0), section(Math.PI / 4), section(Math.PI / 2),
        section(Math.PI / 2, true), section(Math.PI / 4, true), section(0, true)];
    function vertex(target, x, y, z, nx, ny, nz, back = false) {
        let u = x / width + .5, v = .5 - y / height;
        if (back) { if (vertical) u = 1 - u; else v = 1 - v; }
        target.push(x, y, z, nx, ny, nz, u, v);
    }
    outline.forEach((a, i) => {
        const b = outline[(i + 1) % outline.length];
        const normalA = rimNormals[i], normalB = rimNormals[(i + 1) % outline.length];
        const ai = inset(a, normalA, BEVEL), bi = inset(b, normalB, BEVEL);
        for (const p of [[0, 0], bi, ai]) vertex(faces[0], ...p, depth, 0, 0, 1);
        for (const p of [[0, 0], ai, bi]) vertex(faces[1], ...p, -depth, 0, 0, -1, true);
        function ring(top, bottom) {
            for (const [point, normal, band] of [[a, normalA, top], [b, normalB, top], [a, normalA, bottom],
                [a, normalA, bottom], [b, normalB, top], [b, normalB, bottom]]) {
                vertex(faces[2], ...inset(point, normal, band[0]), band[1], normal[0] * band[2], normal[1] * band[2], band[3]);
            }
        }
        for (let band = 1; band < profile.length; band++) ring(profile[band - 1], profile[band]);
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

function textureCanvas(lang, vertical, logo, maxSize, compact = false) {
    const width = vertical ? 300 : 545, height = vertical ? (compact ? 460 : portraitHeight) : 300;
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
    const centered = direction.layout === 'center';
    const split = direction.layout === 'split' && !vertical;
    const bold = direction.layout === 'bold';
    const x = centered ? width / 2 : vertical ? 34 : split ? 205 : 42;
    context.textAlign = centered ? 'center' : 'left';
    const logoWidth = vertical ? (bold ? 145 : direction.layout === 'center' ? 124 : 128) : bold ? 195 : 130;
    const viewBox = logos[lang].viewBox.split(' ').map(Number);
    const logoHeight = logoWidth * viewBox[3] / viewBox[2];
    const logoX = centered || (vertical && !bold) ? (width - logoWidth) / 2 : split ? 38 : x;
    const logoY = vertical ? (bold ? 58 : 76) : split ? 145 : centered ? 45 : 42;
    const nameY = vertical ? (bold ? 148 : 164) : split ? 105 : centered ? 148 : 150;
    const nameSize = vertical ? Math.min(26, art.nameSize) : art.nameSize;
    const contactY = vertical ? (bold ? 278 : 292) : centered ? 223 : 225;
    const textSize = vertical ? 12.5 : 13, lineHeight = 22;
    const finalBaseline = contactY + lineHeight;
    context.font = `400 ${textSize}px "Card Onest", Arial, sans-serif`;
    const finalMetrics = context.measureText('t.me/sbmaxx');
    const blockTop = split ? nameY - nameSize * .78 : logoY;
    const blockBottom = finalBaseline + finalMetrics.actualBoundingBoxDescent;
    const yOffset = (height - blockTop - blockBottom) / 2;
    function text(value, y, size, color = finish.ink, url, weight = 400) {
        y += yOffset;
        context.font = `${weight} ${size}px "Card Onest", Arial, sans-serif`;
        context.fillStyle = color;
        const metrics = context.measureText(value);
        // Align visible glyph edges, not their differing left side bearings.
        const drawX = centered ? x : x + metrics.actualBoundingBoxLeft;
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
    const titleRects = vertical || split
        ? data.name.split(' ').map((line, i) => text(line, nameY + i * 32, nameSize, finish.ink, undefined, 500))
        : [text(data.name, nameY, nameSize, finish.ink, undefined, 500)];
    const titleRelief = [Math.min(...titleRects.map(r => r[0])), Math.min(...titleRects.map(r => r[1])),
        Math.max(...titleRects.map(r => r[2])), Math.max(...titleRects.map(r => r[3]))];
    const logoRelief = [(logoX - 2) / width, (logoY + yOffset - 2) / height,
        (logoX + logoWidth + 2) / width, (logoY + yOffset + logoHeight + 2) / height];
    if (vertical || split) data.positionLines.forEach((line, i) => text(line, nameY + 63 + i * 17, 12.5, finish.secondary));
    else text(data.position, centered ? 176 : 177, 13, finish.secondary);
    const y = contactY, size = textSize;
    // Contacts share one dark ink tone; hierarchy comes from spacing and size.
    text('sbmaxx@yandex-team.ru', y, size, finish.ink, 'mailto:sbmaxx@yandex-team.ru');
    text('t.me/sbmaxx', y + lineHeight, size, finish.ink, 'https://t.me/sbmaxx');
    if (split) {
        context.fillStyle = finish.ink; context.globalAlpha = .18;
        context.fillRect(185, blockTop + yOffset, .6, blockBottom - blockTop);
        context.globalAlpha = 1;
    }
    return { canvas, links, width, height, titleRelief, logoRelief, logoScale: logoWidth / 145 };
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
        this.halfThickness = HALF_THICKNESS;
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
        this.viewportWidth = Math.max(1, rect.width);
        this.viewportHeight = Math.max(1, rect.height);
        const touchLandscape = matchMedia('(pointer: coarse) and (orientation: landscape)').matches;
        const vertical = innerWidth <= 700 && !touchLandscape;
        // Physical screen size stays stable while Safari's toolbars expand.
        const compact = vertical && Math.max(screen.width, screen.height) < 740;
        this.touchLandscape = touchLandscape;
        if (vertical !== this.vertical || compact !== this.compact) this.rebuild(vertical, compact);
        this.fixedCardWidth = matchMedia('(pointer: coarse)').matches ? 0 : vertical ? 360 : 684;
        // A desktop camera with a fixed CSS-pixel focal length keeps both size
        // and perspective stable when the viewport grows. Touch keeps its fit.
        const focalLength = this.fixedCardWidth
            ? 14 * this.fixedCardWidth / (this.width * this.viewportHeight) : undefined;
        this.projection = projectionMatrix(this.aspect, focalLength);
    }

    rebuild(vertical, compact = false) {
        const gl = this.gl;
        this.buffers.forEach(buffer => gl.deleteBuffer(buffer));
        this.textures.forEach(texture => gl.deleteTexture(texture));
        this.engravingTextures.forEach(texture => gl.deleteTexture(texture));
        this.vertical = vertical;
        this.compact = compact;
        const layoutHeight = compact ? 460 : portraitHeight;
        this.width = vertical ? (layoutHeight === 545 ? 2.333 : 4.235 * 300 / layoutHeight) : 4.235;
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
        this.surfaces = ['ru', 'en'].map((lang, i) => textureCanvas(lang, vertical, this.images[i], maxSize, compact));
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
        this.keyLight = [variation.lightX + Math.sin(lightPhase) * variation.lightTravel,
            variation.lightY + Math.sin(lightPhase + .7) * .9, 5.6 + Math.cos(lightPhase) * .6];
        const idleTarget = animate && idle && !dragging ? 1 : 0;
        if (reduced) this.idleWeight = 0;
        else if (!freezeTilt) this.idleWeight += (idleTarget - this.idleWeight) * (1 - Math.exp(-dt * (idleTarget ? 1.6 : 10)));
        const idleTime = this.time * variation.idleSpeed;
        const idleStrength = variation.idleAmplitude * this.idleWeight * (this.touchLandscape ? .60 : this.vertical ? .85 : 1);
        // Different, overlapping arcs keep the idle pose perceptible even near
        // one axis's turning point. Pointer/drag response stays independent.
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
        this.flipProgress = reduced ? 1 : Math.min(1, this.flipProgress + dt / 1.65);
        const progress = this.flipProgress;
        const ease = progress * progress * (3 - 2 * progress);
        this.flipAngle = this.flipFrom + (this.flipTarget - this.flipFrom) * ease;
        const targetX = variation.poseX + (reduced ? 0 : rx * Math.PI / 180 + breathX);
        const targetY = variation.poseY + (reduced ? 0 : ry * Math.PI / 180 + breathY);
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
        // Pointer tilt lives in screen space; the card flips in its own space.
        // Adding Euler angles inverted pitch on the portrait back face.
        if (reduced) { this.zoom = zoom; this.zoomVelocity = 0; }
        else [this.zoom, this.zoomVelocity] = follow(this.zoom, this.zoomVelocity, zoom, 10, dt);
        const lift = this.lift + (this.touchLandscape ? 24 / pixelsPerUnit : 0);
        const tilt = modelMatrix(this.rotationX, this.rotationY, this.zoom * fit, lift, this.rotationZ);

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
        const driftX = Math.sin(lightPhase), driftY = Math.sin(lightPhase + .7);
        this.ambientOpacity = .62 * (1 + Math.sin(lightPhase + .4) * .04);
        this.ambientShift = [driftX * 3, -driftY * 2];
        // The cool room reflection follows the broad background light; its
        // source sits outside the plate so the visible bevel can catch it.
        gl.uniform3f(this.uniforms.uGlowPosition, -3.6 + driftX * .65, .7 + driftY * .4, -.5);
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
        const f = this.projection[5];
        const project = ([x, y]) => {
            const wx = m[0] * x + m[4] * y + m[12];
            const wy = m[1] * x + m[5] * y + m[13];
            const wz = m[2] * x + m[6] * y + m[14];
            const distance = (-0.9 - lz) / (wz - lz);
            const sx = lx + (wx - lx) * distance;
            const sy = ly + (wy - ly) * distance;
            return [(sx * f / (7.9 * this.aspect) + 1) * this.viewportWidth / 2,
                (1 - sy * f / 7.9) * this.viewportHeight / 2];
        };
        const points = this.outline.map(project);
        this.shadowPoints = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const heightSlope = Math.hypot(m[2], m[6]);
        const direction = heightSlope > 1e-6 ? [m[2] / heightSlope, m[6] / heightSlope] : [0, 1];
        const axis = [direction[0] * this.width * .45, direction[1] * this.height * .40];
        const near = project(axis.map(v => -v)), far = project(axis);
        const range = Math.abs(m[2]) * this.width + Math.abs(m[6]) * this.height;
        const blend = Math.max(0, Math.min(1, (range - .03) / .30));
        const weight = blend * blend * (3 - 2 * blend);
        this.shadowGradient = [near[0], near[1], far[0], far[1], .18 + .10 * weight, .18 - .08 * weight];
        const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
        // Three blur radii of padding also keep edge-on shadows from being clipped.
        this.shadowBounds = [Math.min(...xs) - 60, Math.min(...ys) - 60,
            Math.max(...xs) - Math.min(...xs) + 120, Math.max(...ys) - Math.min(...ys) + 120];
    }

    // Ray / local card plane intersection. Links follow the actual GPU transform.
    surfacePoint(clientX, clientY) {
        if (!this.model || this.flipProgress < 1) return null;
        const rect = this.canvas.getBoundingClientRect();
        const f = this.projection[5];
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
