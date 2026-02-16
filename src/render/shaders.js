// CLEAN REWRITE - Simple, stable shaders

// Simple vertex shader
export const vertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

vec2 hash22(vec2 p) {
    float n = sin(dot(p, vec2(41.0, 289.0)));
    return fract(vec2(262144.0, 32768.0) * n);
}

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

vec2 hash22(vec2 p) {
    float n = sin(dot(p, vec2(41.0, 289.0)));
    return fract(vec2(262144.0, 32768.0) * n);
}

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

// Section map shader - converts raw edge detail into implicit, macro region boundaries.
export const sectionMapShader = `
precision highp float;

uniform sampler2D u_edgeTexture;
uniform vec2 u_resolution;
uniform float u_sectionScale;
uniform float u_sectionClosure;
uniform float u_sectionStrictness;
uniform float u_microDetailInfluence;
uniform float u_tileSize;
uniform float u_edgeAdherence;

varying vec2 v_texCoord;

vec2 hash22(vec2 p) {
    float n = sin(dot(p, vec2(41.0, 289.0)));
    return fract(vec2(262144.0, 32768.0) * n);
}

void main() {
    vec2 px = 1.0 / u_resolution;
    float center = texture2D(u_edgeTexture, v_texCoord).r;

    // Fine structure sample (tiny details).
    float fine = center;
    fine += texture2D(u_edgeTexture, v_texCoord + vec2(px.x, 0.0)).r;
    fine += texture2D(u_edgeTexture, v_texCoord - vec2(px.x, 0.0)).r;
    fine += texture2D(u_edgeTexture, v_texCoord + vec2(0.0, px.y)).r;
    fine += texture2D(u_edgeTexture, v_texCoord - vec2(0.0, px.y)).r;
    fine += texture2D(u_edgeTexture, v_texCoord + vec2(px.x, px.y)).r;
    fine += texture2D(u_edgeTexture, v_texCoord + vec2(-px.x, px.y)).r;
    fine += texture2D(u_edgeTexture, v_texCoord + vec2(px.x, -px.y)).r;
    fine += texture2D(u_edgeTexture, v_texCoord + vec2(-px.x, -px.y)).r;
    fine /= 9.0;

    // Coarse structure sample (macro sections).
    float coarseRadiusPx = mix(2.0, 28.0, u_sectionScale);
    float coarseRadiusUv = coarseRadiusPx * min(px.x, px.y);
    const int COARSE_SAMPLES = 20;
    const float GOLDEN_ANGLE = 2.39996323;
    float coarseSum = 0.0;
    for (int i = 0; i < COARSE_SAMPLES; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(COARSE_SAMPLES);
        float r = sqrt(t) * coarseRadiusUv;
        float a = fi * GOLDEN_ANGLE;
        vec2 uv = v_texCoord + vec2(cos(a), sin(a)) * r;
        coarseSum += texture2D(u_edgeTexture, uv).r;
    }
    float coarse = coarseSum / float(COARSE_SAMPLES);

    // Blend micro detail into macro natural-edge sections.
    float naturalSeed = mix(coarse, max(coarse, fine), u_microDetailInfluence);

    // Isotropic closure (radial max) to avoid axis-aligned/rectangular artifacts.
    float closeRadiusPx = mix(1.0, 10.0, u_sectionClosure);
    float closeRadiusUv = closeRadiusPx * min(px.x, px.y);
    float dilated = naturalSeed;
    const int CLOSE_SAMPLES = 24;
    const float GOLDEN_ANGLE_2 = 2.39996323;
    for (int i = 0; i < CLOSE_SAMPLES; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(CLOSE_SAMPLES);
        float r = sqrt(t) * closeRadiusUv;
        float a = fi * GOLDEN_ANGLE_2;
        vec2 uv = v_texCoord + vec2(cos(a), sin(a)) * r;
        dilated = max(dilated, texture2D(u_edgeTexture, uv).r);
    }
    float naturalClosed = mix(naturalSeed, dilated, u_sectionClosure * 0.90);

    // No synthetic tiling boundaries: infer sections from natural edges only.
    // Repurpose controls:
    // - u_tileSize now controls additional macro merge scale
    // - u_edgeAdherence controls how strongly we trust natural edges
    float mergeRadiusPx = mix(2.0, 24.0, u_tileSize);
    float mergeRadiusUv = mergeRadiusPx * min(px.x, px.y);
    float merged = 0.0;
    float mergedW = 0.0;
    const int MERGE_SAMPLES = 20;
    for (int i = 0; i < MERGE_SAMPLES; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(MERGE_SAMPLES);
        float r = sqrt(t) * mergeRadiusUv;
        float a = fi * GOLDEN_ANGLE_2;
        vec2 uv = v_texCoord + vec2(cos(a), sin(a)) * r;
        float w = 1.0 - t * 0.45;
        merged += texture2D(u_edgeTexture, uv).r * w;
        mergedW += w;
    }
    merged = mergedW > 0.0 ? merged / mergedW : naturalClosed;
    float blended = mix(merged, naturalClosed, u_edgeAdherence);

    // Strictness turns soft ridges into stronger separators.
    float threshold = mix(0.62, 0.26, u_sectionStrictness);
    float width = mix(0.35, 0.06, u_sectionStrictness);
    float sectionBarrier = smoothstep(threshold - width, threshold + width, blended);

    gl_FragColor = vec4(clamp(sectionBarrier, 0.0, 1.0), 0.0, 0.0, 1.0);
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
uniform float u_mutation;        // 0-1: Rare pocket color mutation strength
uniform float u_sectionScale;    // 0-1: macro section scale
uniform float u_tileSize;        // 0-1: tiling granularity
uniform float u_edgeAdherence;   // 0-1: natural-edge adherence vs synthetic tiling
uniform float u_sourceColorAdherence; // 0-1: palette pull toward source colors
uniform float u_deltaTime;
uniform sampler2D u_structuredNoiseTexture;

varying vec2 v_texCoord;

float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    vec3 rgb = clamp(p - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

vec2 hash22t(vec2 p) {
    float n = sin(dot(p, vec2(41.0, 289.0)));
    return fract(vec2(262144.0, 32768.0) * n);
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

    // GoL-coupled color evolution (HSV): section-stable palette with slow drift.
    vec3 neighborhoodColor = vec3(conv.g, conv.b, conv.a);
    vec3 hsvCur = rgb2hsv(clamp(current.rgb, 0.0, 1.0));
    vec3 hsvNbr = rgb2hsv(clamp(neighborhoodColor, 0.0, 1.0));
    float activitySignal = clamp(abs(targetLum - localLum) * 2.2 + abs(neighLum - localLum) * 1.2, 0.0, 1.0);
    float hueRate = clamp((0.015 + 0.18 * u_activity) * u_deltaTime * (0.25 + 0.75 * activitySignal), 0.0, 1.0);
    float satRate = clamp((0.02 + 0.16 * u_activity) * u_deltaTime * (0.25 + 0.75 * activitySignal), 0.0, 1.0);

    // Section-consistent palette target:
    // - at source adherence = 0: random discrete *organic* region colors (no grid IDs)
    // - at source adherence = 1: source/neighborhood-derived colors
    float novelty = clamp(u_structuredNoise, 0.0, 1.0);
    float bins = mix(16.0, 6.0, novelty);
    vec3 hsvOrig = rgb2hsv(clamp(original.rgb, 0.0, 1.0));
    vec3 structured = texture2D(u_structuredNoiseTexture, v_texCoord).rgb;
    vec2 regionCoord = floor(structured.rg * mix(10.0, 26.0, 1.0 - u_sectionScale));
    float rndH = floor(hash(regionCoord + vec2(13.1, 71.7)) * bins + 0.5) / bins;
    float rndS = mix(0.50, 0.98, floor(hash(regionCoord + vec2(53.3, 19.9)) * 5.0 + 0.5) / 5.0);

    float srcAdh = clamp(u_sourceColorAdherence, 0.0, 1.0);
    float hueBaseSrc = mix(hsvNbr.x, hsvOrig.x, srcAdh);
    float satBaseSrc = mix(hsvNbr.y, hsvOrig.y, srcAdh);

    float hueTarget = mix(rndH, floor(hueBaseSrc * bins + 0.5) / bins, srcAdh);
    float satTarget = mix(rndS, mix(0.30, 0.92, floor(satBaseSrc * 4.0 + 0.5) / 4.0), srcAdh);

    // Gentle neighborhood coupling so adjacent pockets can relate without oscillation.
    float hueNbrDiff = fract(hsvNbr.x - hueTarget + 0.5) - 0.5;
    hueTarget = fract(hueTarget + hueNbrDiff * 0.10 * (1.0 - barrier));
    satTarget = mix(satTarget, hsvNbr.y, 0.10 * (1.0 - barrier));

    // Section-level mutation: rare organic-region palette jumps.
    float mutClock = floor(u_time * 0.35);
    float mutationRoll = hash(regionCoord + vec2(mutClock, mutClock * 1.37));
    float mutationChance = clamp(u_mutation * (0.03 + 0.22 * novelty + 0.10 * activitySignal) * u_deltaTime, 0.0, 0.18);
    if (mutationRoll < mutationChance) {
        float stepDir = hash(regionCoord + vec2(19.0, 41.0) + mutClock) < 0.5 ? -1.0 : 1.0;
        hueTarget = fract(hueTarget + stepDir / bins);
        satTarget = clamp(satTarget + 0.10 + 0.45 * u_mutation, 0.0, 1.0);
    }

    float hueDiff = fract(hueTarget - hsvCur.x + 0.5) - 0.5;
    float hueNext = fract(hsvCur.x + hueDiff * hueRate);
    float satNext = clamp(mix(hsvCur.y, satTarget, satRate), 0.10, 1.0);

    // Keep value driven mainly by GoL luminance; tiny section texture only.
    float noiseVal = (structured.b - 0.5) * (0.003 + 0.03 * u_structuredNoise) * (1.0 - edge * 0.7);
    float valNext = clamp(newLum + noiseVal, 0.12, 0.92);
    vec3 rgbLife = hsv2rgb(vec3(hueNext, satNext, valNext));
    vec4 newColor = vec4(clamp(rgbLife, 0.0, 1.0), 1.0);
    
    // Pumping:
    // - Edge pump remains direct (local structural anchoring).
    // - Global image pump uses half-life mapping + error taper to avoid brittle snap-back.
    float edgePump = clamp(u_edgePump * barrier * u_deltaTime * 2.2, 0.0, 1.0);

    // Interpret u_imagePump as a normalized "memory strength" slider.
    // Map to half-life in simulation time: low slider -> long half-life (very gentle).
    float pumpStrength = clamp(u_imagePump, 0.0, 1.0);
    float shaped = pow(pumpStrength, 1.7);
    float halfLife = mix(180.0, 3.0, shaped);
    float imagePumpBase = 1.0 - exp(-0.69314718 * u_deltaTime / halfLife);

    // Error-normalized taper: pull harder only when we've drifted far from source.
    float err = length(newColor.rgb - original.rgb) / 1.7320508;
    float errTaper = smoothstep(0.06, 0.45, err);
    float imagePump = imagePumpBase * errTaper;

    float pumpTotal = clamp(edgePump + imagePump, 0.0, 1.0);
    vec3 hsvNew = rgb2hsv(clamp(newColor.rgb, 0.0, 1.0));
    vec3 hsvO = rgb2hsv(clamp(original.rgb, 0.0, 1.0));
    float hueDelta = fract(hsvO.x - hsvNew.x + 0.5) - 0.5;
    float chromaPull = pumpTotal * clamp(u_sourceColorAdherence, 0.0, 1.0);
    float huePumped = fract(hsvNew.x + hueDelta * chromaPull);
    float satPumped = mix(hsvNew.y, hsvO.y, chromaPull);
    float valPumped = mix(hsvNew.z, hsvO.z, pumpTotal);
    newColor.rgb = hsv2rgb(vec3(huePumped, satPumped, valPumped));
    
    gl_FragColor = clamp(newColor, 0.0, 1.0);
}
`;
