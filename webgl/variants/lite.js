// Light 3D, in its own module: only a device that uses it fetches it
// (cardFragment in renderer.js). For GPUs too slow for the studio (see probe
// and assessDevice there): the same plate, turned, flipped and spun the same
// way, without the studio's reflections, the raised letters, their
// supersampling, the glow or the shadow. Flat print on a plate shaded softly
// from the key's side, so a turn still reads as a solid. A millisecond or two
// where the studio took over a hundred. The studio's shared GLSL (tone curve,
// hash) comes in as arguments.
export const liteFragment = ({ toneCode, hashCode }) => `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float uEdge;
uniform float uExposure;
uniform float uOpacity;
uniform float uReveal;
uniform vec3 uKeyDirection;
uniform vec4 uLogoRect;
uniform vec4 uTitleRect;
uniform vec4 uHoverRect;
uniform vec4 uFocusRect;
uniform vec4 uLogoTint;
uniform vec4 uLogoFirstTint;
uniform vec4 uNameTint;
uniform vec4 uBodyTint;
uniform float uTextMute;
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUV;
in vec3 vTangent;
in vec3 vBitangent;
in float vFacet;
out vec4 outColor;
${toneCode}
${hashCode}

float inRect(vec4 r) {
    return step(r.x, vUV.x) * step(r.y, vUV.y) * step(vUV.x, r.z) * step(vUV.y, r.w);
}

// A letter's colour from its tint (alpha as in the studio): bare metal, a
// colour, or the plate's own material, a shade lighter so it still reads.
vec3 letterColor(vec4 tint, vec3 metal, vec3 plate) {
    return tint.a < .5 ? metal : tint.a < 1.5 ? tint.rgb * .8 : plate * 2.5;
}

void main() {
    vec3 n = normalize(vNormal);
    float shade = .6 + .4 * max(dot(n, normalize(uKeyDirection)), 0.0);
    // Lighter towards the top, as the studio's plate is: a sheet, not a fill.
    // (Before the tone curve's toe, which takes most of a value this dark.)
    vec3 plate = vec3(.040, .0405, .043) * shade * mix(1.35, .9, vUV.y);
    vec3 color;
    if (uEdge > .5) {
        // The chamfers take a little more light than the side wall.
        float facet = abs(vFacet);
        float chamfer = smoothstep(.25, .45, facet) * (1.0 - smoothstep(.95, .99, facet));
        color = mix(vec3(.06), vec3(.16), chamfer) * shade;
    } else {
        vec4 ink = texture(uTexture, vUV);
        vec3 inkColor = ink.rgb / max(ink.a, .001);
        // The wordmark's first letter is drawn red-only in the mask.
        float firstLetter = smoothstep(.6, .3, inkColor.g);
        float logo = inRect(uLogoRect);
        float title = inRect(uTitleRect) * (1.0 - logo);
        float text = 1.0 - logo - title;
        vec3 metal = vec3(.5) * shade;
        vec3 body = mix(letterColor(uBodyTint, metal, plate), plate, uTextMute);
        vec3 lettering = mix(letterColor(uLogoTint, metal, plate), letterColor(uLogoFirstTint, metal, plate), firstLetter) * logo
            + letterColor(uNameTint, metal, plate) * title + body * text;
        // Links: underline and keyboard focus, in the body text's colour.
        vec2 aa = max(fwidth(vUV) * .7, vec2(1e-5));
        vec2 enter = smoothstep(uHoverRect.xy - aa, uHoverRect.xy + aa, vUV);
        vec2 leave = 1.0 - smoothstep(uHoverRect.zw - aa, uHoverRect.zw + aa, vUV);
        float underline = enter.x * enter.y * leave.x * leave.y;
        vec2 focusInside = step(uFocusRect.xy, vUV) * step(vUV, uFocusRect.zw);
        vec2 focusThickness = max(fwidth(vUV) * 2.4, vec2(.0014));
        vec2 focusEdge = min(vUV - uFocusRect.xy, uFocusRect.zw - vUV);
        float focusStroke = min(1.0, focusInside.x * focusInside.y
            * ((1.0 - step(focusThickness.x, focusEdge.x)) + (1.0 - step(focusThickness.y, focusEdge.y))));
        float linkMark = max(underline, focusStroke);
        lettering = mix(lettering, body, linkMark);
        color = mix(plate, lettering, max(ink.a, linkMark));
    }
    vec3 display = toDisplay(uOutput.z * neutralTonemap(color * uExposure / uOutput.z));
    display += (hash(gl_FragCoord.xy + 31.0) - .5) / 255.0;
    outColor = vec4(display * uReveal * uOpacity, uOpacity);
}`;
