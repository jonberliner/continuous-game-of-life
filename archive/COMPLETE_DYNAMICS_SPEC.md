# CoreV1 Complete Dynamics Specification

## All Mechanisms and Equations

This document lists every mechanism in the CoreV1 system, including existing oscillatory dynamics and new diversity mechanisms. Each entry includes the formula, explanation, cell states used, and why it's emergent.

---

## Part 1: Core Oscillatory Dynamics (Already Implemented)

### 1.1 Memory Update (M Channel)

**Formula**:
```glsl
M_new = M_old * (1.0 - u_memoryDecay) + L_new * u_memoryDecay
```

**What it does**: Exponential moving average of L over time. M slowly tracks L with a lag.

**Intended effect**: Creates temporal lag necessary for oscillation. M lags behind L, providing a "restoring force" target.

**Cell states used**: 
- `M` (momentum, current step)
- `L_new` (luminance, just computed)

**Why pure**: This is simple temporal smoothing - like thermal mass in physics. The cell maintains its own running average. No external reference.

**Why interesting**: Without M, system would have no memory and would collapse to fixed point. M creates 2nd-order dynamics (oscillation).

**Default value**: `u_memoryDecay = 0.05` (slow tracking)

---

### 1.2 Diffusion Term

**Formula**:
```glsl
dL += (L_mean - L_now) * u_coreLDiffGain
```

**What it does**: Pushes L toward neighborhood average.

**Intended effect**: Spatial smoothing. Creates coherent patches rather than salt-and-pepper noise.

**Cell states used**:
- `L_now` (own luminance)
- `L_mean` (neighborhood average from convolution)

**Why pure**: This is literally diffusion - concentration gradients drive flow. Pure physics.

**Why interesting**: Alone it would homogenize everything, but combined with other terms creates spatial structure.

**Default value**: `u_coreLDiffGain = 0.5`

---

### 1.3 History Oscillation (Anti-Damping)

**Formula**:
```glsl
float deviation = L_now - M
dL += -deviation * u_historyOscillationGain
```

**What it does**: Creates negative damping. When L > M, push L down. When L < M, push L up.

**Intended effect**: Sustained oscillation around M. Prevents convergence to fixed point.

**Cell states used**:
- `L_now` (current luminance)
- `M` (momentum/memory)

**Why pure**: This is like a spring with negative damping - the cell "wants" to be different from its recent average. It's homeostatic overshoot.

**Why interesting**: This is THE key anti-degeneracy mechanism. Creates limit cycles instead of fixed points.

**Default value**: `u_historyOscillationGain = 0.8`

---

### 1.4 Non-Monotonic Conformity

**Formula**:
```glsl
float diff = L_now - L_mean
float absDiff = abs(diff)
float conformityTerm = 0.0

if (absDiff < 0.15) {
    // Too similar - diverge
    conformityTerm = -sign(diff) * u_divergenceGain
} else if (absDiff > 0.4) {
    // Too different - moderate
    conformityTerm = -sign(diff) * u_moderationGain
}
// else: sweet spot (0.15-0.4) - no pressure

dL += conformityTerm
```

**What it does**: Creates U-shaped interaction function. Weak force at small and large differences, neutral in middle.

**Intended effect**: 
- Small differences → repel (maintain diversity)
- Large differences → attract (prevent runaway)
- Medium differences → neutral (stable coexistence)

**Cell states used**:
- `L_now` (own L)
- `L_mean` (neighborhood L)

**Why pure**: This is like "social distancing" - cells want personal space but not to be isolated. Bistability is common in chemical systems (e.g., action potential thresholds).

**Why interesting**: Allows diverse states to coexist without either total uniformity or fragmentation.

**Default values**: 
- `u_divergenceGain = 0.3`
- `u_moderationGain = 0.2`

---

### 1.5 Variance Amplification

