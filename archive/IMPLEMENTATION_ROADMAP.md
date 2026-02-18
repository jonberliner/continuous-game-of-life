# CoreV1 Complete Implementation Plan - Updated with Exotic Mechanisms

## Overview

This document integrates all mechanisms - existing, basic diversity, and exotic - with a clear incremental implementation plan. Each mechanism is categorized by priority and dependencies.

---

## Part 1: Current State (Already Implemented)

### Core Oscillatory Dynamics ✅
1. Memory Update (M = EMA of L)
2. Diffusion Term
3. History Oscillation (anti-damping)
4. Non-Monotonic Conformity
5. Variance Amplification
6. Flat Region Breakup

### Core Chroma Dynamics ✅
7. Non-Monotonic Color Adoption
8. Momentum-Driven Rotation
9. Saturation Coupling (needs fix - see below)
10. Position-Based Noise

### Convolution ✅
- Golden angle spiral sampling (12 samples)
- Outputs: (L_mean, L_stddev, a_mean, b_mean)

**Current Problem**: Colors still diffuse to uniformity despite oscillatory L working.

---

## Part 2: Implementation Roadmap

### Phase 1: Critical Fixes & Basic Diversity (30 mins) ⚡️

**Goal**: Fix degeneracies and add simplest anti-uniformity mechanisms

#### 1.1 Fix Saturation Coupling (CRITICAL)
**Current (degenerate)**:
```glsl
float s_target = 0.3 + 0.5 * lNew;  // Positive feedback!
```

**New (non-degenerate)**:
```glsl
float L_activity = abs(lNew - M);
float s_target = 0.3 + 0.6 * L_activity;
```

**Why**: Couples saturation to activity (oscillation), not L value itself. Prevents runaway.

**File**: `src/render/coreV1Shaders.js` line ~276-281
**Param**: No new param, just fix formula

---

#### 1.2 Strengthen Non-Monotonic Adoption (CRITICAL)
**Current**:
```glsl
if (dMag < 0.1) adoptStrength = 0.2;  // Weak but still attractive
```

**New (truly non-monotonic)**:
```glsl
if (dMag < 0.05) {
    adoptStrength = -0.3;  // REPEL when very similar
} else if (dMag < 0.1) {
    adoptStrength = 0.0;   // Neutral zone
} else if (dMag < 0.4) {
    adoptStrength = 1.5;   // Strong adoption (waves)
} else {
    adoptStrength = 0.4;   // Weak adoption (boundaries)
}
```

**Why**: Adds actual repulsion at small distances. Prevents total uniformity.

**File**: `src/render/coreV1Shaders.js` line ~260-267
**Param**: No new param

---

#### 1.3 Increase Existing Anti-Degeneracy Gains
**Update defaults** in `src/ui/tunableParams.js`:
```javascript
{ key: 'divergenceGain', default: 0.6 },        // was 0.3
{ key: 'flatBreakupGain', default: 0.5 },      // was 0.2
{ key: 'noiseGain', default: 0.05 },           // was 0.02
```

**Why**: Stronger existing mechanisms may solve problem before adding complexity.

**File**: `src/ui/tunableParams.js`

---

#### 1.4 Add Perpendicular Diversity Kick (NEW)
**Formula**:
```glsl
// After computing dAB from all existing terms
vec2 d = abMean - abNow;
float uniformity = length(d);

if (uniformity < 0.05) {
    float strength = (0.05 - uniformity) / 0.05;
    vec2 perp = length(abNow) > 1e-5 ? 
                normalize(vec2(-abNow.y, abNow.x)) : 
                vec2(hash22(v_texCoord).x - 0.5, hash22(v_texCoord).y - 0.5);
    
    dAB += perp * strength * u_diversityKick;
}
```

**Why**: Uniform regions rotate in hue space. Direction is perpendicular → creates swirls.

**File**: `src/render/coreV1Shaders.js` - add after line ~287 (after existing dAB computation)
**New Param**: 
```javascript
{ key: 'diversityKick', default: 0.5, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core V1 Diversity', label: 'Diversity Kick',
  hint: 'Perpendicular push when colors are too uniform' }
```

