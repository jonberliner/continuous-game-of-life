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

// Tunable params
uniform float u_noiseBlendRate;
uniform float u_noiseEdgeDamp;
uniform float u_noiseEvolutionRate;

varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vec2 px = 1.0 / u_resolution;
    vec3 center = texture2D(u_prevNoise, v_texCoord).rgb;
    float centerEdge = texture2D(u_edgeTexture, v_texCoord).r;

    // Scale controls the spatial character of the injected structure.
    // Fraction of smaller image dimension — works at any resolution.
    float minDim = min(u_resolution.x, u_resolution.y);
    float radiusPx = mix(0.002, 0.18, u_noiseScale) * minDim;
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
    float blendRate = clamp((1.0 - persist) * u_deltaTime * u_noiseBlendRate, 0.0, 1.0);
    vec3 evolved = mix(neighborhood, seeded, blendRate);

    // Extra damping near strong edges helps keep boundaries readable.
    float edgeDamp = 1.0 - centerEdge * u_noiseEdgeDamp * u_edgeConfinement;
    vec3 nextNoise = mix(center, evolved * edgeDamp, clamp(u_deltaTime * u_noiseEvolutionRate, 0.0, 1.0));

    gl_FragColor = vec4(clamp(nextNoise, 0.0, 1.0), 1.0);
}
`;

// Boundary evolution shader - makes the boundary field a living, breathing thing.
// Boundaries reassert toward source image edges but erode under simulation activity.
export const boundaryEvolutionShader = `
precision highp float;

uniform sampler2D u_currentBoundary;
uniform sampler2D u_sourceEdges;
uniform sampler2D u_simulationState;
uniform vec2 u_resolution;
uniform float u_deltaTime;
uniform float u_reassertionRate;
uniform float u_erosionStrength;
uniform float u_diffusionRate;

// Tunable params
uniform float u_boundaryDiffRadius;
uniform float u_boundaryDiffFalloff;
uniform float u_boundaryActRadius;
uniform float u_boundaryActGain;

varying vec2 v_texCoord;

void main() {
    vec2 px = 1.0 / u_resolution;
    float minDim = min(u_resolution.x, u_resolution.y);
    float current = texture2D(u_currentBoundary, v_texCoord).r;
    float sourceEdge = texture2D(u_sourceEdges, v_texCoord).r;
    vec4 simState = texture2D(u_simulationState, v_texCoord);

    // Spatial diffusion: isotropic neighborhood blur keeps boundaries soft
    float diffRadiusPx = u_boundaryDiffRadius * minDim;
    float diffused = 0.0;
    float dw = 0.0;
    const int DIFF_SAMPLES = 16;
    const float GOLDEN_ANGLE = 2.39996323;
    for (int i = 0; i < DIFF_SAMPLES; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(DIFF_SAMPLES);
        float r = sqrt(t) * diffRadiusPx;
        float a = fi * GOLDEN_ANGLE;
        vec2 offset = vec2(cos(a), sin(a)) * r * min(px.x, px.y);
        float s = texture2D(u_currentBoundary, v_texCoord + offset).r;
        float weight = 1.0 - t * u_boundaryDiffFalloff;
        diffused += s * weight;
        dw += weight;
    }
    diffused = dw > 0.0 ? diffused / dw : current;

    // Local activity: spatial gradient energy of simulation state
    float actRadiusPx = u_boundaryActRadius * minDim;
    float activity = 0.0;
    const int ACT_SAMPLES = 12;
    for (int i = 0; i < ACT_SAMPLES; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(ACT_SAMPLES);
        float r = sqrt(t) * actRadiusPx;
        float a = fi * GOLDEN_ANGLE;
        vec2 offset = vec2(cos(a), sin(a)) * r * min(px.x, px.y);
        vec4 neighbor = texture2D(u_simulationState, v_texCoord + offset);
        activity += length(neighbor.rgb - simState.rgb);
    }
    activity = clamp(activity / float(ACT_SAMPLES) * u_boundaryActGain, 0.0, 1.0);

    // Reassertion: gently pull boundary back toward source image edges
    float reassertion = (sourceEdge - current) * u_reassertionRate;

    // Erosion: high local simulation activity weakens the boundary
    float erosion = -current * activity * u_erosionStrength;

    // Diffusion: spatial smoothing
    float diffusion = (diffused - current) * u_diffusionRate;

    float next = current + (reassertion + erosion + diffusion) * u_deltaTime;
    next = clamp(next, 0.0, 1.0);

    gl_FragColor = vec4(next, 0.0, 0.0, 1.0);
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
    float minDim = min(u_resolution.x, u_resolution.y);
    float center = texture2D(u_edgeTexture, v_texCoord).r;

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

    float coarseRadiusPx = mix(0.004, 0.055, u_sectionScale) * minDim;
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

    float naturalSeed = mix(coarse, max(coarse, fine), u_microDetailInfluence);

    float closeRadiusPx = mix(0.002, 0.020, u_sectionClosure) * minDim;
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

    float mergeRadiusPx = mix(0.004, 0.047, u_tileSize) * minDim;
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
    float sampleStep = mix(2.4, 0.7, u_edgeDetail);
    
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
    
    float threshold = mix(1.05, 0.10, u_edgeDetail);
    float width = mix(0.40, 0.08, u_edgeDetail);
    float edgeStrength = smoothstep(threshold - width, threshold + width, edgeMagnitude);
    
    gl_FragColor = vec4(edgeStrength, 0.0, 0.0, 1.0);
}
`;

// Convolution shader - dual-kernel SmoothLife neighborhood averages
export const convolutionShader = `
precision highp float;