**Formula**:
```glsl
float varianceBoost = L_stddev * u_varianceAmplifyGain
float dLSign = sign(dL)
dL += varianceBoost * dLSign
```

**What it does**: In high-variance (border) regions, amplify changes in the direction they're already going.

**Intended effect**: Make borders sharper. Enhance features that already exist.

**Cell states used**:
- `L_stddev` (neighborhood variance from convolution)
- `dL` (current change direction)

**Why pure**: This is positive feedback in heterogeneous regions - like surface tension sharpening interfaces. Physical systems do this.

**Why interesting**: Creates crisp boundaries without hardcoding where they should be.

**Default value**: `u_varianceAmplifyGain = 0.5`

---

### 1.6 Flat Region Breakup

**Formula**:
```glsl
float flatness = 1.0 - L_stddev
float flatPenalty = flatness * u_flatBreakupGain
float dLSign = sign(dL)
dL += -flatPenalty * dLSign
```

**What it does**: In low-variance (flat) regions, push against current change direction.

**Intended effect**: Flat regions are unstable - small perturbations grow. Prevents static patches.

**Cell states used**:
- `L_stddev` (neighborhood variance)
- `dL` (current change)

**Why pure**: This is like a reaction-diffusion instability - homogeneous states are linearly unstable to perturbations. Turing patterns work this way.

**Why interesting**: Ensures flat boring regions spontaneously develop structure.

**Default value**: `u_flatBreakupGain = 0.2`

---

## Part 2: Core Chroma Dynamics (Already Implemented)

### 2.1 Non-Monotonic Color Adoption

**Formula**:
```glsl
vec2 d = ab_mean - ab_now
float d_mag = length(d)

float adoptStrength = 0.0
if (d_mag < 0.1) {
    adoptStrength = 0.2      // Weak - preserve diversity
} else if (d_mag < 0.4) {
    adoptStrength = 1.5      // Strong - propagate waves
} else {
    adoptStrength = 0.4      // Weak - maintain boundaries
}

vec2 adoptTerm = d * adoptStrength * u_coreAdoptGain
dAB += adoptTerm
```

**What it does**: Adoption strength peaks at medium color differences, weak at small and large differences.

**Intended effect**: 
- Small differences → weak adoption (local diversity persists)
- Medium differences → strong adoption (color waves propagate)
- Large differences → weak adoption (sharp boundaries persist)

**Cell states used**:
- `ab_now` (own chroma vector)
- `ab_mean` (neighborhood average chroma)

**Why pure**: This is like selective permeability - adopt similar colors readily, resist very different ones. Chemical systems have concentration-dependent reaction rates.

**Why interesting**: Allows waves AND boundaries to coexist without hardcoding either.

**Default value**: `u_coreAdoptGain = 1.0`

---

### 2.2 Momentum-Driven Rotation

**Formula**:
```glsl
vec2 d = ab_mean - ab_now
float d_mag = length(d)
vec2 tangent = d_mag > 1e-5 ? normalize(vec2(-d.y, d.x)) : vec2(0.0)

float L_momentum = L_new - M
vec2 rotationTerm = tangent * L_momentum * u_coreGrowthHueCoupling

dAB += rotationTerm
```

**What it does**: Rotates chroma perpendicular to color gradient, proportional to L-M momentum.

**Intended effect**: Colors flow tangentially to color boundaries. Flow continues as long as L oscillates.

**Cell states used**:
- `ab_mean` (neighborhood chroma)
- `ab_now` (own chroma)
- `L_new` (current L)
- `M` (momentum - slow tracker of L)

**Why pure**: This is like vorticity from shear flow - perpendicular motion from gradients. L oscillation drives color rotation without hardcoding rotation direction.

**Why interesting**: Creates persistent color flow that never stops (because L always oscillates around M). Direction emerges from local gradient.

**Default value**: `u_coreGrowthHueCoupling = 0.8`

---

### 2.3 Saturation Coupling to L

