# Phase 3 Diagnostic Analysis

**User Reports**:
1. Square pixelated artifacts (1000×1000 grid)
2. Uniform dark luminance (not rich high-saturation colors)
3. No black/near-black, no discrete structures
4. Slow evolution
5. Question: Ready for source image coupling?

---

## 🔍 ROOT CAUSE ANALYSIS

### 1. Square Pixelated Artifacts

**Location**: `compute_state_angle()` line 219-220
```glsl
vec2 spatial_freq = v_texCoord * u_spatialFrequency;
float position_bias = (hash22(floor(spatial_freq * 10.0)).x - 0.5) * u_positionAngleBias * PI;
```

**Problem**: `floor(spatial_freq * 10.0)` creates a **discrete grid**
- At `u_spatialFrequency = 5.0`, we get `5 * 10 = 50` grid divisions
- On 1000×1000 canvas: **20×20 pixel squares**
- Each square has identical angle bias → visible grid pattern

**CA Dynamics Question**: 
*"How should position-dependent variation work to break synchronization WITHOUT creating visible artifacts?"*

**Options**:
1. **Continuous spatial variation**: Use raw `v_texCoord` directly (no `floor`)
2. **Finer grid**: Remove the `* 10.0` multiplier
3. **Smooth interpolation**: Sample 4 grid corners and interpolate
4. **Fractal noise**: Multi-octave Perlin/Simplex noise

**Recommended Fix** (Option 2 - simplest, most emergent):
```glsl
float position_bias = (hash22(v_texCoord * u_spatialFrequency).x - 0.5) * u_positionAngleBias * PI;
```
This creates continuous position-dependent variation at the scale of `spatialFrequency`.

---

### 2. Uniform Dark Luminance (No Rich Saturation)

**Suspected Issues**:

#### A. Attractors Might Be Too Strong or Mispulling
Current formula (lines 353-357):
```glsl
float dist1 = abs(lNow - u_attractor1);  // 0.15 (dark)
float pull1 = smoothstep(0.3, 0.05, dist1) * (u_attractor1 - lNow);
```

**Analysis**:
- `smoothstep(0.3, 0.05, dist)` = 1.0 when `dist < 0.05`, 0.0 when `dist > 0.3`
- If all 3 attractors are active, might create competing pulls
- Dark attractor (0.15) might dominate if L starts low

**Diagnostic Check**: Are cells clustering around 0.15? Or wandering?

#### B. Saturation Model Might Not Create Enough Vividness
Current 4 factors (lines 459-471):
```glsl
float s_activity   = 0.1 + 0.5 * abs(L - M);      // Max 0.6
float s_variance   = 0.2 + 0.6 * L_stddev;        // Max 0.8
float s_isolation  = 0.3 + 0.7 * (1.0 - uniformity * 10.0);  // Max 1.0 (if isolated)
float s_extremes   = 0.2 + 0.4 * abs(L - 0.5);    // Max 0.6
```

**Problem**: 
- If `L ≈ 0.15` (dark attractor), then `s_extremes = 0.2 + 0.4 * 0.35 = 0.34` (muted)
- If `L` is stable (near attractor), then `abs(L - M) ≈ 0` → `s_activity = 0.1` (gray!)
- If `L_stddev` is low (uniform dark), then `s_variance = 0.2` (gray!)
- Only `s_isolation` can be high

**CA Dynamics Question**:
*"Should attractor states be VIVID (colorful stable structures) or MUTED (gray stable structures)?"*

**Recommended**: Attractors should be VIVID! Dark/bright doesn't mean gray.

**Fix Option A**: Reverse saturation coupling - stable = vivid, unstable = gray
```glsl
float s_activity = 0.8 - 0.5 * abs(L - M);  // STABLE → vivid (0.8), oscillating → gray (0.3)
```

**Fix Option B**: Add attractor proximity as 5th saturation factor
```glsl
// Near any attractor → vivid (defines "identity")
float attractor_proximity = min(min(dist1, dist2), dist3);
float s_attractor = 0.9 - 3.0 * attractor_proximity;  // Vivid when within 0.3 of attractor
```

**Fix Option C**: Raise saturation floors across the board
```glsl
float s_activity   = 0.3 + 0.6 * abs(L - M);      // Floor 0.3 → 0.9
float s_variance   = 0.4 + 0.5 * L_stddev;        // Floor 0.4 → 0.9
float s_isolation  = 0.5 + 0.5 * (1.0 - uniformity * 10.0);
float s_extremes   = 0.4 + 0.5 * abs(L - 0.5);    // Floor 0.4 → 0.9
```

---

### 3. No Black/Near-Black, No Discrete Structures

#### A. Black Floor Too High
Current: `lNew = max(0.001, lNew);` (line 391)

**Problem**: 0.1% brightness is still visible as dark gray, not black.

**CA Dynamics Question**:
*"When should true black (L=0) be allowed?"*

**Options**:
1. **Pure black allowed**: Remove floor entirely, rely on darkness recovery
2. **Conditional floor**: Only apply floor if neighborhood is also dark
3. **Lower floor**: `0.0001` (0.01% brightness)
4. **Zero floor with recovery**: Allow `L=0`, but darkness recovery brings back