uniform sampler2D u_texture;
uniform sampler2D u_edgeTexture;
uniform vec2 u_resolution;
uniform float u_radius;

// Tunable params
uniform float u_innerFraction;
uniform float u_edgeAttenuation;
uniform float u_radialFalloff;

varying vec2 v_texCoord;

float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

void main() {
    vec2 pixelSize = 1.0 / u_resolution;
    vec4 centerColor = texture2D(u_texture, v_texCoord);
    float centerEdge = texture2D(u_edgeTexture, v_texCoord).r;

    float effectiveRadius = max(u_radius, 0.5);

    float innerFrac = u_innerFraction;
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
        float edgeWeight = 1.0 - barrier * u_edgeAttenuation;
        float radialWeight = 1.0 - t * u_radialFalloff;
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

    gl_FragColor = vec4(innerLum, outerColor.rgb);
}
`;

// ============================================================
// TRANSITION SHADER
//
// Architecture: L SmoothLife + unified (a,b) chromaticity dynamics
//
// L (lightness/value) runs full SmoothLife — the wavefront engine.
// Color is represented as a 2D chromaticity vector (a,b) on a disk:
//     a = S·cos(2πH),  b = S·sin(2πH)
// where H = hue angle, S = saturation = length(a,b).
//
// The (a,b) dynamics use a three-regime disagreement response:
//   Low  |d|:  survive — color is stable, resist change
//   Mod  |d|:  adopt   — propagate neighborhood color (diffusion)
//   High |d|:  fortify — resist AND self-intensify (vivid borders)
//
// Everything is gated by L (dead = gray), modulated by activity
// feedback (static → volatile, volatile → stable), and dampened
// by boundary barriers.
// ============================================================
export const transitionShader = `
precision highp float;

uniform sampler2D u_currentState;
uniform sampler2D u_convolution;
uniform sampler2D u_originalImage;
uniform sampler2D u_edgeTexture;
uniform vec2 u_resolution;
uniform float u_time;

uniform float u_chaos;
uniform float u_activity;
uniform float u_randomNoise;
uniform float u_edgePump;
uniform float u_imagePump;
uniform float u_structuredNoise;
uniform float u_mutation;
uniform float u_paletteStability;
uniform float u_sectionScale;
uniform float u_tileSize;
uniform float u_edgeAdherence;
uniform float u_sourceColorAdherence;
uniform float u_patternCoupling;
uniform float u_colorFeedback;
uniform float u_colorInertia;
uniform float u_sourceDrift;
uniform float u_deltaTime;
uniform sampler2D u_structuredNoiseTexture;
uniform sampler2D u_regionTexture;

// ============================================================
// TUNABLE RULE PARAMETERS — every hardcoded coefficient exposed
// ============================================================