---

**Phase 1 Test Criteria**:
- [ ] Colors don't collapse to single hue after 500 frames
- [ ] Stddev(H) > 0.1 sustained
- [ ] Visual: see color swirls, not solid patches

**Estimated time**: 30 minutes
**Risk**: Low - simple formula changes and one new term

---

### Phase 2: Spatial Geometry Mechanisms (45 mins) 🌊

**Goal**: Add mechanisms that respond to spatial field structure

#### 2.1 Chroma Laplacian Anti-Consensus (NEW)
**Formula**:
```glsl
// In transition shader, sample 4-neighbors
vec2 px = 1.0 / u_resolution;
vec2 ab_north = decode_ab(texture2D(u_currentState, v_texCoord + vec2(0, px.y)).gb);
vec2 ab_south = decode_ab(texture2D(u_currentState, v_texCoord - vec2(0, px.y)).gb);
vec2 ab_east = decode_ab(texture2D(u_currentState, v_texCoord + vec2(px.x, 0)).gb);
vec2 ab_west = decode_ab(texture2D(u_currentState, v_texCoord - vec2(px.x, 0)).gb);

// Discrete Laplacian (measures flatness)
vec2 laplacian = (ab_north + ab_south + ab_east + ab_west) - 4.0 * abNow;
float curvature = length(laplacian);

if (curvature < 0.02) {
    float flatness = (0.02 - curvature) / 0.02;
    vec2 diff = abNow - abMean;
    vec2 perp = length(diff) > 1e-5 ? 
                normalize(vec2(-diff.y, diff.x)) : 
                hash22(v_texCoord + 100.0) - 0.5;
    
    dAB += perp * flatness * u_antiConsensusGain;
}
```

**Why**: Flat color fields (zero curvature) are unstable. Forces structure to emerge.

**File**: `src/render/coreV1Shaders.js` - add after diversity kick
**New Param**:
```javascript
{ key: 'antiConsensusGain', default: 0.3, min: 0.0, max: 1.0, step: 0.05,
  group: 'Core V1 Diversity', label: 'Anti-Consensus',
  hint: 'Force against flat color fields (Laplacian response)' }
```

---

#### 2.2 Vorticity Color Rotation (NEW - EXOTIC!)
**Formula**:
```glsl
// Compute circulation in L field
float L_e = texture2D(u_currentState, v_texCoord + vec2(px.x, 0)).r;
float L_w = texture2D(u_currentState, v_texCoord - vec2(px.x, 0)).r;
float L_n = texture2D(u_currentState, v_texCoord + vec2(0, px.y)).r;
float L_s = texture2D(u_currentState, v_texCoord - vec2(0, px.y)).r;

float dLdx = (L_e - L_w) * 0.5;
float dLdy = (L_n - L_s) * 0.5;
float circulation = dLdx - dLdy;  // Asymmetry measure

// Rotate colors based on L vorticity
vec2 ab_perp = length(abNow) > 1e-5 ? 
               normalize(vec2(-abNow.y, abNow.x)) : 
               vec2(0.0);
float rot_sign = sign(circulation);
dAB += ab_perp * rot_sign * abs(circulation) * u_vorticityGain;
```

**Why**: L field curl drives color spirals. Pure physics - vortices rotate!

**File**: `src/render/coreV1Shaders.js` - add after Laplacian
**New Param**:
```javascript
{ key: 'vorticityGain', default: 0.5, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core V1 Diversity', label: 'Vorticity Coupling',
  hint: 'L field circulation rotates colors (creates spirals)' }
```

---

**Phase 2 Test Criteria**:
- [ ] Flat regions develop internal structure
- [ ] Spirals visible at L boundaries
- [ ] Visual: turbulent mixing, vortices

**Estimated time**: 45 minutes
**Risk**: Medium - adds 4-8 texture samples per pixel

---

### Phase 3: Cross-Channel Coupling (30 mins) 🔗

**Goal**: Let L and chroma dynamics modulate each other

