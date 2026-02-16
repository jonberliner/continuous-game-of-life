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

    // Continuous domain-warped seeding (no grid-cell floor => no rectangular artifacts).
    float seedFreq = mix(8.0, 120.0, 1.0 - u_noiseScale);
    vec2 warp = vec2(
        hash(v_texCoord * 57.0 + vec2(u_time * 0.03, -u_time * 0.02)),
        hash(v_texCoord.yx * 49.0 + vec2(-u_time * 0.02, u_time * 0.03))
    ) - 0.5;
    vec2 seedUv = v_texCoord * seedFreq + warp * mix(0.4, 3.0, u_noiseScale);
    vec3 seeded = vec3(
        hash(seedUv + vec2(17.0, 43.0) + u_time * 0.07),
        hash(seedUv + vec2(71.0, 11.0) + u_time * 0.09),
        hash(seedUv + vec2(29.0, 97.0) + u_time * 0.05)
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

    // Fine structure sample (tiny details), isotropic to avoid axis/grid artifacts.
    float fine = 0.0;
    const int FINE_SAMPLES = 12;
    const float GOLDEN_ANGLE_FINE = 2.39996323;
    for (int i = 0; i < FINE_SAMPLES; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(FINE_SAMPLES);
        float r = mix(0.6, 1.6, t) * min(px.x, px.y);
        float a = fi * GOLDEN_ANGLE_FINE;
        vec2 uv = v_texCoord + vec2(cos(a), sin(a)) * r;
        fine += texture2D(u_edgeTexture, uv).r;
    }
    fine /= float(FINE_SAMPLES);

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

    float effectiveRadius = max(u_radius, 0.5);

    // SmoothLife dual kernel: inner disk (self-mass m) + outer ring (neighbor density n).
    // Two independent spatial measurements enable traveling structures and richer phase space.
    float innerFrac = 0.40;
    float tSplit = innerFrac * innerFrac; // area-uniform threshold in t-space

    float innerLumSum = 0.0;
    float innerWeightSum = 0.0;
    vec4 outerColorSum = vec4(0.0);
    float outerWeightSum = 0.0;

    const int SAMPLE_COUNT = 128;
    const float GOLDEN_ANGLE = 2.39996323;
    for (int i = 0; i < SAMPLE_COUNT; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(SAMPLE_COUNT);
        float r = sqrt(t) * effectiveRadius;
        float a = fi * GOLDEN_ANGLE;
        vec2 dir = vec2(cos(a), sin(a));
        vec2 samplePos = v_texCoord + dir * r * pixelSize;
        vec4 sampleColor = texture2D(u_texture, samplePos);
        float sampleEdge = texture2D(u_edgeTexture, samplePos).r;

        float barrier = max(centerEdge, sampleEdge);
        float edgeWeight = 1.0 - barrier * 0.9;
        float radialWeight = 1.0 - t * 0.35;
        float w = edgeWeight * radialWeight;
        if (w <= 0.0001) continue;

        float lum = getLuminance(sampleColor);
        if (t < tSplit) {
            innerLumSum += lum * w;
            innerWeightSum += w;
        } else {
            outerColorSum += sampleColor * w;
            outerWeightSum += w;
        }
    }

    float innerLum = innerWeightSum > 0.0 ? innerLumSum / innerWeightSum : getLuminance(centerColor);
    vec4 outerColor = outerWeightSum > 0.0 ? outerColorSum / outerWeightSum : centerColor;

    // Pack: R = inner disk luminance (m), GBA = outer ring average color
    gl_FragColor = vec4(innerLum, outerColor.rgb);
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
uniform float u_paletteStability;// 0-1: How long section colors persist
uniform float u_sectionScale;    // 0-1: macro section scale
uniform float u_tileSize;        // 0-1: tiling granularity
uniform float u_edgeAdherence;   // 0-1: natural-edge adherence vs synthetic tiling
uniform float u_sourceColorAdherence; // 0-1: palette pull toward source colors
uniform float u_patternCoupling; // 0-1: coupling strength between color and pattern topology
uniform float u_deltaTime;
uniform sampler2D u_structuredNoiseTexture;
uniform sampler2D u_regionTexture;

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

float lifeTarget(float m, float n, float hue, float sat, float chroma, float preActivity, float chaos) {
    // State-driven rule parameters: color determines the birth/survival landscape.
    // Regions that evolve different colors naturally develop different dynamics,
    // creating genuine per-region divergence without injected noise.

    // Hue rotates window centers cyclically — different colors see different equilibria
    float hueAngle = hue * 6.2832;
    float hueMod = (sin(hueAngle) * 0.10 + sin(hueAngle * 2.0 + 1.0) * 0.04)
                   * (0.25 + 0.75 * chaos);

    // Birth window: what outer-ring density (n) triggers creation of new life
    float b1 = 0.23 + hueMod;
    float b2 = 0.43 + hueMod * 0.7;

    // Survival window: what outer-ring density (n) sustains existing life
    float s1 = 0.17 + hueMod * 0.5;
    float s2 = 0.55 + hueMod * 0.5;

    // Transition width: how gradual vs step-like the rule boundaries are
    //   Saturation narrows → crisper, more defined patterns
    //   Activity feedback: low widens (easier births = anti-freeze),
    //                      high narrows (selective = anti-explosion)
    float w = 0.065;
    w -= sat * 0.03 * (0.3 + 0.7 * chaos);
    w += (0.5 - preActivity) * 0.06;
    w = max(0.015, w);

    // Chroma shifts birth threshold (colorful regions birth differently)
    float chromaShift = (chroma - 0.3) * 0.05 * (0.3 + 0.7 * chaos);
    b1 += chromaShift;
    b2 += chromaShift * 0.6;

    // Smooth wide sigmoids (genuinely continuous, not step-like)
    float birth = smoothstep(b1 - w, b1 + w, n) * (1.0 - smoothstep(b2 - w, b2 + w, n));
    float survive = smoothstep(s1 - w, s1 + w, n) * (1.0 - smoothstep(s2 - w, s2 + w, n));

    // Inner disk mass (m) determines alive vs dead, with wide continuous transition
    float alive = smoothstep(0.30, 0.70, m);
    return mix(birth, survive, alive);
}

void main() {
    vec4 current = texture2D(u_currentState, v_texCoord);
    vec4 conv = texture2D(u_convolution, v_texCoord);
    vec4 original = texture2D(u_originalImage, v_texCoord);
    float edge = texture2D(u_edgeTexture, v_texCoord).r;

    // Inner disk luminance (m) and outer ring color from dual-kernel convolution
    float m = conv.r;
    vec3 outerColor = vec3(conv.g, conv.b, conv.a);

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
    vec3 neighborhoodColor = mix(outerColor, current.rgb, barrier * 0.75);
    float neighLum = getLuminance(vec4(neighborhoodColor, 1.0));
    float n = neighLum; // outer ring luminance, barrier-attenuated

    // Read structured noise (artistic perturbation only, not rule driving)
    vec3 structured = texture2D(u_structuredNoiseTexture, v_texCoord).rgb;

    // Color analysis for state-driven rule parameters
    vec3 hsvCur0 = rgb2hsv(clamp(current.rgb, 0.0, 1.0));
    float chromaCur = max(current.r, max(current.g, current.b)) - min(current.r, min(current.g, current.b));
    float patternCoupling = clamp(u_patternCoupling, 0.0, 1.0);

    // Pre-activity: local dynamism from state gradients (not noise).
    // Drives activity feedback in the life rule — the self-regulating edge-of-chaos guardian.
    float preActivity = clamp(
        abs(n - m) * 2.0
        + length(outerColor - current.rgb) * 1.2
        + u_activity * 0.15,
        0.0, 1.0
    );

    // State-driven continuous GoL: color determines rule landscape
    float targetLife = lifeTarget(m, n, hsvCur0.x, hsvCur0.y, chromaCur, preActivity, u_chaos);
    float lifeRate = clamp((0.04 + u_activity * 2.5) * u_deltaTime, 0.0, 1.0);
    float newLife = mix(m, targetLife, lifeRate);
    // Neighborhood feedback keeps dynamics flowing
    newLife += (n - m) * (0.04 + 0.30 * u_chaos) * u_deltaTime;
    // Tiny symmetry-breaking perturbation (not a rule driver)
    newLife += (hash(v_texCoord * 350.0 + u_time * 0.7) - 0.5) * 0.002 * u_deltaTime;
    newLife = clamp(newLife, 0.0, 1.0);

    float growth = newLife - m;
    float growthAbs = clamp(abs(growth) * 2.4, 0.0, 1.0);
    float activitySignal = clamp(
        growthAbs * 0.65
        + length(neighborhoodColor - current.rgb) * 0.45
        + abs(n - m) * 0.90
        + u_activity * 0.20,
        0.0, 1.0
    );

    // Use coupled life state to set luminance; keeps pattern field and color field locked together.
    float newLum = clamp(mix(localLum, newLife, 0.82), 0.0, 1.0);

    // Color update driven by same growth signal.
    float channelRate = clamp((0.02 + 0.90 * u_activity) * u_deltaTime * (0.25 + 0.75 * activitySignal), 0.0, 1.0);
    float coupling = (0.20 + 0.35 * (1.0 - barrier)) * channelRate;
    vec3 rgbBase = mix(current.rgb, neighborhoodColor, coupling);
    vec3 chromaAxis = current.rgb - vec3(localLum);
    vec3 neighborChromaAxis = neighborhoodColor - vec3(neighLum);
    rgbBase += chromaAxis * growth * (0.10 + 0.70 * patternCoupling) * (0.35 + 0.65 * u_activity);
    rgbBase += neighborChromaAxis * growth * (0.08 + 0.46 * patternCoupling) * (0.35 + 0.65 * u_activity);
    vec3 cycleAxis = vec3(current.g, current.b, current.r) - current.rgb;
    rgbBase += cycleAxis * growth * (0.04 + 0.50 * patternCoupling) * (0.25 + 0.75 * u_activity);
    rgbBase += (neighborhoodColor - current.rgb) * (0.05 + 0.20 * u_activity) * (0.25 + 0.75 * growthAbs);
    vec3 rgbLife = clamp(rgbBase, 0.0, 1.0);

    // Enforce luminance consistency after chroma feedback.
    float lifeLum = max(dot(rgbLife, vec3(0.299, 0.587, 0.114)), 1.0e-4);
    rgbLife *= clamp(newLum / lifeLum, 0.45, 2.4);
    rgbLife = clamp(rgbLife, 0.0, 1.0);

    // Region signature from edge-aware local source pooling (bounded by section barriers).
    float sectionVal = texture2D(u_edgeTexture, v_texCoord).r;
    vec3 regionSrc = original.rgb;
    float seedW = 1.0;
    float seedRadiusPx = mix(3.0, 20.0, u_sectionScale);
    float seedRadiusUv = seedRadiusPx * min(px.x, px.y);
    const int REGION_SAMPLES = 12;
    const float REGION_ANGLE = 2.39996323;
    for (int i = 0; i < REGION_SAMPLES; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(REGION_SAMPLES);
        float r = sqrt(t) * seedRadiusUv;
        float a = fi * REGION_ANGLE;
        vec2 uv = v_texCoord + vec2(cos(a), sin(a)) * r;
        vec3 src = texture2D(u_originalImage, uv).rgb;
        float e = texture2D(u_edgeTexture, uv).r;
        float w = 1.0 - max(sectionVal, e) * 0.94;
        regionSrc += src * w;
        seedW += w;
    }
    regionSrc /= max(seedW, 1.0);

    // Hazard controls pump event frequency (Poisson-like) per region key.
    float hazard = clamp(u_mutation, 0.0, 1.0);
    float stability = clamp(u_paletteStability, 0.0, 1.0);
    float srcAdh = clamp(u_sourceColorAdherence, 0.0, 1.0);
    vec4 regionTex = texture2D(u_regionTexture, v_texCoord);
    float regionId = floor(regionTex.r * 255.0 + 0.5) + floor(regionTex.g * 255.0 + 0.5) * 256.0;
    vec2 regionCell = vec2(mod(regionId, 251.0), floor(regionId / 251.0));
    float regionPhase = hash(regionCell + vec2(7.0, 19.0));
    float jumpRate = mix(0.02, 3.6, hazard) * mix(0.35, 1.0, 1.0 - stability);
    float tBucket = floor((u_time + regionPhase * 13.0) * jumpRate);

    // Region-specific free palette, then blended with source region by source adherence.
    float bins = mix(14.0, 6.0, hazard);
    float hBase0 = floor(hash(regionCell + vec2(3.1, 5.7)) * bins + 0.5) / bins;
    float sBase0 = mix(0.68, 1.0, floor(hash(regionCell + vec2(7.3, 11.9)) * 4.0 + 0.5) / 4.0);
    float vBase0 = mix(0.52, 0.98, floor(hash(regionCell + vec2(13.7, 17.3)) * 5.0 + 0.5) / 5.0);
    // Region-base palette drifts over time (hazard controls drift speed, stability damps it).
    float driftRate = (0.02 + 0.45 * hazard) * (0.20 + 0.80 * (1.0 - stability)) * (0.35 + 0.65 * activitySignal);
    float hBase = fract(hBase0 + (u_time + regionPhase * 23.0) * driftRate);
    float sBase = clamp(sBase0 + (hash(regionCell + vec2(23.0, 41.0)) - 0.5) * 0.18 * sin((u_time + regionPhase * 17.0) * driftRate * 1.7), 0.55, 1.0);
    float vBase = clamp(vBase0 + (hash(regionCell + vec2(61.0, 7.0)) - 0.5) * 0.14 * sin((u_time + regionPhase * 31.0) * driftRate * 1.3), 0.42, 1.0);
    vec3 freeBase = hsv2rgb(vec3(hBase, sBase, vBase));

    float hRnd = floor(hash(regionCell + vec2(tBucket * 0.37 + 31.0, tBucket * 0.83 + 79.0)) * bins + 0.5) / bins;
    float sRnd = mix(0.70, 1.0, floor(hash(regionCell + vec2(tBucket * 0.91 + 53.0, tBucket * 0.29 + 11.0)) * 4.0 + 0.5) / 4.0);
    float vRnd = mix(0.50, 0.98, floor(hash(regionCell + vec2(tBucket * 0.27 + 47.0, tBucket * 0.63 + 89.0)) * 5.0 + 0.5) / 5.0);
    vec3 freePump = hsv2rgb(vec3(hRnd, sRnd, vRnd));
    vec3 pumpColor = mix(freePump, regionSrc, srcAdh);
    vec3 baseColor = mix(freeBase, regionSrc, srcAdh);

    // Pump integrates into GoL color state (not a separate overlay).
    float basePumpAmt = (1.0 - srcAdh)
        * mix(0.08, 0.24, 1.0 - stability)
        * (0.45 + 0.55 * (1.0 - barrier))
        * (0.20 + 0.80 * activitySignal);
    vec3 rgbBasePumped = mix(rgbLife, baseColor, clamp(basePumpAmt, 0.0, 0.35));
    // Hazard pump follows a region target that changes at jumpRate.
    float pumpAmt = clamp((0.08 + 0.95 * hazard) * (0.20 + 0.80 * (1.0 - stability)) * u_deltaTime * (0.25 + 0.75 * activitySignal), 0.0, 1.0);
    vec3 rgbPumped = mix(rgbBasePumped, pumpColor, pumpAmt);

    // Encourage region-flat pockets by nudging toward region base color inside barriers.
    float patchUniformity = (0.03 + 0.10 * (1.0 - stability)) * (1.0 - barrier) * (1.0 - 0.85 * activitySignal);
    rgbPumped = mix(rgbPumped, baseColor, patchUniformity);

    // Prevent grayscale collapse in free-color regimes.
    vec3 hsvOut = rgb2hsv(clamp(rgbPumped, 0.0, 1.0));
    float chromaFloor = mix(0.10, 0.55, (1.0 - srcAdh) * (0.25 + 0.75 * hazard));
    hsvOut.y = max(hsvOut.y, chromaFloor);

    // Couple visible pattern occupancy (dark vs colored regions) to Life state.
    // newLife incorporates state-driven color-dependent rules (hue/sat/chroma shift
    // birth/survival windows), so topology naturally tracks color divergence.
    float patternState = clamp(newLife + (0.25 + 0.50 * patternCoupling) * growth, 0.0, 1.0);
    float aliveMask = smoothstep(0.38, 0.62, patternState);
    hsvOut.z = clamp(mix(hsvOut.z, patternState, 0.82), 0.02, 0.98);
    hsvOut.y *= mix(0.40, 1.0, aliveMask);
    rgbPumped = hsv2rgb(hsvOut);

    // Small structured perturbation, bounded and chromatic (avoid monochrome "TV static" feel).
    vec3 noiseRGB = (structured - 0.5) * (0.001 + 0.005 * u_structuredNoise) * (0.25 + 0.50 * activitySignal) * (1.0 - edge * 0.7);
    vec4 newColor = vec4(clamp(rgbPumped + noiseRGB, 0.0, 1.0), 1.0);
    
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