**Formula**:
```glsl
float s_now = length(ab_now)
float s_target = 0.3 + 0.5 * L_new
vec2 s_dir = s_now > 1e-5 ? ab_now / s_now : vec2(0.0)

vec2 saturationTerm = s_dir * (s_target - s_now) * u_saturationGain
dAB += saturationTerm
```

**What it does**: Pushes saturation toward a target that depends on L. High L → high saturation.

**Intended effect**: Bright areas are vivid, dim areas are muted. Couples color intensity to luminance.

**Cell states used**:
- `ab_now` (own chroma, provides saturation and direction)
- `L_new` (current luminance)

**Why pure**: This is like concentration-dependent color intensity - brighter regions have more "energy" for vivid colors. Physical/chemical analogy: excited states have stronger spectral lines.

**Why interesting**: Creates natural correlation between brightness and color richness without hardcoding specific hues.

**Default value**: `u_saturationGain = 0.3`

---

### 2.4 Position-Based Stochastic Noise

**Formula**:
```glsl
vec2 noiseVec = hash22(v_texCoord * 1000.0 + u_frameCount * 0.01) * 2.0 - 1.0
float L_momentum = L_new - M
float noiseScale = u_noiseGain * (1.0 - abs(L_momentum * 5.0))

vec2 noiseTerm = noiseVec * noiseScale
dAB += noiseTerm
```

**What it does**: Adds deterministic pseudorandom noise. Noise is stronger when L_momentum is small (stable regions).

**Intended effect**: Break symmetry in stable regions. Seed new activity where things are quiet.

**Cell states used**:
- `v_texCoord` (cell position - makes noise spatially varied)
- `u_frameCount` (time - makes noise temporally varied)
- `L_momentum = L_new - M` (activity level)

**Why pure**: This is like thermal fluctuations - random perturbations that are always present but only matter when deterministic forces are weak. Position-based makes it spatially structured (like molecular diffusion).

**Why interesting**: Prevents crystallization into perfect static patterns. Ensures there's always a seed for new dynamics.

**Default value**: `u_noiseGain = 0.02`

---

## Part 3: New Diversity Mechanisms (To Implement)

### 3.1 Perpendicular Diversity Kick ⭐️ **[PRIORITY 1]**

**Formula**:
```glsl
vec2 d = ab_mean - ab_now
float uniformity = length(d)
float uniformityThreshold = 0.05

if (uniformity < uniformityThreshold) {
    float strength = (uniformityThreshold - uniformity) / uniformityThreshold
    vec2 perp = length(ab_now) > 1e-5 ? 
                normalize(vec2(-ab_now.y, ab_now.x)) : 
                hash22(v_texCoord)  // fallback if ab_now is zero
    
    vec2 diversityKick = perp * strength * u_diversityKick
    dAB += diversityKick
}
```

**What it does**: When chroma is very similar to neighbors, push perpendicular to current color direction.

**Intended effect**: Uniform color patches spontaneously rotate in hue space. Creates swirls and diversity.

**Cell states used**:
- `ab_now` (own chroma)
- `ab_mean` (neighborhood chroma)

**Why pure**: This is homeostatic diversity maintenance - "if I'm too similar to neighbors, differentiate myself". Perpendicular direction is perpendicular to current state vector (90° rotation in hue space). No hardcoded target hue.

**Why interesting**: Prevents color collapse. The direction of diversification is perpendicular (creates rotation/spirals) rather than random (creates noise).

**Emergence**: 
- ✅ Reads uniformity from field
- ✅ Responds by pushing perpendicular
- ✅ No predetermined colors
- ✅ Like cells differentiating in response to similarity

**New parameter**: `u_diversityKick` (default: 0.5, range: 0-2)

---

### 3.2 Chroma Laplacian Anti-Consensus ⭐️⭐️ **[PRIORITY 2]**

