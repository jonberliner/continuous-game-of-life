// CLEAN REWRITE - Simple, stable shaders

// Simple vertex shader
export const vertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

// Simple display shader
export const displayShader = `
precision highp float;

uniform sampler2D u_texture;
varying vec2 v_texCoord;

void main() {
    gl_FragColor = texture2D(u_texture, v_texCoord);
}
`;

// Structured noise update shader - evolves a coherent noise field inside edge pockets
export const structuredNoiseUpdateShader = `
precision highp float;

uniform sampler2D u_prevNoise;
uniform sampler2D u_edgeTexture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_deltaTime;
uniform float u_noiseScale;
uniform float u_noisePersistence;
uniform float u_edgeConfinement;

varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vec2 px = 1.0 / u_resolution;
    vec3 center = texture2D(u_prevNoise, v_texCoord).rgb;
    float centerEdge = texture2D(u_edgeTexture, v_texCoord).r;

    // Scale controls the spatial character of the injected structure.
    float radiusPx = mix(1.0, 90.0, u_noiseScale);
    float radiusUv = radiusPx * min(px.x, px.y);

    // Sample coherent neighborhood with fixed cost.
    const int SAMPLE_COUNT = 24;
    const float GOLDEN_ANGLE = 2.39996323;
    vec3 sum = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < SAMPLE_COUNT; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(SAMPLE_COUNT);
        float r = sqrt(t) * radiusUv;
        float a = fi * GOLDEN_ANGLE;
        vec2 dir = vec2(cos(a), sin(a));
        vec2 uv = v_texCoord + dir * r;

        vec3 n = texture2D(u_prevNoise, uv).rgb;
        float e = texture2D(u_edgeTexture, uv).r;
        float barrier = max(centerEdge, e);
        float w = (1.0 - barrier * u_edgeConfinement) * (1.0 - 0.35 * t);
        if (w <= 0.0001) continue;
        sum += n * w;
        wsum += w;
    }
    vec3 neighborhood = wsum > 0.0 ? sum / wsum : center;

    // Coarse cell-seeded variation gives persistent pocket identity.
    vec2 coarseCell = floor(v_texCoord * mix(12.0, 220.0, 1.0 - u_noiseScale));
    vec3 seeded = vec3(
        hash(coarseCell + vec2(17.0, 43.0) + u_time * 0.07),
        hash(coarseCell + vec2(71.0, 11.0) + u_time * 0.09),
        hash(coarseCell + vec2(29.0, 97.0) + u_time * 0.05)
    );

    float persist = clamp(u_noisePersistence, 0.0, 1.0);
    float blendRate = clamp((1.0 - persist) * u_deltaTime * 2.2, 0.0, 1.0);
    vec3 evolved = mix(neighborhood, seeded, blendRate);

    // Extra damping near strong edges helps keep boundaries readable.
    float edgeDamp = 1.0 - centerEdge * 0.35 * u_edgeConfinement;
    vec3 nextNoise = mix(center, evolved * edgeDamp, clamp(u_deltaTime * 1.4, 0.0, 1.0));

    gl_FragColor = vec4(clamp(nextNoise, 0.0, 1.0), 1.0);
}
`;

// Edge detection shader - outputs SOFT edge strength (0..1)
export const edgeDetectionShader = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_edgeDetail;

varying vec2 v_texCoord;

float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