**Recommended**: Option 4 - true black with recovery
```glsl
lNew = max(0.0, lNew);  // Allow pure black

// Darkness Recovery (already exists, but might need stronger)
if (lNew < 0.05 && lMean < 0.1) {
    float darkness = 1.0 - (lNew + lMean) * 0.5 / 0.1;
    float recovery = darkness * u_darknessRecovery * (hash22(v_texCoord + u_frameCount * 0.01).x - 0.3);
    lNew = clamp(lNew + recovery * u_deltaTime, 0.0, 1.0);
}
```

#### B. Discrete Structures Not Forming

**Boundary Sharpening** (lines 358-380) might not be strong enough.

Current thresholds: `0.35` and `0.65`

**Problem**: These thresholds are arbitrary. They should emerge from attractor positions!

**CA Dynamics Fix**: Thresholds should be BETWEEN attractors
```glsl
// Boundaries are midpoints between attractors
float threshold1 = (u_attractor1 + u_attractor2) * 0.5;  // Between dark & mid
float threshold2 = (u_attractor2 + u_attractor3) * 0.5;  // Between mid & bright

// Step amplification when crossing attractor boundaries
if (lNow < threshold1 && dL < 0.0) {
    dL *= (1.0 + u_boundaryAmplify * (threshold1 - lNow) * 5.0);
}
if (lNow > threshold2 && dL > 0.0) {
    dL *= (1.0 + u_boundaryAmplify * (lNow - threshold2) * 5.0);
}

// Hysteresis in EACH band
if (lNow > threshold1 && lNow < threshold2) {
    // In middle band
    float band_center = u_attractor2;
    dL *= (1.0 - u_hysteresisGain * (1.0 - abs(lNow - band_center) * 2.0 / (threshold2 - threshold1)));
}
```

#### C. Competition Not Creating Isolated Structures

Current competition (line 377):
```glsl
if (abs(L - L_mean) > 0.15) {
    dL += sign(L - L_mean) * (abs(L - L_mean) - 0.15) * u_competitionGain;
}
```

**Problem**: Competition only amplifies existing differences. Doesn't CREATE boundaries.

**CA Dynamics Question**:
*"What rule creates LOCAL separated structures from a uniform field?"*

**Answer**: **Lateral Inhibition** (nearby cells suppress each other)

**New Mechanism Needed**: 
```glsl
// Sample farther neighbors (2x radius)
vec2 px = 2.0 / u_resolution;
float L_far_n = texture2D(u_currentState, v_texCoord + vec2(0, px.y)).r;
float L_far_s = texture2D(u_currentState, v_texCoord - vec2(0, px.y)).r;
float L_far_e = texture2D(u_currentState, v_texCoord + vec2(px.x, 0)).r;
float L_far_w = texture2D(u_currentState, v_texCoord - vec2(px.x, 0)).r;
float L_far_mean = (L_far_n + L_far_s + L_far_e + L_far_w) * 0.25;

// Lateral inhibition: if far neighbors are bright, suppress self
float inhibition = (L_far_mean - lMean) * u_lateralInhibition;
dL -= inhibition;  // High far neighbors → suppress center
```

This creates **center-surround antagonism** → isolated peaks/valleys.

---

### 4. Slow Evolution

**Current**: `deltaTime = 0.20` with range `0.01 - 1.0`

**Analysis**: At 60 FPS, effective timestep = `0.20 / 60 ≈ 0.003` per frame.

**Recommendations**:
- Increase default: `0.50` (2.5× faster)
- Increase max: `2.0` or `5.0` (allow much faster exploration)
- Keep as slider (good for tuning different phases)

**Alternative**: Add a "simulation speed multiplier" that affects ALL rates globally
```glsl
uniform float u_globalSpeedMultiplier;  // Default 1.0, range 0.1 - 10.0

// Apply to all dynamics
dL *= u_globalSpeedMultiplier;
dAB *= u_globalSpeedMultiplier;
```

This is cleaner than adjusting `deltaTime` (which affects physics differently).

---

### 5. Source Image Coupling

**Current State**: Source image influence was REMOVED (Phase 1 fix)

**Two Design Philosophies**:

#### Philosophy A: Source as Initial Condition Only
- Source sets `t=0` state
- Evolution is purely from CA rules
- Image "forgotten" after evolution
- **Pro**: Pure CA, no external bias
- **Con**: Eventually uniform/degenerate regardless of source

#### Philosophy B: Source as Continuous Attractor
- Source creates a "potential field"
- CA dynamics are MODIFIED by source proximity
- **Pro**: Structures persist that reflect source
- **Con**: Less pure CA, external constraint

**Recommendation for Your System**: **Philosophy B - But Weak**