**Formula**:
```glsl
// Sample 4-neighborhood in transition shader
vec2 ab_now = decode_ab(current)
vec2 ab_north = decode_ab(texture2D(u_currentState, coord + vec2(0, py)))
vec2 ab_south = decode_ab(texture2D(u_currentState, coord - vec2(0, py)))
vec2 ab_east = decode_ab(texture2D(u_currentState, coord + vec2(px, 0)))
vec2 ab_west = decode_ab(texture2D(u_currentState, coord - vec2(px, 0)))

// Discrete Laplacian
vec2 laplacian = (ab_north + ab_south + ab_east + ab_west) - 4.0 * ab_now
float curvature = length(laplacian)
float curvatureThreshold = 0.02

if (curvature < curvatureThreshold) {
    // Flat field - add anti-consensus force
    float flatness = (curvatureThreshold - curvature) / curvatureThreshold
    
    // Push perpendicular to (ab_now - ab_mean)
    vec2 diff = ab_now - ab_mean
    vec2 perp = length(diff) > 1e-5 ? 
                normalize(vec2(-diff.y, diff.x)) : 
                hash22(v_texCoord + 100.0)
    
    vec2 antiConsensus = perp * flatness * u_antiConsensusGain
    dAB += antiConsensus
}
```

**What it does**: Measures local curvature of color field. In flat (zero-curvature) regions, add perpendicular force.

**Intended effect**: Flat color fields develop internal structure. Creates boundaries and features spontaneously.

**Cell states used**:
- `ab_now` (own chroma)
- 4-neighborhood of `ab` values
- `ab_mean` (for determining perpendicular direction)

**Why pure**: Laplacian is pure spatial geometry - second derivative measures "how curved is the field here?". Flat = boring = unstable. This is like surface tension creating structure from flatness, or Turing patterns emerging from reaction-diffusion.

**Why interesting**: Directly responds to spatial geometry. Flat regions are actively destabilized. Boundaries and structure emerge wherever field is too uniform.

**Emergence**:
- ✅ Measures existing field curvature
- ✅ Responds to geometric property (flatness)
- ✅ No predetermined structure
- ✅ Like surface tension breaking up flat interfaces

**New parameter**: `u_antiConsensusGain` (default: 0.3, range: 0-1)

---

### 3.3 Gradient-Directed Exploration ⭐️⭐️ **[PRIORITY 3]**

**Formula**:
```glsl
// Compute gradient on-the-fly
vec2 ab_now = decode_ab(current)
vec2 ab_east = decode_ab(texture2D(u_currentState, coord + vec2(px, 0)))
vec2 ab_west = decode_ab(texture2D(u_currentState, coord - vec2(px, 0)))
vec2 ab_north = decode_ab(texture2D(u_currentState, coord + vec2(0, py)))
vec2 ab_south = decode_ab(texture2D(u_currentState, coord - vec2(0, py)))

vec2 gradient_x = (ab_east - ab_west) * 0.5
vec2 gradient_y = (ab_north - ab_south) * 0.5

// Total gradient vector in ab space
vec2 gradient = vec2(length(gradient_x), length(gradient_y))
float grad_mag = length(gradient)

// Activity measure
float color_activity = length(ab_now - ab_mean)
float activityThreshold = 0.1

if (color_activity < activityThreshold && grad_mag > 1e-5) {
    // Low activity - explore in gradient direction
    float exploration_strength = (activityThreshold - color_activity) / activityThreshold
    vec2 explore_dir = normalize(gradient)
    
    vec2 exploration = explore_dir * exploration_strength * u_explorationGain
    dAB += exploration
}
```

**What it does**: In low-activity regions, bias motion toward direction of color gradient.

**Intended effect**: "Flow downhill" in color space when nothing else is happening. Creates persistent directional flow.

**Cell states used**:
- `ab_now` (own chroma)
- 4-neighborhood for gradient
- `ab_mean` (for activity measure)