#### 3.1 Compute Chroma Variance (Infrastructure)
**Add to convolution shader**:

Currently outputs: `(L_mean, L_stddev, a_mean, b_mean)`

Need to also compute: `ab_stddev`

**Problem**: Only 4 RGBA channels. Already full.

**Solution**: Pack ab_mean as polar (magnitude, angle) instead of cartesian (x,y):
```glsl
// In convolution shader output
vec2 abMean = abSum / wSum;
float abMean_mag = length(abMean);
float abMean_angle = atan(abMean.y, abMean.x);

// Also compute variance
vec2 abVariance = vec2(0.0);
for (each sample) {
    vec2 diff = ab_sample - abMean;
    abVariance += diff * diff * weight;
}
vec2 abVar = abVariance / wSum;
float ab_stddev = length(abVar);

// Pack: (L_mean, L_stddev, abMean_mag + ab_stddev, abMean_angle)
gl_FragColor = vec4(
    L_mean,
    L_stddev,
    abMean_mag + ab_stddev * 0.1,  // Pack both in one channel (hacky but works)
    abMean_angle / (2.0 * PI) + 0.5  // Encode angle to [0,1]
);
```

**Unpack in transition shader**:
```glsl
float L_mean = conv.r;
float L_stddev = conv.g;
float packed = conv.b;
float abMean_mag = floor(packed);  // Integer part
float ab_stddev = fract(packed) * 10.0;  // Fractional part * 10
float abMean_angle = (conv.a - 0.5) * 2.0 * PI;
vec2 abMean = vec2(cos(abMean_angle), sin(abMean_angle)) * abMean_mag;
```

**Alternative (cleaner)**: Use a second convolution pass or auxiliary texture.

**File**: `src/render/coreV1Shaders.js` - convolution and transition shaders

---

#### 3.2 Cross-Variance Modulation (NEW)
**Formula**:
```glsl
// L variance gates color adoption
float adoption_gate = 1.0 / (1.0 + L_stddev * u_LVarColorDamp);
adoptStrength *= adoption_gate;

// Color variance drives L oscillation
float oscillation_boost = 1.0 + ab_stddev * u_abVarLBoost;
// Apply to oscillation term
float deviation = lNow - M;
dL += -deviation * u_historyOscillationGain * oscillation_boost;
```

**Why**: Bidirectional coupling. L structure affects color flow. Color diversity drives L activity.

**File**: `src/render/coreV1Shaders.js` - apply in transition shader
**New Params**:
```javascript
{ key: 'LVarColorDamp', default: 2.0, min: 0.0, max: 5.0, step: 0.5,
  group: 'Core V1 Exotic', label: 'L Var → Color Damping',
  hint: 'High L variance reduces color adoption (maintains boundaries)' },

{ key: 'abVarLBoost', default: 1.5, min: 0.0, max: 4.0, step: 0.5,
  group: 'Core V1 Exotic', label: 'Color Var → L Boost',
  hint: 'High color variance increases L oscillation' }
```

---

**Phase 3 Test Criteria**:
- [ ] Color boundaries align with or perpendicular to L boundaries
- [ ] Colorful regions more active than gray regions
- [ ] Visual: feedback loop between L and color

**Estimated time**: 30 minutes
**Risk**: Medium - requires convolution shader changes

---

### Phase 4: Advanced Exotic (60 mins) 🚀

**Goal**: State-dependent sensing and other wild mechanisms

#### 4.1 Dynamic Sampling Radius (EXOTIC)
**Formula** (inverse to prevent degeneracy):
```glsl
// Compute activity
float hue_velocity = estimate_hue_rotation_rate();  // from |abNow - abMean|
float L_volatility = abs(lNew - M);
float activity = hue_velocity * 2.0 + L_volatility;

// INVERSE: Boring cells sample widely, active cells focus locally
float radius_multiplier = 2.0 / (1.0 + activity * u_activityRadiusScale);

// Must pass to convolution shader somehow
// Option: store in a 1x1 texture per cell?
// Or: make convolution shader compute this before sampling
```