void main() {
    vec2 pixelSize = 1.0 / u_resolution;
    // Low detail => coarse sampling, high detail => fine sampling
    float sampleStep = mix(2.4, 0.7, u_edgeDetail);
    
    // Sobel edge detection
    float gx = 0.0;
    float gy = 0.0;
    
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 offset = vec2(float(x), float(y)) * pixelSize * sampleStep;
            float lum = getLuminance(texture2D(u_texture, v_texCoord + offset));
            
            if (x == -1) gx -= lum * (y == 0 ? 2.0 : 1.0);
            if (x == 1) gx += lum * (y == 0 ? 2.0 : 1.0);
            if (y == -1) gy -= lum * (x == 0 ? 2.0 : 1.0);
            if (y == 1) gy += lum * (x == 0 ? 2.0 : 1.0);
        }
    }
    
    float edgeMagnitude = sqrt(gx * gx + gy * gy);
    
    // Higher detail -> lower threshold + narrower transition => finer map.
    float threshold = mix(1.05, 0.10, u_edgeDetail);
    float width = mix(0.40, 0.08, u_edgeDetail);
    float edgeStrength = smoothstep(threshold - width, threshold + width, edgeMagnitude);
    
    // Store as R channel
    gl_FragColor = vec4(edgeStrength, 0.0, 0.0, 1.0);
}
`;

// Convolution shader - just compute neighborhood average
export const convolutionShader = `
precision highp float;

uniform sampler2D u_texture;
uniform sampler2D u_edgeTexture;
uniform vec2 u_resolution;
uniform float u_radius;  // Single radius parameter

varying vec2 v_texCoord;

float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

void main() {
    vec2 pixelSize = 1.0 / u_resolution;
    vec4 centerColor = texture2D(u_texture, v_texCoord);
    float centerEdge = texture2D(u_edgeTexture, v_texCoord).r;
    
    float lumSum = 0.0;
    vec4 colorSum = vec4(0.0);
    float weightSum = 0.0;
    float effectiveRadius = max(u_radius, 0.5);

    // Radial sampling kernel: fixed work, any radius (percentage-of-image) is valid.
    const int SAMPLE_COUNT = 128;
    const float GOLDEN_ANGLE = 2.39996323;
    for (int i = 0; i < SAMPLE_COUNT; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(SAMPLE_COUNT); // 0..1
        float r = sqrt(t) * effectiveRadius;
        float a = fi * GOLDEN_ANGLE;
        vec2 dir = vec2(cos(a), sin(a));
        vec2 samplePos = v_texCoord + dir * r * pixelSize;
        vec4 sampleColor = texture2D(u_texture, samplePos);
        float sampleEdge = texture2D(u_edgeTexture, samplePos).r;

        // Emergent edge barrier: attenuate across strong boundaries.
        float barrier = max(centerEdge, sampleEdge);
        float edgeWeight = 1.0 - barrier * 0.9;
        float radialWeight = 1.0 - t * 0.35;
        float w = edgeWeight * radialWeight;
        if (w <= 0.0001) continue;

        lumSum += getLuminance(sampleColor) * w;
        colorSum += sampleColor * w;
        weightSum += w;
    }
    
    float avgLum = weightSum > 0.0 ? lumSum / weightSum : getLuminance(centerColor);
    vec4 avgColor = weightSum > 0.0 ? colorSum / weightSum : centerColor;
    
    // Pack: R = avg luminance, GBA = avg color
    gl_FragColor = vec4(avgLum, avgColor.rgb);
}
`;

// Transition shader - continuous GoL with soft edge barriers
export const transitionShader = `
precision highp float;

uniform sampler2D u_currentState;
uniform sampler2D u_convolution;
uniform sampler2D u_originalImage;
uniform sampler2D u_edgeTexture;
uniform vec2 u_resolution;
uniform float u_time;

uniform float u_chaos;           // 0-1: How easily cells flip
uniform float u_activity;        // 0-1: How fast evolution proceeds
uniform float u_randomNoise;     // 0-1: Random color variation  
uniform float u_edgePump;        // 0-1: How strongly edges re-inject original color
uniform float u_imagePump;       // 0-1: Global source-color pumping
uniform float u_structuredNoise; // 0-1: Structured pocket noise amount
uniform float u_deltaTime;
uniform sampler2D u_structuredNoiseTexture;

varying vec2 v_texCoord;