**Why pure**: This is chemotaxis - cells sense concentration gradient and move along it. Direction comes from actual spatial distribution of color, not hardcoded. Like bacteria following chemical gradients.

**Why interesting**: Creates anisotropic propagation - colors "remember" which way they were flowing. Flow emerges from gradient structure.

**Emergence**:
- ✅ Reads existing gradient from field
- ✅ Direction is the gradient direction (emergent)
- ✅ Only active when local dynamics are quiet
- ✅ Like diffusion/advection following concentration gradients

**New parameter**: `u_explorationGain` (default: 0.4, range: 0-2)

---

### 3.4 Rotation from Asymmetric Pull ⭐️⭐️⭐️ **[PRIORITY 4]**

**Formula**:
```glsl
// Sample neighbors with directional adoption
vec2 ab_now = decode_ab(current)

vec2 ab_north = decode_ab(texture2D(u_currentState, coord + vec2(0, py)))
vec2 ab_south = decode_ab(texture2D(u_currentState, coord - vec2(0, py)))
vec2 ab_east = decode_ab(texture2D(u_currentState, coord + vec2(px, 0)))
vec2 ab_west = decode_ab(texture2D(u_currentState, coord - vec2(px, 0)))

// Compute adoption pull from each direction (using non-monotonic function)
vec2 pull_north = (ab_north - ab_now) * adoptStrength(length(ab_north - ab_now))
vec2 pull_south = (ab_south - ab_now) * adoptStrength(length(ab_south - ab_now))
vec2 pull_east = (ab_east - ab_now) * adoptStrength(length(ab_east - ab_now))
vec2 pull_west = (ab_west - ab_now) * adoptStrength(length(ab_west - ab_now))

// Net directional imbalance
vec2 net_pull = pull_north + pull_south + pull_east + pull_west
float asymmetry = length(net_pull)

if (asymmetry > 1e-5) {
    // Rotate perpendicular to net pull direction
    vec2 rotation_dir = normalize(vec2(-net_pull.y, net_pull.x))
    vec2 asymmetricRotation = rotation_dir * asymmetry * u_rotationFromAsymmetry
    dAB += asymmetricRotation
}
```

**What it does**: When adoption pulls are imbalanced (stronger from one direction), rotate perpendicular to net pull.

**Intended effect**: Spirals and vortices emerge at boundaries where neighbor colors are asymmetric.

**Cell states used**:
- `ab_now` (own chroma)
- 4-directional neighbors

**Why pure**: This is shear-induced rotation - when forces are imbalanced, perpendicular motion emerges. Like fluid vortices forming where flow has velocity gradients. The rotation direction comes from the force imbalance, not hardcoded.

**Why interesting**: Spirals emerge spontaneously at color boundaries. Direction and speed depend on local asymmetry.

**Emergence**:
- ✅ Measures actual force imbalance from neighbors
- ✅ Rotation direction perpendicular to imbalance (physics)
- ✅ No predetermined spiral direction
- ✅ Like vortices in fluids from shear

**New parameter**: `u_rotationFromAsymmetry` (default: 0.3, range: 0-1)

---

### 3.5 Multi-Scale Momentum Divergence ⚠️ **[ADVANCED - Optional]**

**Formula**:
```glsl
// Requires mipmap generation on state texture
float M_now = current.a  // Current M from cell
float M_local = texture2D(u_currentState, coord).a  // Mip level 0
float M_regional = texture2DLod(u_currentState, coord, 2.0).a  // Mip level 2 (4x4 average)

float scale_divergence = abs(M_local - M_regional)
float divergenceThreshold = 0.05

if (scale_divergence > divergenceThreshold) {
    // Scales disagree - transitional/interesting state
    float novelty = (scale_divergence - divergenceThreshold) * u_noveltyGain
    vec2 noveltyNoise = hash22(v_texCoord + u_frameCount * 0.1) * 2.0 - 1.0
    vec2 noveltyTerm = noveltyNoise * novelty
    dAB += noveltyTerm
}
```