**Implementation challenge**: Convolution shader runs first, but needs per-cell activity to determine radius. Requires:
1. Pre-pass to compute activity
2. Store in texture
3. Convolution reads activity texture

**File**: Requires architecture change - pre-pass before convolution
**New Param**:
```javascript
{ key: 'activityRadiusScale', default: 2.0, min: 0.0, max: 10.0, step: 0.5,
  group: 'Core V1 Exotic', label: 'Activity → Radius Scale',
  hint: 'Boring cells search widely, active cells focus locally' }
```

---

#### 4.2 Gradient-Directed Exploration (NEW)
**Formula**:
```glsl
// Compute chroma gradient on-the-fly
vec2 grad_x = (ab_east - ab_west) * 0.5;
vec2 grad_y = (ab_north - ab_south) * 0.5;
vec2 gradient = vec2(length(grad_x), length(grad_y));
float grad_mag = length(gradient);

float color_activity = length(abNow - abMean);

if (color_activity < 0.1 && grad_mag > 1e-5) {
    float exploration_strength = (0.1 - color_activity) / 0.1;
    vec2 explore_dir = normalize(gradient);
    dAB += explore_dir * exploration_strength * u_explorationGain;
}
```

**Why**: Low-activity regions flow along gradients. Creates directional propagation.

**File**: `src/render/coreV1Shaders.js` - add after Phase 2 mechanisms
**New Param**:
```javascript
{ key: 'explorationGain', default: 0.4, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core V1 Exotic', label: 'Gradient Exploration',
  hint: 'Low-activity cells follow color gradients' }
```

---

**Phase 4 Test Criteria**:
- [ ] Boring regions "wake up" by sampling far
- [ ] Flow patterns emerge along gradients
- [ ] Visual: directional waves, anisotropic propagation

**Estimated time**: 60 minutes
**Risk**: High - dynamic radius requires architecture change

---

## Implementation Summary

### Total New Mechanisms: 8

| Phase | Mechanism | Type | New Param? | Risk |
|-------|-----------|------|------------|------|
| 1.1 | Fix saturation | Fix | No | Low |
| 1.2 | Fix adoption | Fix | No | Low |
| 1.3 | Increase gains | Tune | No | Low |
| 1.4 | Diversity kick | NEW | Yes | Low |
| 2.1 | Laplacian | NEW | Yes | Med |
| 2.2 | Vorticity | NEW | Yes | Med |
| 3.1 | Chroma variance | Infra | No | Med |
| 3.2 | Cross-modulation | NEW | Yes (2) | Med |
| 4.1 | Dynamic radius | EXOTIC | Yes | High |
| 4.2 | Gradient explore | NEW | Yes | Med |

### Total Time Estimate: ~2.5 hours

### New Parameters: 9
```javascript
// Phase 1
diversityKick: 0.5

// Phase 2
antiConsensusGain: 0.3
vorticityGain: 0.5

// Phase 3
LVarColorDamp: 2.0
abVarLBoost: 1.5

// Phase 4
activityRadiusScale: 2.0
explorationGain: 0.4
```

Plus 3 updated defaults:
```javascript
divergenceGain: 0.6  // was 0.3
flatBreakupGain: 0.5  // was 0.2
noiseGain: 0.05  // was 0.02
```

---

## Testing Protocol

### After Each Phase:

1. **Run simulation for 500 frames**
2. **Measure**:
   - Color variance: `stddev(H)` should be > 0.1
   - Activity: `mean(|dL|)` should be > 0.001
   - Spatial variance: `stddev(L)` should be > 0.05
3. **Visual check**:
   - No solid color patches
   - Continuous motion
   - Structure at multiple scales

### Rollback Plan:
- Git commit after each working phase
- If phase fails, revert and document why
- Try alternative approach or skip to next phase

---

## Next Steps

**Start with Phase 1** (30 mins):
1. Fix saturation coupling
2. Fix adoption to actually repel at small distances
3. Increase existing gains
4. Add diversity kick

This should solve the uniformity problem with minimal risk.

**Then assess**: Do we need Phase 2+, or is Phase 1 enough?

Ready to begin implementation?
