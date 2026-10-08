export const coreV1VertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

export const coreV1DisplayShader = `
precision highp float;
uniform sampler2D u_texture;
uniform sampler2D u_sourceGuidance;
uniform float u_showGuidanceEdges;
uniform vec2 u_texel;
uniform float u_structureIdentityMix;
uniform float u_structureIdentityColor;
varying vec2 v_texCoord;

vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
    vec4 state = texture2D(u_texture, v_texCoord);
    float L = state.r;
    float a = state.g * 2.0 - 1.0;  // Decode from [0,1] to [-1,1]
    float b = state.b * 2.0 - 1.0;  // Decode from [0,1] to [-1,1]
    // state.a is M (momentum), not used for display
    
    // Convert (L, a, b) to RGB via HSV
    float s = clamp(length(vec2(a, b)), 0.0, 1.0);

    // Phase F4: secondary structural observable for composition
    // (purely additive in display path; mix=0 preserves current behavior).
    vec4 nState = texture2D(u_texture, v_texCoord + vec2(0.0, u_texel.y));
    vec4 sState = texture2D(u_texture, v_texCoord - vec2(0.0, u_texel.y));
    vec4 eState = texture2D(u_texture, v_texCoord + vec2(u_texel.x, 0.0));
    vec4 wState = texture2D(u_texture, v_texCoord - vec2(u_texel.x, 0.0));
    float Ln = nState.r;
    float Ls = sState.r;
    float Le = eState.r;
    float Lw = wState.r;
    float localLMean = 0.25 * (Ln + Ls + Le + Lw);
    float localLVar = 0.25 * (
        (Ln - localLMean) * (Ln - localLMean) +
        (Ls - localLMean) * (Ls - localLMean) +
        (Le - localLMean) * (Le - localLMean) +
        (Lw - localLMean) * (Lw - localLMean)
    );
    float localActivity = abs(L - state.a);
    float structureIdentity = clamp(
        0.55 * smoothstep(0.01, 0.20, localLVar) +
        0.45 * smoothstep(0.02, 0.25, localActivity),
        0.0,
        1.0
    );
    float valueComposed = mix(L, clamp(L + (structureIdentity - 0.5) * 0.35, 0.0, 1.0), clamp(u_structureIdentityMix, 0.0, 1.0));
    float satComposed = clamp(s + clamp(u_structureIdentityMix, 0.0, 1.0) * clamp(u_structureIdentityColor, 0.0, 1.0) * (structureIdentity - 0.5) * 0.6, 0.0, 1.0);
    float h = fract(atan(b, a) / 6.28318530718);
    
    vec3 rgb = hsv2rgb(vec3(h, satComposed, clamp(valueComposed, 0.02, 0.98)));
    vec4 guidance = texture2D(u_sourceGuidance, v_texCoord);
    float edgeMask = smoothstep(0.22, 0.72, guidance.a) * clamp(u_showGuidanceEdges, 0.0, 1.0);
    float overlayOn = clamp(u_showGuidanceEdges, 0.0, 1.0);
    vec3 dimmed = rgb * mix(1.0, 0.18, overlayOn);
    rgb = mix(dimmed, vec3(1.0), edgeMask);
    gl_FragColor = vec4(rgb, 1.0);
}
`;

export const coreV1ConvolutionShader = `
precision highp float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_radius;
varying vec2 v_texCoord;

void main() {
    vec2 px = 1.0 / u_resolution;
    vec4 centerState = texture2D(u_texture, v_texCoord);
    
    // Decode center cell state
    float L = centerState.r;
    float a = centerState.g * 2.0 - 1.0;
    float b = centerState.b * 2.0 - 1.0;
    
    // Accumulators
    float lSum = L;
    float lSqSum = L * L;  // For variance computation
    vec2 abSum = vec2(a, b);
    float wSum = 1.0;

    const int N = 12;
    const float GOLD = 2.39996323;
    for (int i = 0; i < N; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(N);
        float rr = sqrt(t) * u_radius;
        float ang = fi * GOLD;
        vec2 uv = v_texCoord + vec2(cos(ang), sin(ang)) * rr * px;
        
        // Decode neighbor state
        vec4 neighborState = texture2D(u_texture, uv);
        float nL = neighborState.r;
        float na = neighborState.g * 2.0 - 1.0;
        float nb = neighborState.b * 2.0 - 1.0;
        
        float w = 1.0 - 0.35 * t;
        lSum += nL * w;
        lSqSum += nL * nL * w;  // Accumulate squared values
        abSum += vec2(na, nb) * w;
        wSum += w;
    }

    // Compute neighborhood statistics
    float lMean = lSum / wSum;
    float lSqMean = lSqSum / wSum;
    float lVariance = max(0.0, lSqMean - lMean * lMean);
    float lStddev = sqrt(lVariance);
    vec2 abMean = abSum / wSum;
    
    // Output: (lMean, lStddev, abMean.x, abMean.y)
    // Need to encode abMean back to [0,1] for storage
    gl_FragColor = vec4(
        lMean, 
        lStddev, 
        abMean.x * 0.5 + 0.5,
        abMean.y * 0.5 + 0.5
    );
}
`;