**What it does**: Compares cell's M with spatially-averaged M (using mipmaps). When they disagree, add noise.

**Intended effect**: Detect "interesting" transitional states where local dynamics differ from regional average. Boost diversity at these points.

**Cell states used**:
- `M` (own momentum)
- `M` averaged over 4x4 region (via mipmap)

**Why pure**: Multi-scale comparison is natural - comparing "what am I doing" with "what is my neighborhood doing on average". Like detecting local anomalies. The cell has access to both its own state and spatially-averaged state through sampling.

**Why interesting**: Creates bursting behavior and multi-scale patterns. Regions in transition get extra perturbation.

**Emergence**:
- ⚠️ Requires mipmap (extra architecture)
- ✅ Compares actual states at different scales
- ✅ No hardcoded scales (uses texture LOD)
- ✅ Like detecting when local activity differs from regional trend

**New parameter**: `u_noveltyGain` (default: 0.5, range: 0-2)

**Note**: This requires enabling mipmaps on state texture:
```javascript
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.generateMipmap(gl.TEXTURE_2D);
```

---

## Part 4: Rate Limiting and Clamping

### 4.1 L Rate Limiting

**Formula**:
```glsl
float dL_total = [sum of all L terms]
float dL_clamped = clamp(dL_total, -u_coreMaxDeltaL, u_coreMaxDeltaL)
float L_new = clamp(L_now + dL_clamped * u_coreLRate * u_deltaTime, 0.0, 1.0)
```

**What it does**: Limits maximum change in L per frame. Clamps to [0, 1].

**Intended effect**: Numerical stability. Prevents runaway oscillations.

**Default values**:
- `u_coreMaxDeltaL = 0.08`
- `u_coreLRate = 1.0`
- `u_deltaTime = 0.016` (approximately 60fps)

---

### 4.2 Chroma Rate Limiting

**Formula**:
```glsl
vec2 dAB_total = [sum of all chroma terms]
dAB_total *= u_coreColorRate * u_deltaTime

float dAB_mag = length(dAB_total)
if (dAB_mag > u_coreMaxDeltaAB) {
    dAB_total *= u_coreMaxDeltaAB / dAB_mag
}

vec2 ab_new = ab_now + dAB_total

// Clamp saturation to [0, 1]
float s_new = length(ab_new)
if (s_new > 1.0) {
    ab_new /= s_new
}
```

**What it does**: Limits maximum chroma change per frame. Clamps saturation to [0, 1].

**Intended effect**: Prevents color from "exploding" into impossible values. Keeps saturation physically meaningful.

**Default values**:
- `u_coreMaxDeltaAB = 0.08`
- `u_coreColorRate = 1.0`

---

## Part 5: Convolution (Neighborhood Sampling)

### 5.1 Neighborhood Statistics

**Formula**:
```glsl
// Golden angle spiral sampling
const int N = 12
const float GOLD = 2.39996323

float L_sum = L_center
float L_sqSum = L_center * L_center
vec2 ab_sum = ab_center
float w_sum = 1.0

for (int i = 0; i < N; i++) {
    float t = (float(i) + 0.5) / float(N)
    float r = sqrt(t) * u_radius
    float angle = float(i) * GOLD
    
    vec2 offset = vec2(cos(angle), sin(angle)) * r
    vec4 neighbor = sample(coord + offset * pixel_size)
    
    float L_n = neighbor.r
    vec2 ab_n = decode_ab(neighbor.gb)
    
    float weight = 1.0 - 0.35 * t  // Distance falloff
    
    L_sum += L_n * weight
    L_sqSum += L_n * L_n * weight
    ab_sum += ab_n * weight
    w_sum += weight
}

// Output statistics
float L_mean = L_sum / w_sum
float L_sqMean = L_sqSum / w_sum
float L_variance = max(0.0, L_sqMean - L_mean * L_mean)
float L_stddev = sqrt(L_variance)
vec2 ab_mean = ab_sum / w_sum

output = vec4(L_mean, L_stddev, encode_ab(ab_mean))
```