float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float lifeTarget(float current, float neighborhood, float phase, float chaosJitter) {
    float b1 = 0.25 + 0.03 * phase;
    float b2 = 0.38 + 0.03 * phase;
    float s1 = 0.22 + 0.02 * phase;
    float s2 = 0.50 + 0.02 * phase;
    float w = 0.045 + abs(chaosJitter) * 0.10;
    b1 += chaosJitter * 0.05;
    b2 += chaosJitter * 0.05;
    s1 += chaosJitter * 0.05;
    s2 += chaosJitter * 0.05;

    float birth = smoothstep(b1 - w, b1, neighborhood) * (1.0 - smoothstep(b2, b2 + w, neighborhood));
    float survive = smoothstep(s1 - w, s1, neighborhood) * (1.0 - smoothstep(s2, s2 + w, neighborhood));
    float alive = smoothstep(0.45, 0.55, current);
    return mix(birth, survive, alive);
}

void main() {
    vec4 current = texture2D(u_currentState, v_texCoord);
    vec4 conv = texture2D(u_convolution, v_texCoord);
    vec4 original = texture2D(u_originalImage, v_texCoord);
    float edge = texture2D(u_edgeTexture, v_texCoord).r;

    // Local barrier from edge field to isolate pockets near boundaries.
    vec2 px = 1.0 / u_resolution;
    float edgeN =
        texture2D(u_edgeTexture, v_texCoord + vec2(px.x, 0.0)).r +
        texture2D(u_edgeTexture, v_texCoord - vec2(px.x, 0.0)).r +
        texture2D(u_edgeTexture, v_texCoord + vec2(0.0, px.y)).r +
        texture2D(u_edgeTexture, v_texCoord - vec2(0.0, px.y)).r;
    edgeN *= 0.25;
    float barrier = clamp(edge * 0.85 + edgeN * 0.75, 0.0, 1.0);

    float localLum = getLuminance(current);
    float neighLum = mix(conv.r, localLum, barrier);

    // Continuous-GoL target in luminance space.
    float chaosJitter = (hash(v_texCoord * 180.0 + u_time * 0.35) - 0.5) * 2.0 * u_chaos;
    float targetLum = lifeTarget(localLum, neighLum, 0.2, chaosJitter);
    float rate = clamp((0.03 + u_activity * 2.0) * u_deltaTime, 0.0, 1.0);
    float newLum = mix(localLum, targetLum, rate);

    // Chaos injects bounded disorder (independent from activity/speed).
    newLum += (hash(v_texCoord * 350.0 + u_time * 0.7) - 0.5) * (0.002 + 0.05 * u_chaos) * u_deltaTime;
    newLum = clamp(newLum, 0.0, 1.0);

    // Keep local chroma while moving luminance via GoL target.
    vec3 chroma = current.rgb - vec3(localLum);
    vec3 evolvedRgb = vec3(newLum) + chroma * mix(0.95, 0.75, edge);
    vec4 evolvedColor = vec4(clamp(evolvedRgb, 0.0, 1.0), 1.0);
    
    // Large-scale color coupling: pull toward neighborhood color (from convolution pass).
    vec3 neighborhoodColor = vec3(conv.g, conv.b, conv.a);
    float colorFlow = clamp((0.10 + 0.70 * u_activity + 0.20 * u_chaos) * u_deltaTime, 0.0, 1.0);
    vec3 colorEvolved = mix(evolvedColor.rgb, neighborhoodColor, colorFlow * 0.55);

    // Structured noise acts as a subtle perturbation, not a dominant replacement.
    vec3 structured = texture2D(u_structuredNoiseTexture, v_texCoord).rgb;
    vec3 structuredPerturb = (structured - 0.5) * (0.05 + 0.28 * u_structuredNoise) * (1.0 - edge * 0.6);
    vec4 newColor = vec4(clamp(colorEvolved + structuredPerturb, 0.0, 1.0), 1.0);
    
    // Pumping: local edge pump + global image pump.
    float edgePump = clamp(u_edgePump * barrier * u_deltaTime * 2.2, 0.0, 1.0);
    float imagePump = clamp(u_imagePump * u_deltaTime * 1.4, 0.0, 1.0);
    newColor = mix(newColor, original, clamp(edgePump + imagePump, 0.0, 1.0));
    
    gl_FragColor = clamp(newColor, 0.0, 1.0);
}
`;