// L Birth & Survival
uniform float u_birthFloor;
uniform float u_birthCeiling;
uniform float u_birthCeilChaos;
uniform float u_survivalFloor;
uniform float u_survivalCeiling;
uniform float u_survivalCeilChaos;
uniform float u_survivalBarrierBoost;
uniform float u_actBirthFloorShift;
uniform float u_actBirthCeilShift;

// L Transitions & Alive Detection
uniform float u_transWidth;
uniform float u_transWidthActScale;
uniform float u_transWidthSatScale;
uniform float u_transWidthConfScale;
uniform float u_transWidthBarrierScale;
uniform float u_transWidthFloor;
uniform float u_aliveEdgeLow;
uniform float u_aliveEdgeHigh;
uniform float u_aliveEdgeSatBoost;
uniform float u_aliveTransWidth;
uniform float u_aliveConfNarrow;

// L Update Dynamics
uniform float u_lifeRateBase;
uniform float u_lifeRateActScale;
uniform float u_perturbMag;
uniform float u_growthScale;

// Spatial & Barriers
uniform float u_barrierSelfWeight;
uniform float u_barrierNeighborWeight;
uniform float u_barrierColorMix;
uniform float u_noiseLMag;
uniform float u_confRadius;
uniform float u_confGain;
uniform float u_preActLumScale;
uniform float u_preActColorScale;
uniform float u_preActBaseScale;

// Color Adoption
uniform float u_adoptOnset;
uniform float u_adoptOnsetActScale;
uniform float u_adoptOnsetFloor;
uniform float u_adoptPeak;
uniform float u_adoptFalloff;
uniform float u_adoptFalloffActScale;
uniform float u_adoptFalloffCeil;
uniform float u_adoptFalloffWidth;

// Color Fortification & Gating
uniform float u_fortifyOnset;
uniform float u_fortifyPeak;
uniform float u_fortifyScale;
uniform float u_lGateOnset;
uniform float u_lGatePeak;
uniform float u_wavefrontBoost;

// Color Rates
uniform float u_colorRateBase;
uniform float u_colorRateActScale;
uniform float u_barrierColorDamp;
uniform float u_confColorBoost;
uniform float u_chromaNoiseMag;

// Source Anchor
uniform float u_anchorBaseStr;
uniform float u_anchorBarrierScale;
uniform float u_anchorPullRate;

// Color Pump
uniform float u_jumpRateMin;
uniform float u_jumpRateMax;
uniform float u_pumpBinsMax;
uniform float u_pumpBinsMin;
uniform float u_pumpSatMin;
uniform float u_pumpSatMax;
uniform float u_pumpValMin;
uniform float u_pumpValMax;
uniform float u_driftRateBase;
uniform float u_driftRateHazScale;
uniform float u_basePumpMin;
uniform float u_basePumpMax;
uniform float u_basePumpClamp;
uniform float u_activePumpBase;
uniform float u_activePumpHazScale;
uniform float u_patchUniBase;
uniform float u_patchUniScale;
uniform float u_patchUniGrowthDamp;

// Output
uniform float u_aliveMaskLow;
uniform float u_aliveMaskHigh;
uniform float u_deadDesaturation;
uniform float u_chromaFloorMin;
uniform float u_chromaFloorMax;
uniform float u_grayPushMag;
uniform float u_finalNoiseBase;
uniform float u_finalNoiseScale;

// Color Texture — internal pattern/color diversity
uniform float u_growthHueShift;
uniform float u_colorDiversity;
uniform float u_lSatModulation;
uniform float u_pumpNoiseSpread;

// Pump activity damping
uniform float u_pumpActDamp;

// Color feedback into L-channel
uniform float u_cfbBirthGain;
uniform float u_cfbSurvivalGain;
uniform float u_cfbThreshold;

varying vec2 v_texCoord;