**What it does**: Samples 12 neighbors in golden angle spiral, computes mean and variance.

**Intended effect**: Provides neighborhood statistics for transition shader. Variance is critical for spatial heterogeneity detection.

**Why this sampling pattern**: Golden angle spiral gives good coverage without clustering. Weighted by distance (closer neighbors matter more).

**Default values**:
- `u_radius = 0.03` (fraction of image dimension)
- `N = 12` samples

---

## Summary Table

| # | Mechanism | Type | Priority | Pure? | New Param |
|---|-----------|------|----------|-------|-----------|
| 1.1 | Memory Update | Core | - | ✅ | - |
| 1.2 | Diffusion | Core | - | ✅ | - |
| 1.3 | History Oscillation | Core | - | ✅ | - |
| 1.4 | Non-Monotonic Conformity | Core | - | ✅ | - |
| 1.5 | Variance Amplification | Core | - | ✅ | - |
| 1.6 | Flat Breakup | Core | - | ✅ | - |
| 2.1 | Non-Monotonic Adoption | Core | - | ✅ | - |
| 2.2 | Momentum Rotation | Core | - | ✅ | - |
| 2.3 | Saturation Coupling | Core | - | ✅ | - |
| 2.4 | Position Noise | Core | - | ✅ | - |
| 3.1 | Perpendicular Diversity Kick | NEW | **1** | ✅ | `diversityKick` |
| 3.2 | Laplacian Anti-Consensus | NEW | **2** | ✅ | `antiConsensusGain` |
| 3.3 | Gradient Exploration | NEW | **3** | ✅ | `explorationGain` |
| 3.4 | Asymmetric Rotation | NEW | **4** | ✅ | `rotationFromAsymmetry` |
| 3.5 | Multi-Scale Divergence | NEW | Opt | ⚠️ | `noveltyGain` |

**All mechanisms pass the emergence test.** ✅

---

## Implementation Order

### Session 1: Quick Wins (15 mins)
1. Increase existing gains (tune defaults)
2. Add perpendicular diversity kick (3.1)

### Session 2: Spatial Geometry (30 mins)
3. Add Laplacian anti-consensus (3.2)
4. Add gradient exploration (3.3)

### Session 3: Advanced (if needed)
5. Add asymmetric rotation (3.4)
6. Experiment with multi-scale (3.5)

---

## New Parameters Summary

```javascript
// To add to tunableParams.js
{ key: 'diversityKick', default: 0.5, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core V1 Diversity', label: 'Diversity Kick',
  hint: 'Perpendicular push in uniform color regions' },

{ key: 'antiConsensusGain', default: 0.3, min: 0.0, max: 1.0, step: 0.05,
  group: 'Core V1 Diversity', label: 'Anti-Consensus',
  hint: 'Force against flat color fields (Laplacian response)' },

{ key: 'explorationGain', default: 0.4, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core V1 Diversity', label: 'Exploration',
  hint: 'Gradient-directed flow in low-activity regions' },

{ key: 'rotationFromAsymmetry', default: 0.3, min: 0.0, max: 1.0, step: 0.05,
  group: 'Core V1 Diversity', label: 'Asymmetric Rotation',
  hint: 'Spiral formation from imbalanced neighbor pulls' },

{ key: 'noveltyGain', default: 0.5, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core V1 Diversity', label: 'Novelty',
  hint: 'Multi-scale momentum divergence response' },
```

Also strengthen existing defaults:
```javascript
{ key: 'divergenceGain', default: 0.6 },  // was 0.3
{ key: 'flatBreakupGain', default: 0.5 }, // was 0.2
{ key: 'noiseGain', default: 0.05 },      // was 0.02
```

Ready to implement!