export const coreV1TransitionShader = `
precision highp float;
uniform sampler2D u_currentState;
uniform sampler2D u_convolution;
uniform sampler2D u_originalImage;
uniform sampler2D u_sourceGuidance;
uniform vec2 u_resolution;
uniform float u_radius;
uniform float u_deltaTime;

// L dynamics
uniform float u_coreLRate;
uniform float u_coreLDiffGain;
uniform float u_coreMaxDeltaL;
uniform float u_refractoryGain;
uniform float u_refractoryThreshold;
uniform float u_refractoryWidth;
uniform float u_excitabilityGain;
uniform float u_refractoryColorDamp;
uniform float u_satRegimeGain;
uniform float u_satRegimeSpread;
uniform float u_lumaChromaCoexistGain;
uniform float u_memoryDecay;
uniform float u_historyOscillationGain;
uniform float u_divergenceGain;
uniform float u_moderationGain;
uniform float u_varianceAmplifyGain;
uniform float u_flatBreakupGain;
uniform float u_noiseGain;
uniform float u_contrastGain;

// Chroma dynamics
uniform float u_coreColorRate;
uniform float u_coreAdoptGain;
uniform float u_coreGrowthHueCoupling;
uniform float u_coreMaxDeltaAB;

// Diversity
uniform float u_diversityKick;
uniform float u_antiConsensusGain;
uniform float u_vorticityGain;

// State angles
uniform float u_angleL;
uniform float u_angleM;
uniform float u_angleS;
uniform float u_angleV;

// Angle fixes
uniform float u_angleQuantization;
uniform float u_spatialFrequency;
uniform float u_positionAngleBias;
uniform float u_momentumThreshold;
uniform float u_varianceThreshold;
uniform float u_memoryFreqScale;

// Attractors
uniform float u_attractorGain;
uniform float u_attractor1;
uniform float u_attractor2;
uniform float u_attractor3;

// Boundaries
uniform float u_boundaryAmplify;
uniform float u_hysteresisGain;
uniform float u_competitionGain;

// Hybrid SmoothLife kernel (Phase A)
uniform float u_kernelBlend;
uniform float u_kernelGrowthGain;
uniform float u_kernelInhibitGain;
uniform float u_kernelInnerRatio;
uniform float u_kernelTransitionWidth;
uniform float u_kernelBirthCenter;
uniform float u_kernelBirthWidth;
uniform float u_kernelSurvivalCenter;
uniform float u_kernelSurvivalWidth;
uniform float u_kernelSecondaryGain;
uniform float u_kernelSecondaryRadius;
uniform float u_kernelSecondaryInner;
uniform float u_kernelColorToLGain;
uniform float u_kernelLToColorGain;
uniform float u_colorWaveDamping;
uniform float u_colorPocketGain;
uniform float u_fieldMomentCoupling;
uniform float u_crossMomentCoupling;
uniform float u_scaleMomentCoupling;
uniform float u_sourceGuidanceGain;
uniform float u_sourceAnisotropy;
uniform float u_sourceCoherenceFloor;
uniform float u_sourceRidgeBias;

uniform float u_frameCount;

varying vec2 v_texCoord;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Decode (a, b) from texture storage [0,1] to actual range [-1,1]
vec2 decode_ab(vec2 encoded) {
    return encoded * 2.0 - 1.0;
}

// Rotate a 2D vector by angle (radians)
vec2 rotate_vector(vec2 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

// Hash function for pseudo-random values
vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float sigmoid_soft(float x, float center, float width) {
    float w = max(0.001, width);
    return 1.0 / (1.0 + exp(-(x - center) * 4.0 / w));
}

float sigma_n(float x, float low, float high, float width) {
    return sigmoid_soft(x, low, width) * (1.0 - sigmoid_soft(x, high, width));
}

float sigma_mix(float x, float y, float m, float width) {
    float k = sigmoid_soft(m, 0.5, width);
    return mix(x, y, k);
}

vec2 sample_smoothlife_mn(vec2 uv, vec2 sourceDir, float sourceCoherence, float outerRadiusPx, float innerRatio) {
    vec2 px = 1.0 / u_resolution;
    float outerRadius = max(1.0, outerRadiusPx);
    float innerRadius = outerRadius * clamp(innerRatio, 0.05, 0.95);
    float coherenceGate = smoothstep(u_sourceCoherenceFloor, 1.0, sourceCoherence);
    float anisotropy = 1.0 + coherenceGate * u_sourceGuidanceGain * u_sourceAnisotropy;
    float axisLong = clamp(anisotropy, 1.0, 6.0);
    float axisShort = 1.0 / axisLong;
    vec2 dir = length(sourceDir) > 1.0e-5 ? normalize(sourceDir) : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    float mSum = 0.0;
    float nSum = 0.0;
    float mCount = 0.0;
    float nCount = 0.0;

    const int N_INNER = 12;
    const int N_RING = 20;
    const float GOLD = 2.39996323;

    for (int i = 0; i < N_INNER; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(N_INNER);
        float rr = sqrt(t) * innerRadius;
        float ang = fi * GOLD;
        vec2 circle = vec2(cos(ang), sin(ang));
        vec2 ellipse = dir * (dot(circle, dir) * axisLong) + nrm * (dot(circle, nrm) * axisShort);
        vec2 pos = uv + ellipse * rr * px;
        float nL = texture2D(u_currentState, pos).r;
        mSum += nL;
        mCount += 1.0;
    }

    for (int i = 0; i < N_RING; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(N_RING);
        float rr = innerRadius + (outerRadius - innerRadius) * t;
        float ang = fi * GOLD * 1.61803398875;
        vec2 circle = vec2(cos(ang), sin(ang));
        vec2 ellipse = dir * (dot(circle, dir) * axisLong) + nrm * (dot(circle, nrm) * axisShort);
        vec2 pos = uv + ellipse * rr * px;
        float nL = texture2D(u_currentState, pos).r;
        nSum += nL;
        nCount += 1.0;
    }

    float m = mCount > 0.0 ? (mSum / mCount) : texture2D(u_currentState, uv).r;
    float n = nCount > 0.0 ? (nSum / nCount) : m;
    return vec2(m, n);
}

// Compute state-dependent rotation angle from cell state
// Returns angle in radians: [-π, π]
// Phase 3A: Now with quantization, position bias, and threshold switching
float compute_state_angle(
    float L_val,
    float M_val,
    float saturation,
    float L_variance
) {
    // Each factor contributes to rotation angle
    float L_contrib = (L_val - 0.5) * u_angleL * PI;
    float M_contrib = (L_val - M_val) * u_angleM * PI * 2.0;
    float S_contrib = (saturation - 0.5) * u_angleS * PI;
    float V_contrib = L_variance * u_angleV * PI;
    
    // Sum base angle
    float angle = L_contrib + M_contrib + S_contrib + V_contrib;
    
    // Phase 3A Fix 2: Add position-dependent bias (breaks spatial synchronization)
    // Continuous spatial variation (no floor = no grid artifacts)
    float position_bias = (hash22(v_texCoord * u_spatialFrequency).x - 0.5) * u_positionAngleBias * PI;
    angle += position_bias;
    
    // Phase 3A Fix 3: Threshold-based angle switching (nonlinearity)
    if (abs(M_contrib) > u_momentumThreshold * PI) {
        // High momentum - lock to perpendicular
        angle = sign(M_contrib) * PI * 0.5;
    }
    if (V_contrib > u_varianceThreshold * PI) {
        // High variance (boundary) - lock to tangent
        angle = PI * 0.5;
    }
    
    // Wrap to [-π, π]
    angle = mod(angle + PI, TWO_PI) - PI;
    
    // Phase 3A Fix 1: Quantize angles to discrete directions (creates discrete domains)
    if (u_angleQuantization > 1.0) {
        float angle_step = TWO_PI / u_angleQuantization;
        angle = floor((angle + PI) / angle_step) * angle_step - PI;
    }
    
    return angle;
}

vec2 rgb2ab(vec3 c) {
    float maxc = max(c.r, max(c.g, c.b));
    float minc = min(c.r, min(c.g, c.b));
    float d = maxc - minc;
    float h = 0.0;
    if (d > 1.0e-6) {
        if (maxc == c.r) h = mod((c.g - c.b) / d, 6.0);
        else if (maxc == c.g) h = (c.b - c.r) / d + 2.0;
        else h = (c.r - c.g) / d + 4.0;
        h /= 6.0;
    }
    float s = maxc > 1.0e-6 ? d / maxc : 0.0;
    return vec2(s * cos(h * 6.28318530718), s * sin(h * 6.28318530718));
}

vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    vec3 rgb = clamp(p - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

vec3 abv2rgb(vec2 ab, float v) {
    float s = clamp(length(ab), 0.0, 1.0);
    float h = fract(atan(ab.y, ab.x) / 6.28318530718);
    return hsv2rgb(vec3(h, s, clamp(v, 0.02, 0.98)));
}

void main() {
    vec4 current = texture2D(u_currentState, v_texCoord);
    vec4 conv = texture2D(u_convolution, v_texCoord);
    vec4 guidance = texture2D(u_sourceGuidance, v_texCoord);
    vec2 sourceDir = normalize(guidance.rg * 2.0 - 1.0);
    float sourceCoherence = guidance.b;
    float sourceRidge = guidance.a;
    
    // Decode current state: (L, a, b, M)
    float lNow = current.r;
    float aNow = current.g * 2.0 - 1.0;
    float bNow = current.b * 2.0 - 1.0;
    float M = current.a;
    vec2 abNow = vec2(aNow, bNow);
    float satNow = length(abNow);
    
    // Decode convolution: (lMean, lStddev, abMean.x, abMean.y)
    float lMean = conv.r;
    float lStddev = conv.g;  // Will use in Phase 4
    float aMean = conv.b * 2.0 - 1.0;
    float bMean = conv.a * 2.0 - 1.0;
    vec2 abMean = vec2(aMean, bMean);
    float chromaMismatch = length(abMean - abNow);

    // SmoothLife-style neighborhood measurements: primary and secondary structural scales.
    vec2 mn = sample_smoothlife_mn(v_texCoord, sourceDir, sourceCoherence, u_radius, u_kernelInnerRatio);
    float m = mn.x;
    float n = mn.y;
    float secondaryRadius = u_radius * max(1.0, u_kernelSecondaryRadius);
    vec2 mn2 = sample_smoothlife_mn(v_texCoord, sourceDir, sourceCoherence, secondaryRadius, u_kernelSecondaryInner);
    float m2 = mn2.x;
    float n2 = mn2.y;

    float birthLow = clamp(u_kernelBirthCenter - 0.5 * u_kernelBirthWidth, 0.0, 1.0);
    float birthHigh = clamp(u_kernelBirthCenter + 0.5 * u_kernelBirthWidth, 0.0, 1.0);
    float surviveLow = clamp(u_kernelSurvivalCenter - 0.5 * u_kernelSurvivalWidth, 0.0, 1.0);
    float surviveHigh = clamp(u_kernelSurvivalCenter + 0.5 * u_kernelSurvivalWidth, 0.0, 1.0);

    float low = sigma_mix(birthLow, surviveLow, m, u_kernelTransitionWidth);
    float high = sigma_mix(birthHigh, surviveHigh, m, u_kernelTransitionWidth);
    float smoothlifeS = sigma_n(n, low, high, u_kernelTransitionWidth);
    float smoothlifeSignal = 2.0 * smoothlifeS - 1.0;
    float lateralInhibition = max(0.0, n - m);
    float smoothlifeS2 = sigma_n(n2, low, high, u_kernelTransitionWidth);
    float smoothlifeSignal2 = 2.0 * smoothlifeS2 - 1.0;
    float lateralInhibition2 = max(0.0, n2 - m2);
    // Keep color->L coupling centered and bounded so it does not create global bright bias.
    float colorToL = u_kernelColorToLGain * clamp(chromaMismatch - 0.22, -0.20, 0.20);
    // Encourage true dark voids when both inner and outer densities are low.
    float voidness = (1.0 - smoothstep(0.08, 0.22, m)) * (1.0 - smoothstep(0.08, 0.22, n));
    float voidDarkening = (0.15 + 0.5 * u_kernelInhibitGain) * voidness;
    float voidness2 = (1.0 - smoothstep(0.08, 0.22, m2)) * (1.0 - smoothstep(0.08, 0.22, n2));
    float voidDarkening2 = (0.15 + 0.5 * u_kernelInhibitGain) * voidness2;
    float coherenceGate = smoothstep(u_sourceCoherenceFloor, 1.0, sourceCoherence);
    float sourceGain = u_sourceGuidanceGain * coherenceGate;
    float ridgeCentered = sourceRidge * 2.0 - 1.0;
    float localGrowthGain = u_kernelGrowthGain * (1.0 + sourceGain * u_sourceRidgeBias * ridgeCentered);
    float localInhibitGain = u_kernelInhibitGain * (1.0 - 0.5 * sourceGain * u_sourceRidgeBias * ridgeCentered);
    float satMean = length(abMean);
    float fieldMomentL = lStddev * abs(chromaMismatch - satMean);
    float crossMomentL = (lNow - lMean) * (satNow - satMean);
    float scaleMomentL = chromaMismatch - satMean;
    float chromaToLCoexist = (satNow - satMean) * (0.4 + 0.6 * clamp(chromaMismatch * 2.0, 0.0, 1.0));
    float implicitCouplingL =
        u_fieldMomentCoupling * fieldMomentL +
        u_crossMomentCoupling * crossMomentL +
        u_scaleMomentCoupling * scaleMomentL;
    localGrowthGain = max(0.0, localGrowthGain);
    localInhibitGain = max(0.0, localInhibitGain);
    float kernelContribution = u_kernelBlend * (
        smoothlifeSignal * localGrowthGain
        - lateralInhibition * localInhibitGain
        + colorToL
        + 0.22 * u_lumaChromaCoexistGain * chromaToLCoexist
        - voidDarkening
    );
    float kernelSecondaryContribution = u_kernelBlend * u_kernelSecondaryGain * (
        smoothlifeSignal2 * localGrowthGain
        - lateralInhibition2 * localInhibitGain
        - voidDarkening2
    );
    // Strictly additive implicit coupling: zero knobs -> exact pre-coupling behavior.
    kernelContribution += u_kernelBlend * 0.2 * clamp(implicitCouplingL, -1.0, 1.0);
    kernelContribution += kernelSecondaryContribution;

    // === L UPDATE: Oscillatory dynamics ===
    float dL = 0.0;

    // (K) Blendable SmoothLife growth core (Phase A)
    dL += kernelContribution;
    
    // (A) Diffusion - smooth toward neighbors
    dL += (lMean - lNow) * u_coreLDiffGain;
    
    // (B) History oscillation - creates anti-damping
    // When L > M (above trend), push down; when L < M, push up
    float deviation = lNow - M;
    dL += -deviation * u_historyOscillationGain;
    
    // (C) Non-monotonic conformity pressure
    float diff = lNow - lMean;
    float absDiff = abs(diff);
    if (absDiff < 0.15) {
        // Too similar to neighbors - diverge
        if (absDiff < 0.01) {
            // Perfectly uniform - add random perturbation to break symmetry
            float randomPush = (hash22(v_texCoord + u_frameCount * 0.002).x - 0.5) * 2.0;
            dL += randomPush * u_divergenceGain;
        } else {
            // Nearly uniform - push apart
            dL += -sign(diff) * u_divergenceGain;
        }
    } else if (absDiff > 0.4) {
        // Too different from neighbors - moderate
        dL += -sign(diff) * u_moderationGain;
    }
    // else: sweet spot (0.15-0.4) - no conformity pressure
    
    // (D) Variance-driven dynamics - FIXED to handle flat regions
    // Flat regions get random perturbation, structured regions get amplification
    if (lStddev < 0.05) {
        // Very flat region - add noise to break up uniformity
        float flatForce = (0.05 - lStddev) / 0.05;  // 0 to 1 as variance → 0
        float randomDir = hash22(v_texCoord + u_frameCount * 0.001).x - 0.5;
        dL += randomDir * flatForce * u_flatBreakupGain * 2.0;
    } else {
        // Structured region - amplify existing gradients
        float varianceBoost = lStddev * u_varianceAmplifyGain;
        float dLSign = dL > 0.0 ? 1.0 : (dL < 0.0 ? -1.0 : 0.0);
        dL += varianceBoost * dLSign;
    }
    
    // (E) Always add small L noise to prevent exact equilibrium
    float L_noise = (hash22(v_texCoord * 500.0 + u_frameCount * 0.003).x - 0.5) * u_noiseGain * 0.3;
    dL += L_noise;
    
    // (F) Contrast amplification at L boundaries
    // When variance is high (at boundary), amplify contrast
    if (lStddev > 0.15) {
        float contrast_force = -sign(diff) * lStddev * u_contrastGain;
        dL += contrast_force;
    }
    
    // === PHASE 3B: Multi-Stable Attractors ===
    // L is attracted to discrete brightness levels
    float dist1 = abs(lNow - u_attractor1);
    float dist2 = abs(lNow - u_attractor2);
    float dist3 = abs(lNow - u_attractor3);
    
    // Continuous smooth pull toward nearest attractor
    float pull1 = smoothstep(0.3, 0.05, dist1) * (u_attractor1 - lNow);
    float pull2 = smoothstep(0.3, 0.05, dist2) * (u_attractor2 - lNow);
    float pull3 = smoothstep(0.3, 0.05, dist3) * (u_attractor3 - lNow);
    dL += (pull1 + pull2 + pull3) * u_attractorGain;
    
    // === PHASE 3D: Boundary Sharpening ===
    // (G) Step-function amplification at DYNAMIC thresholds (between attractors)
    float threshold_low = (u_attractor1 + u_attractor2) * 0.5;   // Between dark & mid
    float threshold_high = (u_attractor2 + u_attractor3) * 0.5;  // Between mid & bright
    
    if (lNow < threshold_low && dL < 0.0) {
        // Crossing down - amplify
        dL *= (1.0 + u_boundaryAmplify * (threshold_low - lNow) * 5.0);
    }
    if (lNow > threshold_high && dL > 0.0) {
        // Crossing up - amplify
        dL *= (1.0 + u_boundaryAmplify * (lNow - threshold_high) * 5.0);
    }
    
    // Hysteresis in middle band (between threshold_low and threshold_high)
    if (lNow > threshold_low && lNow < threshold_high) {
        float band_center = u_attractor2;
        float band_width = threshold_high - threshold_low;
        float dist_from_center = abs(lNow - band_center);
        dL *= (1.0 - u_hysteresisGain * (1.0 - dist_from_center * 2.0 / band_width));
    }
    
    // (H) Local competition (winner-take-all)
    float competitionZone = 0.15;
    if (abs(diff) > competitionZone) {
        // Amplify differences
        float competitionForce = sign(diff) * (abs(diff) - competitionZone) * u_competitionGain;
        dL += competitionForce;
    }
    
    // Hybrid mixing semantics:
    // kernelBlend=0.0 -> full legacy behavior
    // kernelBlend=1.0 -> kernel-only L behavior (legacy L terms suppressed)
    float legacyScale = 1.0 - clamp(u_kernelBlend, 0.0, 1.0);
    dL = kernelContribution + (dL - kernelContribution) * legacyScale;

    // Refractory / excitability layer (Phase F3):
    // derive refractory from local activity proxy using existing state (L, M, local variance).
    // All terms are additive and zero-able by knobs.
    float activityProxy = abs(lNow - M) + 0.6 * lStddev;
    float refractory = smoothstep(
        u_refractoryThreshold,
        u_refractoryThreshold + max(0.01, u_refractoryWidth),
        activityProxy
    );
    float refractoryScale = max(0.0, 1.0 - u_refractoryGain * refractory);
    float dLpos = max(0.0, dL) * refractoryScale;
    float dLneg = min(0.0, dL);
    float lowVarianceExcitability = 1.0 - smoothstep(0.05, 0.25, lStddev);
    float excitabilityTerm = u_excitabilityGain * (1.0 - refractory) * lowVarianceExcitability * (lMean - lNow);
    dL = dLpos + dLneg + excitabilityTerm;

    // Apply rate limiting and clamp
    float dLClamped = clamp(dL, -u_coreMaxDeltaL, u_coreMaxDeltaL);
    float lNew = clamp(lNow + dLClamped * u_coreLRate * u_deltaTime, 0.0, 1.0);
    
    // Prevent black degeneracy - but allow near-black (floor at 0.001 = 0.1%)
    // Allow pure black (L=0) - true contrast!
    // Recovery happens naturally from diffusion, oscillation, noise
    lNew = max(0.0, lNew);
    

    // === CHROMA UPDATE: Non-monotonic + momentum-driven ===
    
    // First, sample 4-neighbors for Laplacian and vorticity calculations
    vec2 px = 1.0 / u_resolution;
    vec2 ab_north = decode_ab(texture2D(u_currentState, v_texCoord + vec2(0, px.y)).gb);
    vec2 ab_south = decode_ab(texture2D(u_currentState, v_texCoord - vec2(0, px.y)).gb);
    vec2 ab_east = decode_ab(texture2D(u_currentState, v_texCoord + vec2(px.x, 0)).gb);
    vec2 ab_west = decode_ab(texture2D(u_currentState, v_texCoord - vec2(px.x, 0)).gb);
    
    float L_n = texture2D(u_currentState, v_texCoord + vec2(0, px.y)).r;
    float L_s = texture2D(u_currentState, v_texCoord - vec2(0, px.y)).r;
    float L_e = texture2D(u_currentState, v_texCoord + vec2(px.x, 0)).r;
    float L_w = texture2D(u_currentState, v_texCoord - vec2(px.x, 0)).r;

    vec2 abLocalMean = 0.25 * (ab_north + ab_south + ab_east + ab_west);
    vec2 dGlobal = abMean - abNow;
    vec2 dLocal = abLocalMean - abNow;
    float dGlobalMag = length(dGlobal);
    float dLocalMag = length(dLocal);
    // Localize chroma transport under kernel mode / wave damping:
    // use nearby consensus more than full-radius consensus to avoid global phase lock-in.
    float localRefBlend = clamp(0.15 + 0.55 * u_colorWaveDamping + 0.30 * u_kernelBlend, 0.0, 1.0);
    vec2 abRef = mix(abMean, abLocalMean, localRefBlend);
    vec2 d = abRef - abNow;
    float dMag = length(d);
    float uniformity = dLocalMag;  // Local uniformity for diversity kick
    vec2 dAB = vec2(0.0);
    
    // Compute L momentum for use in multiple mechanisms
    float L_momentum = lNew - M;
    
    // (A) Non-monotonic adoption (continuous):
    // smooth repel -> neutral -> strong mid-band adoption -> weak far adoption.
    // This keeps transport emergent from local mismatch fields without hard branch thresholds.
    float repelGate = 1.0 - smoothstep(0.02, 0.05, dLocalMag);
    float midGate = smoothstep(0.07, 0.14, dLocalMag) * (1.0 - smoothstep(0.26, 0.40, dLocalMag));
    float farGate = smoothstep(0.30, 0.55, dLocalMag);
    float adoptStrength = -0.30 * repelGate + 1.20 * midGate + 0.25 * farGate;
    float locality = clamp(dLocalMag / (dGlobalMag + 1.0e-4), 0.0, 1.0);
    float waveDampScale = mix(1.0, locality, clamp(u_colorWaveDamping, 0.0, 1.0));
    dAB += d * adoptStrength * u_coreAdoptGain * waveDampScale;

    // Local moment coupling (implicit): local variances/covariance/scale separation
    // modulate chroma transport without explicit motif detectors.
    float satNorth = length(ab_north);
    float satSouth = length(ab_south);
    float satEast = length(ab_east);
    float satWest = length(ab_west);
    float satLocalMean = 0.25 * (satNorth + satSouth + satEast + satWest);
    float satLocalVar = 0.25 * (
        (satNorth - satLocalMean) * (satNorth - satLocalMean) +
        (satSouth - satLocalMean) * (satSouth - satLocalMean) +
        (satEast - satLocalMean) * (satEast - satLocalMean) +
        (satWest - satLocalMean) * (satWest - satLocalMean)
    );
    float lLocalMean = 0.25 * (L_n + L_s + L_e + L_w);
    float lLocalVar = 0.25 * (
        (L_n - lLocalMean) * (L_n - lLocalMean) +
        (L_s - lLocalMean) * (L_s - lLocalMean) +
        (L_e - lLocalMean) * (L_e - lLocalMean) +
        (L_w - lLocalMean) * (L_w - lLocalMean)
    );
    float fieldMomentAB = sqrt(max(0.0, satLocalVar * lLocalVar));
    float crossMomentAB = (lNow - lLocalMean) * (satNow - satLocalMean);
    float scaleMomentAB = dGlobalMag - dLocalMag;
    float implicitCouplingAB =
        u_fieldMomentCoupling * fieldMomentAB +
        u_crossMomentCoupling * crossMomentAB +
        u_scaleMomentCoupling * scaleMomentAB;

    // Base behavior (pre-implicit coupling)
    dAB += dLocal * u_colorPocketGain;
    // Strictly additive implicit coupling term
    dAB += dLocal * (0.35 * implicitCouplingAB);

    // Intrinsic chroma anti-collapse term (deterministic, field-driven):
    // Even with DiversityKick=0, local gradients/moments keep chroma from becoming an absorbing gray state.
    vec2 gradLVec = vec2(L_e - L_w, L_n - L_s);
    vec2 gradSatVec = vec2(satEast - satWest, satNorth - satSouth);
    vec2 intrinsicBasis = gradLVec + rotate_vector(gradSatVec, PI * 0.5);
    intrinsicBasis += sourceDir * (0.35 + 0.65 * sourceCoherence);
    float intrinsicLen = length(intrinsicBasis);
    vec2 intrinsicDir = intrinsicLen > 1.0e-5 ? intrinsicBasis / intrinsicLen : vec2(1.0, 0.0);
    float lowSat = smoothstep(0.22, 0.02, satNow);
    float localActivity = clamp(0.45 * abs(smoothlifeSignal) + 0.35 * lStddev + 0.35 * abs(lNow - M), 0.0, 1.0);
    float intrinsicStrength = lowSat * localActivity * (0.035 + 0.20 * u_diversityKick);
    dAB += intrinsicDir * intrinsicStrength;

    // Coherent high-saturation regions relax slightly to avoid global lock-in.
    float satExcess = max(0.0, satNow - satLocalMean);
    float coherenceLock = smoothstep(0.55, 0.95, satNow) * (1.0 - clamp(dLocalMag / 0.16, 0.0, 1.0));
    vec2 satDir = satNow > 1.0e-5 ? (abNow / satNow) : intrinsicDir;
    if (satNow > 1.0e-5) {
        float quenchBase = coherenceLock * (0.06 + satExcess * 0.25) * clamp(u_colorWaveDamping, 0.0, 1.0);
        float quenchAdd = coherenceLock * (0.05 * max(0.0, implicitCouplingAB)) * clamp(u_colorWaveDamping, 0.0, 1.0);
        float quench = quenchBase + quenchAdd;
        dAB -= satDir * quench;
    }

    // Emergent saturation-distribution shaping (Phase F4b, state dynamics):
    // no absolute hue targets; only local moments/contrast/activity drive regime formation.
    float satVar = sqrt(max(0.0, satLocalVar));
    float lContrastLocal = abs(lNow - lLocalMean);
    float activityState = clamp(0.55 * abs(lNow - M) + 0.35 * lStddev + 0.25 * dLocalMag, 0.0, 1.0);
    float regimeGate = smoothstep(0.08, 0.45, activityState + satVar + lContrastLocal);
    float satLowRegime = clamp(0.06 + 0.24 * satLocalMean, 0.02, 0.40);
    float satHighRegime = clamp(0.42 + 0.45 * satVar + 0.20 * lStddev, 0.20, 1.00);
    float satTarget = mix(satLowRegime, satHighRegime, regimeGate);
    // Spread term broadens coexistence of sat regimes (without hue preference).
    float satSpread = u_satRegimeSpread * (satNow - satTarget) * (0.5 - abs(satNow - 0.5));
    float satRegimeForce = (satTarget - satNow) + satSpread;
    dAB += satDir * (u_satRegimeGain * satRegimeForce);

    // Luma/chroma coexistence coupling:
    // preserves chroma through dark/bright structural contrast when local activity supports it.
    float coexistSignal = (lContrastLocal + 0.6 * activityState) * (0.55 + 0.45 * satVar);
    dAB += satDir * (u_lumaChromaCoexistGain * coexistSignal * 0.25);
    
    // (B) State-dependent rotation driven by L momentum
    // Angle varies based on cell state - creates heterogeneous dynamics
    float state_angle = compute_state_angle(lNew, M, length(abNow), lStddev);
    vec2 base_dir = dMag > 1.0e-5 ? normalize(d) : vec2(1.0, 0.0);
    vec2 rotated_dir = rotate_vector(base_dir, state_angle);
    float kernelFlowBoost = 1.0 + u_kernelBlend * u_kernelLToColorGain * abs(smoothlifeSignal);
    dAB += rotated_dir * abs(L_momentum) * u_coreGrowthHueCoupling * kernelFlowBoost;
    
    // (C) REMOVED SATURATION COUPLING - Let saturation emerge from vector dynamics!
    // Saturation = length(abNow) evolves naturally from:
    // - Adoption (mixing), rotation (momentum), diversity, anti-consensus, vorticity
    // No imposed "s_target" logic!
    
    
    // (D) Subtle noise (position-based deterministic)
    // Stronger in stable regions, weaker where already active
    vec2 noiseVec = hash22(v_texCoord * 1000.0 + u_frameCount * 0.01) * 2.0 - 1.0;
    float noiseScale = u_noiseGain * (1.0 - abs(L_momentum * 5.0));
    dAB += noiseVec * noiseScale;
    
    // (E) Diversity kick with STATE-DEPENDENT angle (continuous gate)
    // uniformity already defined above from local mismatch.
    float uniformKick = 1.0 - smoothstep(0.02, 0.08, uniformity);
    float angle = compute_state_angle(lNew, M, length(abNow), lStddev);
    vec2 base = length(abNow) > 1.0e-5 ? normalize(abNow) : vec2(1.0, 0.0);
    vec2 kick_dir = rotate_vector(base, angle);
    dAB += kick_dir * uniformKick * u_diversityKick;
    
    // (F) Chroma Laplacian Anti-Consensus with STATE-DEPENDENT angle
    // Flat color fields develop structure in state-dependent directions
    vec2 laplacian_ab = (ab_north + ab_south + ab_east + ab_west) - 4.0 * abNow;
    float curvature = length(laplacian_ab);
    
    float flatness = 1.0 - smoothstep(0.008, 0.03, curvature);
    float antiAngle = compute_state_angle(lNew, M, length(abNow), lStddev);
    vec2 diff_ab = abNow - abMean;
    vec2 antiBase = length(diff_ab) > 1.0e-5 ? normalize(diff_ab) : vec2(1.0, 0.0);
    vec2 anti_consensus_dir = rotate_vector(antiBase, antiAngle);
    dAB += anti_consensus_dir * flatness * u_antiConsensusGain;
    
    // (G) Vorticity Color Rotation - ADDITIVE with state angle
    // L field circulation adds to state-dependent rotation
    float dLdx = (L_e - L_w) * 0.5;
    float dLdy = (L_n - L_s) * 0.5;
    float circulation = dLdx - dLdy;
    
    float circulationAbs = abs(circulation);
    float vorticityGate = smoothstep(0.005, 0.05, circulationAbs);
    float base_angle = compute_state_angle(lNew, M, length(abNow), lStddev);
    float vorticity_angle = base_angle + circulation * 3.0;  // Vorticity adds to state angle
    vec2 vortBase = length(abNow) > 1.0e-5 ? normalize(abNow) : vec2(0.0);
    vec2 vorticity_dir = rotate_vector(vortBase, vorticity_angle);
    dAB += vorticity_dir * circulationAbs * vorticityGate * u_vorticityGain;

    // Refractory damping for chroma transport (additive gate, zero-able with knob).
    float chromaRefractoryScale = max(0.0, 1.0 - u_refractoryColorDamp * refractory);
    dAB *= chromaRefractoryScale;
    
    // Apply rate limiting
    dAB *= u_coreColorRate * u_deltaTime;
    float dABMag = length(dAB);
    if (dABMag > u_coreMaxDeltaAB && dABMag > 1.0e-6) {
        dAB *= u_coreMaxDeltaAB / dABMag;
    }
    vec2 abNew = abNow + dAB;

    // Clamp saturation to [0, 1]
    float sNew = length(abNew);
    if (sNew > 1.0) abNew /= sNew;

    // === MEMORY UPDATE: Exponential moving average ===
    // Phase 3A Fix 4: Multi-frequency oscillation (spatially varying decay)
    float spatial_noise = hash22(v_texCoord * u_memoryFreqScale).x;
    float local_memory_decay = u_memoryDecay * (0.5 + spatial_noise);  // Range: 0.5x to 1.5x
    float M_new = M * (1.0 - local_memory_decay) + lNew * local_memory_decay;

    // === SOURCE INFLUENCE: REMOVED - Source is ONLY initial condition ===
    // The persistent pull was causing source luminance to always show through
    // For image stylization, source sets starting colors but CA evolves freely
    // If you want source structure, use higher initial similarity in image
    
    // === OUTPUT: Encode state as (L, a, b, M) ===
    float a_encoded = abNew.x * 0.5 + 0.5;
    float b_encoded = abNew.y * 0.5 + 0.5;
    gl_FragColor = vec4(lNew, a_encoded, b_encoded, M_new);
}
`;
