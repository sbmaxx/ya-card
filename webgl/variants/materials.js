import { direction } from './directions.js';

const vec3 = values => `vec3(${values.map(value => value.toFixed(3)).join(', ')})`;

// The round source and its weak studio fill are shared by the plate, lettering
// and rim. Only roughness, pigment and reflectance change between the finishes.
export const materialShader = `
vec3 shoulder(vec3 color) {
    color = max(color, vec3(0.0));
    vec3 excess = max(color - vec3(.82), vec3(0.0));
    return min(color, vec3(.82)) + excess / (vec3(1.0) + excess / .18);
}

vec3 metalLighting(vec3 normal, vec3 view, vec3 light, float polish, float brushVisibility) {
    vec3 reflection = reflect(-view, normal);
    float diffuse = max(dot(normal, light), 0.0);
    float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 4.0);
    float sourceDistance = max(0.0, 1.0 - dot(reflection, light));
    float broad = exp(-sourceDistance * mix(3.6, 18.0, polish));
    float core = exp(-sourceDistance * mix(30.0, 90.0, polish));
    vec3 substrate = mix(uMetalTone, uEdgeTone, uEdge);
    ${direction.id === 'ivory' ? `
    // Fine bead-blasted titanium with a warm machined rim.
    vec3 color = substrate * (.82 + .12 * diffuse);
    color += vec3(.20, .19, .16) * broad + vec3(.80, .72, .56) * core * (.04 + .60 * polish);
    color += vec3(.15, .14, .11) * fresnel;
    ` : direction.id === 'obsidian' ? `
    // Matte gunmetal absorbs most of the room; the narrow polished rim catches
    // a much brighter, smaller reflection from the same source.
    vec3 color = substrate * (.72 + .20 * diffuse);
    color += vec3(.14, .18, .23) * broad * (1.0 + polish);
    color += vec3(.72, .86, 1.0) * core * (.025 + .90 * polish);
    color += vec3(.15, .23, .32) * fresnel;
    ` : `
    // A thin oxide film changes hue with viewing angle. Slow local thickness
    // variation prevents the coating from reading as a painted rainbow stripe.
    float angle = 1.0 - max(dot(normal, view), 0.0);
    float thickness = .22 * sin(vUV.x * 3.2 + vUV.y * 2.0);
    float phase = .35 + angle * 8.0 + thickness;
    vec3 film = mix(vec3(.28, .72, .82), vec3(.62, .43, .86), .5 + .5 * sin(phase));
    film = mix(film, vec3(.88, .55, .68), (.5 + .5 * sin(phase * 1.3 - 1.8)) * .68);
    vec3 color = mix(film, uEdgeTone, uEdge * .7) * (.80 + .18 * diffuse);
    color += vec3(.30, .33, .40) * broad + vec3(.68, .83, .94) * core * (.12 + .52 * polish);
    color += vec3(.16, .25, .31) * fresnel;
    `}
    vec2 surface = vUV * uLayoutSize;
    float brush = sin(surface.y * 4.8 + sin(surface.x * .07) * .4) * .65
                + sin(surface.y * 3.7 + sin(surface.x * .19) * .5) * .35;
    color *= 1.0 + brush * .018 * brushVisibility * (1.0 - polish);
    vec3 glowDirection = uGlowPosition - vPosition;
    float bounce = max(dot(normal, normalize(glowDirection)), 0.0)
                 / (1.0 + dot(glowDirection, glowDirection) * .15);
    color += ${direction.id === 'ivory' ? 'vec3(.30, .23, .14)' : 'vec3(.18, .35, .56)'}
           * bounce * (.65 * uEdge + .08 * fresnel) * uGlowIntensity;
    return shoulder(color);
}

vec3 letteringMetal(vec3 normal, vec3 view, vec3 light, float logo) {
    vec3 reflection = reflect(-view, normal);
    float sourceDistance = max(0.0, 1.0 - dot(reflection, light));
    float room = exp(-sourceDistance * mix(5.0, 8.0, logo));
    float mirror = exp(-sourceDistance * mix(26.0, 52.0, logo));
    float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 3.0);
    vec3 low = ${vec3(direction.markLow)}, high = ${vec3(direction.markHigh)};
    // A darker face and a bright bevel establish relief without a white outline.
    vec3 color = low * (.84 + .16 * max(dot(normal, light), 0.0));
    color += (high - low) * room * .56 + high * mirror * .54;
    color += high * fresnel * .22;
    return shoulder(color);
}
`;