float getLuminance(vec3 c) {
    return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
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

vec2 rgb2ab(vec3 c) {
    vec3 hsv = rgb2hsv(c);
    float angle = hsv.x * 6.2832;
    return vec2(hsv.y * cos(angle), hsv.y * sin(angle));
}

vec3 abv2rgb(vec2 ab, float v) {
    float S = length(ab);
    float H = atan(ab.y, ab.x) / 6.2832;
    H = fract(H);
    return hsv2rgb(vec3(H, clamp(S, 0.0, 1.0), clamp(v, 0.02, 0.98)));
}

// ============================================================
// L CHANNEL: SmoothLife wavefront engine
// All constants replaced by uniforms for live tuning.
// ============================================================
float lifeRule_L(float m_L, float n_L, float sat,
                 float chaos, float confinement, float preActivity,
                 float barrier, float colorDisagreement) {
    float chaosGate = 0.30 + 0.70 * chaos;

    float b1 = u_birthFloor;
    float b2 = u_birthCeiling + u_birthCeilChaos * chaosGate;

    float s1 = u_survivalFloor;
    float s2 = u_survivalCeiling + u_survivalCeilChaos * chaosGate + barrier * u_survivalBarrierBoost;

    // Activity feedback: ONLY widens birth. Never touches survival.
    float actBias = 0.5 - preActivity;
    b1 -= actBias * u_actBirthFloorShift;
    b2 += actBias * u_actBirthCeilShift;

    // Color feedback: uniform color (low disagreement) → widen birth, narrow survival
    // Creates self-sustaining cycle: uniform → spawn → diversify → settle → uniform
    // Gated by saturation: near-gray pixels have no "color" to be uniform about
    float chromaPresence = smoothstep(0.05, 0.20, sat);
    float colorUniformity = (1.0 - smoothstep(0.0, u_cfbThreshold, colorDisagreement))
                          * u_colorFeedback * chromaPresence;
    b1 -= colorUniformity * u_cfbBirthGain;        // lower birth floor → easier birth
    b2 += colorUniformity * u_cfbBirthGain * 0.7;  // raise birth ceiling → wider window
    s2 -= colorUniformity * u_cfbSurvivalGain;      // lower survival ceiling → harder to persist

    // Transition width
    float w = u_transWidth;
    w += actBias * u_transWidthActScale;
    w -= sat * u_transWidthSatScale;
    w *= 1.0 - confinement * u_transWidthConfScale;
    w += barrier * u_transWidthBarrierScale;
    w = max(u_transWidthFloor, w);

    float birth   = smoothstep(b1 - w, b1 + w, n_L)
                  * (1.0 - smoothstep(b2 - w, b2 + w, n_L));
    float survive = smoothstep(s1 - w, s1 + w, n_L)
                  * (1.0 - smoothstep(s2 - w, s2 + w, n_L));

    float aliveEdge = mix(u_aliveEdgeLow, u_aliveEdgeHigh, confinement) + sat * u_aliveEdgeSatBoost;
    float alive = smoothstep(aliveEdge, aliveEdge + u_aliveTransWidth - confinement * u_aliveConfNarrow, m_L);

    return mix(birth, survive, alive);
}

void main() {
    vec4 current = texture2D(u_currentState, v_texCoord);
    vec4 conv = texture2D(u_convolution, v_texCoord);
    vec4 original = texture2D(u_originalImage, v_texCoord);
    float edge = texture2D(u_edgeTexture, v_texCoord).r;

    float m_L = conv.r;
    vec3 outerColorRGB = vec3(conv.g, conv.b, conv.a);

    // Barrier from boundary field
    vec2 px = 1.0 / u_resolution;
    float edgeN =
        texture2D(u_edgeTexture, v_texCoord + vec2(px.x, 0.0)).r +
        texture2D(u_edgeTexture, v_texCoord - vec2(px.x, 0.0)).r +
        texture2D(u_edgeTexture, v_texCoord + vec2(0.0, px.y)).r +
        texture2D(u_edgeTexture, v_texCoord - vec2(0.0, px.y)).r;
    edgeN *= 0.25;
    float barrier = clamp(edge * u_barrierSelfWeight + edgeN * u_barrierNeighborWeight, 0.0, 1.0);

    // Barrier-attenuated outer ring
    vec3 neighborhoodColor = mix(outerColorRGB, current.rgb, barrier * u_barrierColorMix);
    float n_L = getLuminance(neighborhoodColor);

    // Chromaticity
    vec2 ab_cur = rgb2ab(clamp(current.rgb, 0.0, 1.0));
    vec2 ab_neigh = rgb2ab(clamp(neighborhoodColor, 0.0, 1.0));
    float sat_cur = length(ab_cur);

    // Structured noise → n_L
    vec3 structured = texture2D(u_structuredNoiseTexture, v_texCoord).rgb;
    n_L += (structured.r - 0.5) * u_noiseLMag * (0.5 + 0.5 * u_chaos);
    n_L = clamp(n_L, 0.0, 1.0);

    // Boundary confinement
    float minDim = min(u_resolution.x, u_resolution.y);
    float confinement = 0.0;
    const int CONF_SAMPLES = 8;
    const float CONF_GOLDEN = 2.39996323;
    float confRadiusUv = u_confRadius * minDim * min(px.x, px.y);
    for (int i = 0; i < CONF_SAMPLES; i++) {
        float fi = float(i);
        float ang = fi * CONF_GOLDEN;
        vec2 confUV = v_texCoord + vec2(cos(ang), sin(ang)) * confRadiusUv;
        confinement += texture2D(u_edgeTexture, confUV).r;
    }
    confinement = clamp(confinement / float(CONF_SAMPLES) * u_confGain, 0.0, 1.0);

    // Pre-activity
    vec2 d_color = ab_neigh - ab_cur;
    float dMag = length(d_color);
    float preActivity = clamp(
        abs(n_L - m_L) * u_preActLumScale
        + dMag * u_preActColorScale
        + u_activity * u_preActBaseScale,
        0.0, 1.0
    );

    // L update
    float targetL = lifeRule_L(m_L, n_L, sat_cur, u_chaos, confinement, preActivity, barrier, dMag);
    float lifeRate_L = clamp((u_lifeRateBase + u_activity * u_lifeRateActScale) * u_deltaTime, 0.0, 1.0);
    float newL = mix(m_L, targetL, lifeRate_L);

    // Symmetry-breaking perturbation
    float perturbTime = floor(u_time * 4.0) * 0.25;
    newL += (hash(v_texCoord * 350.0 + perturbTime * 0.7) - 0.5) * u_perturbMag * u_deltaTime;
    newL = clamp(newL, 0.0, 1.0);

    float growth = newL - m_L;
    float growthAbs = clamp(abs(growth) * u_growthScale, 0.0, 1.0);

    // ============================================================
    // (a, b) CHROMATICITY UPDATE
    // ============================================================

    float colorActBias = 0.5 - preActivity;

    // Adoption
    float adoptOnset   = max(u_adoptOnsetFloor, u_adoptOnset - colorActBias * u_adoptOnsetActScale);
    float adoptPeak    = u_adoptPeak;
    float adoptFalloff = min(u_adoptFalloffCeil, u_adoptFalloff + colorActBias * u_adoptFalloffActScale);
    float adoption = smoothstep(adoptOnset, adoptPeak, dMag)
                   * (1.0 - smoothstep(adoptFalloff, adoptFalloff + u_adoptFalloffWidth, dMag));

    // Fortification
    float fortify = smoothstep(u_fortifyOnset, u_fortifyPeak, dMag) * u_fortifyScale;

    // L-gating
    float lGate = smoothstep(u_lGateOnset, u_lGatePeak, newL);

    // Wavefront boost
    float wavefrontBoost = 1.0 + growthAbs * u_wavefrontBoost;

    // Color rate
    float colorRate = (u_colorRateBase + u_activity * u_colorRateActScale) * u_patternCoupling;

    // Adoption force
    vec2 adoptForce = d_color * adoption * colorRate * lGate * wavefrontBoost;

    // Fortification force
    vec2 fortifyDir = dMag > 0.001 ? -d_color / dMag : vec2(0.0);
    vec2 fortifyForce = fortifyDir * fortify * sat_cur * colorRate * lGate;

    // Barrier dampens cross-region color flow
    float barrierDamp = 1.0 - barrier * u_barrierColorDamp;

    // Confinement boosts color dynamics
    float confBoost = 1.0 + confinement * u_confColorBoost;

    // Total color change
    vec2 deltaAB = (adoptForce + fortifyForce) * barrierDamp * confBoost * u_deltaTime;
    vec2 ab_new = ab_cur + deltaAB;

    // GROWTH-HUE COUPLING: L-channel growth rotates color direction
    // Birth (growth>0) and death (growth<0) shift hue in opposite directions
    // Inertia dead zone: small growth produces no rotation — only wavefront events shift color
    float growthThreshold = u_colorInertia * 0.04;
    float growthGate = smoothstep(growthThreshold, growthThreshold + 0.01, abs(growth));
    float gatedGrowth = growth * growthGate;
    float hueRot = gatedGrowth * u_growthHueShift * lGate;
    float cosHR = cos(hueRot);
    float sinHR = sin(hueRot);
    ab_new = vec2(ab_new.x * cosHR - ab_new.y * sinHR,
                  ab_new.x * sinHR + ab_new.y * cosHR);

    // Structured noise perturbation in chromaticity space
    float noiseAngle = (structured.g - 0.5) * 6.2832;
    float noiseMag = (structured.b - 0.5) * u_chromaNoiseMag * u_chaos;
    ab_new += vec2(cos(noiseAngle), sin(noiseAngle)) * noiseMag * lGate * u_deltaTime;

    // ANTI-UNIFORMITY: break up uniform color regions
    // When local colors strongly agree, inject structured noise to create organic texture
    float uniformity = smoothstep(0.05, 0.0, dMag); // 1.0 when colors perfectly agree
    float divAngle = (structured.b - 0.5) * 6.2832 + structured.r * 3.0;
    float divMag = u_colorDiversity * uniformity * lGate * sat_cur;
    ab_new += vec2(cos(divAngle), sin(divAngle)) * divMag * u_deltaTime;

    // Clamp saturation
    float newSat = length(ab_new);
    if (newSat > 1.0) ab_new /= newSat;

    // ============================================================
    // REGION SOURCE POOLING
    // ============================================================
    float hazard = clamp(u_mutation, 0.0, 1.0);
    float stability = clamp(u_paletteStability, 0.0, 1.0);
    float srcAdh = clamp(u_sourceColorAdherence, 0.0, 1.0);

    float sectionVal = edge;
    vec3 regionSrc = original.rgb;
    float seedW = 1.0;
    float seedRadiusPx = mix(0.006, 0.040, u_sectionScale) * minDim;
    float seedRadiusUv = seedRadiusPx * min(px.x, px.y);
    const int REGION_SAMPLES = 12;
    const float REGION_ANGLE = 2.39996323;
    for (int i = 0; i < REGION_SAMPLES; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(REGION_SAMPLES);
        float r = sqrt(t) * seedRadiusUv;
        float ang = fi * REGION_ANGLE;
        vec2 uv = v_texCoord + vec2(cos(ang), sin(ang)) * r;
        vec3 src = texture2D(u_originalImage, uv).rgb;
        float e = texture2D(u_edgeTexture, uv).r;
        float w = 1.0 - max(sectionVal, e) * 0.94;
        regionSrc += src * w;
        seedW += w;
    }
    regionSrc /= max(seedW, 1.0);
    vec2 ab_regionSrc = rgb2ab(regionSrc);

    // ============================================================
    // SOURCE ANCHOR
    // ============================================================
    vec2 ab_src = rgb2ab(clamp(original.rgb, 0.0, 1.0));

    // SOURCE DRIFT: GoL growth rotates the source "memory"
    // Active areas evolve their reference point; quiet areas keep original
    float srcDriftAngle = gatedGrowth * u_sourceDrift * 5.0;
    float cSD = cos(srcDriftAngle);
    float sSD = sin(srcDriftAngle);
    ab_src = vec2(ab_src.x * cSD - ab_src.y * sSD,
                  ab_src.x * sSD + ab_src.y * cSD);

    // Source chroma: grayscale source pixels have no color to anchor to,
    // so color-space adherence scales by source chromaticity.
    // Structure (L-channel, boundaries) still uses the source — only (a,b) anchor is affected.
    float srcPixelChroma = length(rgb2ab(clamp(original.rgb, 0.0, 1.0)));
    float chromaGate = smoothstep(0.05, 0.25, srcPixelChroma);

    vec2 ab_src_offset = ab_src - ab_regionSrc;
    vec2 ab_target_indirect = ab_neigh + ab_src_offset;   // relative structure
    vec2 ab_target = mix(ab_target_indirect, ab_src, srcAdh); // high adherence → pull toward actual source color
    float anchorStr = srcAdh * (u_anchorBaseStr + u_anchorBarrierScale * (1.0 - barrier)) * chromaGate;
    // Pull rate scales with adherence: at srcAdh=1, 5× faster so source colors actually appear
    float effectivePullRate = u_anchorPullRate * (1.0 + srcAdh * 4.0);
    ab_new += (ab_target - ab_new) * anchorStr * effectivePullRate * u_deltaTime;

    // ============================================================
    // PUMP SYSTEM
    // ============================================================
    vec4 regionTex = texture2D(u_regionTexture, v_texCoord);
    float regionId = floor(regionTex.r * 255.0 + 0.5)
                   + floor(regionTex.g * 255.0 + 0.5) * 256.0;
    vec2 regionCell = vec2(mod(regionId, 251.0), floor(regionId / 251.0));
    float regionPhase = hash(regionCell + vec2(7.0, 19.0));
    float jumpRate = mix(u_jumpRateMin, u_jumpRateMax, hazard) * mix(0.35, 1.0, 1.0 - stability);
    float tBucket = floor((u_time + regionPhase * 13.0) * jumpRate);

    float bins = mix(u_pumpBinsMax, u_pumpBinsMin, hazard);
    float hBase0 = floor(hash(regionCell + vec2(3.1, 5.7)) * bins + 0.5) / bins;
    float sBase0 = mix(u_pumpSatMin, u_pumpSatMax, floor(hash(regionCell + vec2(7.3, 11.9)) * 4.0 + 0.5) / 4.0);
    float vBase0 = mix(u_pumpValMin, u_pumpValMax, floor(hash(regionCell + vec2(13.7, 17.3)) * 5.0 + 0.5) / 5.0);
    float driftRate = (u_driftRateBase + u_driftRateHazScale * hazard)
                    * (0.20 + 0.80 * (1.0 - stability))
                    * (0.35 + 0.65 * growthAbs);
    float hBase = fract(hBase0 + (u_time + regionPhase * 23.0) * driftRate);
    float sBase = clamp(sBase0 + (hash(regionCell + vec2(23.0, 41.0)) - 0.5) * 0.18
                  * sin((u_time + regionPhase * 17.0) * driftRate * 1.7), 0.55, 1.0);
    float vBase = clamp(vBase0 + (hash(regionCell + vec2(61.0, 7.0)) - 0.5) * 0.14
                  * sin((u_time + regionPhase * 31.0) * driftRate * 1.3), 0.42, 1.0);

    vec2 ab_freeBase = rgb2ab(hsv2rgb(vec3(hBase, sBase, vBase)));

    float hRnd = floor(hash(regionCell + vec2(tBucket * 0.37 + 31.0,
                  tBucket * 0.83 + 79.0)) * bins + 0.5) / bins;
    float sRnd = mix(0.70, 1.0, floor(hash(regionCell + vec2(tBucket * 0.91 + 53.0,
                  tBucket * 0.29 + 11.0)) * 4.0 + 0.5) / 4.0);
    float vRnd = mix(0.50, 0.98, floor(hash(regionCell + vec2(tBucket * 0.27 + 47.0,
                  tBucket * 0.63 + 89.0)) * 5.0 + 0.5) / 5.0);
    vec2 ab_freePump = rgb2ab(hsv2rgb(vec3(hRnd, sRnd, vRnd)));

    // Pump targets: only mix toward source region color if the source actually has chroma.
    // Grayscale source → free palette colors; colored source → source-like colors.
    float regionChroma = length(ab_regionSrc);
    float pumpSrcMix = srcAdh * smoothstep(0.05, 0.25, regionChroma);
    vec2 ab_pump = mix(ab_freePump, ab_regionSrc, pumpSrcMix);
    vec2 ab_base = mix(ab_freeBase, ab_regionSrc, pumpSrcMix);

    // PUMP SPATIAL SPREAD: diversify per-pixel pump target
    // Each pixel in the same region pulls toward a slightly different shade
    float spreadAngle = (structured.r + structured.g) * 3.14159;
    vec2 spreadVec = vec2(cos(spreadAngle), sin(spreadAngle)) * u_pumpNoiseSpread * structured.b;
    ab_base += spreadVec;
    ab_pump += spreadVec * 0.5;

    // Pump activity scaling: pump backs off in active areas so dynamics can drive color
    float pumpActScale = mix(1.0, 1.0 - u_pumpActDamp, preActivity);

    // Base pump — target already blends free↔source via srcAdh, so amount stays active
    float basePumpAmt = mix(u_basePumpMin, u_basePumpMax, 1.0 - stability)
                      * (0.45 + 0.55 * (1.0 - barrier))
                      * pumpActScale;
    ab_new = mix(ab_new, ab_base, clamp(basePumpAmt, 0.0, u_basePumpClamp));

    // Active pump
    float pumpAmt = clamp((u_activePumpBase + u_activePumpHazScale * hazard)
                  * (0.20 + 0.80 * (1.0 - stability))
                  * u_deltaTime
                  * (0.25 + 0.75 * growthAbs)
                  * pumpActScale, 0.0, 1.0);
    ab_new = mix(ab_new, ab_pump, pumpAmt);

    // Patch uniformity
    float patchUni = hazard * (u_patchUniBase + u_patchUniScale * (1.0 - stability))
                   * (1.0 - barrier)
                   * (1.0 - u_patchUniGrowthDamp * growthAbs);
    ab_new = mix(ab_new, ab_base, patchUni);

    // L-VALUE SATURATION: GoL patterns visible in saturation
    // Brighter L = more vivid, creating internal texture within color regions
    float lSatMod = mix(1.0 - u_lSatModulation, 1.0, smoothstep(0.15, 0.65, newL));
    ab_new *= lSatMod;

    // Dead pixels desaturate
    float aliveMask = smoothstep(u_aliveMaskLow, u_aliveMaskHigh, newL);
    ab_new *= mix(u_deadDesaturation, 1.0, aliveMask);

    // Final saturation clamp
    newSat = length(ab_new);
    if (newSat > 1.0) ab_new /= newSat;

    // Chromatic floor
    float chromaFloor = mix(u_chromaFloorMin, u_chromaFloorMax, 1.0 - srcAdh) * aliveMask;
    if (newSat < chromaFloor && newSat > 0.001) {
        ab_new *= chromaFloor / newSat;
    } else if (newSat <= 0.001 && aliveMask > 0.5) {
        float rAngle = structured.g * 6.2832;
        ab_new = vec2(cos(rAngle), sin(rAngle)) * chromaFloor * u_grayPushMag;
    }

    // ============================================================
    // FINAL ASSEMBLY
    // ============================================================
    vec3 finalRGB = abv2rgb(ab_new, newL);

    vec3 noiseRGB = (structured - 0.5)
                  * (u_finalNoiseBase + u_finalNoiseScale * u_structuredNoise)
                  * (0.25 + 0.50 * growthAbs)
                  * (1.0 - edge * 0.7);
    vec4 newColor = vec4(clamp(finalRGB + noiseRGB, 0.0, 1.0), 1.0);

    // Edge/image pump (both currently 0.0 — dormant)
    float edgePumpVal = clamp(u_edgePump * barrier * u_deltaTime * 2.2, 0.0, 1.0);
    float pumpStrengthVal = clamp(u_imagePump, 0.0, 1.0);
    float shaped = pow(pumpStrengthVal, 1.7);
    float halfLife = mix(180.0, 3.0, shaped);
    float imagePumpBase = 1.0 - exp(-0.69314718 * u_deltaTime / halfLife);
    float err = length(newColor.rgb - original.rgb) / 1.7320508;
    float errTaper = smoothstep(0.06, 0.45, err);
    float imagePumpVal = imagePumpBase * errTaper;

    float pumpTotal = clamp(edgePumpVal + imagePumpVal, 0.0, 1.0);
    if (pumpTotal > 0.001) {
        vec2 ab_final = rgb2ab(newColor.rgb);
        vec2 ab_orig = rgb2ab(original.rgb);
        float chromaPull = pumpTotal * srcAdh;
        ab_final = mix(ab_final, ab_orig, chromaPull);
        newColor.rgb = abv2rgb(ab_final, newL);
    }

    gl_FragColor = clamp(newColor, 0.0, 1.0);
}
`;