**Mechanism**: Source creates LOCAL attractors at pixel level
```glsl
vec3 src_rgb = texture2D(u_originalImage, v_texCoord).rgb;
float src_L = lum(src_rgb);
vec2 src_ab = rgb2ab(src_rgb);

// Source pull (weak attractor)
float dist_to_source = abs(lNew - src_L);
float source_pull = smoothstep(0.5, 0.1, dist_to_source) * (src_L - lNew);
dL += source_pull * u_sourceAttractorGain;  // New param, default 0.1 (weak)

// Chroma source pull
vec2 ab_dist_to_source = src_ab - abNow;
dAB += ab_dist_to_source * u_sourceColorAttractorGain;  // Default 0.05 (very weak)
```

**Key**: Source is ONE MORE ATTRACTOR (like the 3 L attractors), not a hard constraint.

**Parameters**:
- `sourceAttractorGain` (0.0 - 1.0, default 0.1): "How much does source structure persist?"
- `sourceColorAttractorGain` (0.0 - 0.5, default 0.05): "How much do source colors persist?"

With weak gains, source creates "seeds" but CA dynamics can overwrite.

---

## 🔧 PROPOSED FIXES (Ordered by Impact)

### Fix 1: Square Artifacts (CRITICAL)
**File**: `src/render/coreV1Shaders.js`, line 220  
**Change**: Remove `floor()` and `* 10.0`
```glsl
float position_bias = (hash22(v_texCoord * u_spatialFrequency).x - 0.5) * u_positionAngleBias * PI;
```

### Fix 2: Rich Saturation (HIGH IMPACT)
**Option A** (Recommended): Attractor proximity drives vividness
```glsl
// Add 5th saturation factor
float dist_to_nearest = min(min(dist1, dist2), dist3);
float s_attractor = clamp(0.9 - 3.0 * dist_to_nearest, 0.0, 1.0);

// Add to weighted combination with high weight
s_target = (s_activity * w1 + s_variance * w2 + s_isolation * w3 + s_extremes * w4 + s_attractor * 2.0) 
           / (w1 + w2 + w3 + w4 + 2.0);
```
**New Parameter**: None (uses existing attractor distances)

**Option B**: Raise all saturation floors (simpler, less emergent)

### Fix 3: True Black + Discrete Structures (HIGH IMPACT)
**Part A**: Remove black floor
```glsl
lNew = max(0.0, lNew);  // Allow pure black
```

**Part B**: Dynamic thresholds from attractors
```glsl
float threshold1 = (u_attractor1 + u_attractor2) * 0.5;
float threshold2 = (u_attractor2 + u_attractor3) * 0.5;
// Use these instead of hardcoded 0.35/0.65
```

**Part C**: Add lateral inhibition (NEW MECHANISM)
```glsl
// Far neighbor sampling + inhibition
dL -= (L_far_mean - lMean) * u_lateralInhibition;
```
**New Parameter**: `lateralInhibition` (0.0 - 1.0, default 0.3)

### Fix 4: Faster Evolution (EASY)
**File**: `src/ui/tunableParams.js`
```javascript
{ key: 'deltaTime', default: 0.50, min: 0.01, max: 5.0, step: 0.05, ... }
```

### Fix 5: Source Image Coupling (OPTIONAL)
Add weak source attractors with 2 new parameters.

---

## 🎯 IMPLEMENTATION PRIORITY

### Must-Do (Breaks Current Visuals)
1. **Fix 1**: Square artifacts (1 line change)

### High-Impact (Addresses User Concerns)
2. **Fix 2**: Saturation vividness (5 lines + 1 weight)
3. **Fix 3A**: Allow true black (1 line)
4. **Fix 3B**: Dynamic thresholds (10 lines)
5. **Fix 4**: Speed range (1 line)

### New Mechanism (Adds Functionality)
6. **Fix 3C**: Lateral inhibition (15 lines + 1 param)
7. **Fix 5**: Source attractors (10 lines + 2 params)

---

## 📋 TESTING CHECKLIST

After implementing fixes:
- [ ] No visible grid artifacts?
- [ ] Vivid colors in stable regions?
- [ ] True black appears?
- [ ] Small isolated bright/dark spots form?
- [ ] Evolution speed feels responsive?
- [ ] (If source coupling) Source structure influences but doesn't dominate?

---

## 🤔 DESIGN QUESTIONS FOR USER

Before implementing:

1. **Saturation Philosophy**: Should attractor states be vivid or muted?
   - Option A: Near attractors = vivid (defines identity)
   - Option B: Activity = vivid (oscillating regions are colorful)
   - Current system uses Option B, but might explain uniform dullness

2. **Black Philosophy**: Should pure black be allowed?
   - Current: No (floor at 0.001)
   - Proposed: Yes (floor at 0.0, but with recovery)

3. **Structure Scale**: How small should discrete structures be?
   - Lateral inhibition creates features at ~2× convolution radius
   - Currently radius ≈ 30 pixels → features ≈ 60 pixels
   - Is this the right scale?

4. **Source Coupling**: How persistent should source image be?
   - Option A: None (pure CA from initial condition)
   - Option B: Weak attractor (structure influences but fades)
   - Option C: Strong attractor (structure persists)

5. **Speed**: What should default `deltaTime` be?
   - Current: 0.20 (quite slow)
   - Proposed: 0.50 (2.5× faster)
   - Or add global speed multiplier?
