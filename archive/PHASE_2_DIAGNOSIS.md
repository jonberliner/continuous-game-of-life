# Phase 2 Behavior Analysis: Pastel RGB Swirls

**Observation**: Everything is bright, pastel, primary-ish RGB colors. No black. One big cool swirly thing. No bounded objects or contrast.

---

## 🔍 ROOT CAUSE ANALYSIS

### Why No Black?

**FIXED - Black Floor Implemented**:
```glsl
lNew = max(0.01, lNew);  // Line 275 in coreV1Shaders.js
```

This prevents `L` from reaching absolute zero. **Good** - prevents black degeneracy. **Bad** - prevents true dark colors.

**Current L range**: 0.01 to 1.0 (instead of 0.0 to 1.0)

**Impact**: Minimum luminance = 1% brightness = no truly dark colors, everything has a "glow"

---

### Why Pastel/High Saturation?

**Activity-Based Saturation Formula**:
```glsl
float s_target = 0.3 + 0.6 * abs(lNew - M);
```

**Analysis**:
- When `L` oscillates (which it ALWAYS does due to `historyOscillationGain`), `abs(L - M)` is typically 0.1 to 0.3
- This gives: `s_target = 0.3 + 0.6 * 0.2 = 0.42` (medium saturation)
- When oscillating strongly: `s_target = 0.3 + 0.6 * 0.5 = 0.60` (high saturation)

**Minimum saturation**: 0.3 (30%) when `L == M` (rare/never due to oscillation)

**Result**: Most pixels have saturation between 0.4 and 0.7 → pastel to vivid, never gray

---

### Why No Bounded Objects?

**Missing Mechanisms**:

1. **No L Birth/Death Windows** (the old SmoothLife rules)
   - Currently: L just diffuses and oscillates
   - No discrete "alive/dead" states
   - No pattern formation like gliders, blinkers, etc.

2. **No Laplacian for L** (only for chroma)
   - We have chroma Laplacian anti-consensus
   - But L dynamics don't respond to L curvature
   - No "surface tension" to create bounded blobs

3. **All Forces Are Continuous**
   - Everything flows smoothly
   - No sharp boundaries or discrete state changes
   - No "this side vs that side" dynamics

4. **Strong Oscillation Everywhere**
   - `historyOscillationGain = 0.80` is HIGH
   - Everything is always moving
   - Hard to form stable structures

---

### Why "One Big Swirly Thing"?

**Vorticity + Momentum Coupling Working TOO Well**:

```glsl
// Momentum hue coupling (line ~318)
vec2 tangent = normalize(vec2(-d.y, d.x));
float L_momentum = lNew - M;
dAB += tangent * L_momentum * u_coreGrowthHueCoupling;

// Vorticity rotation (line ~359)
float circulation = dLdx - dLdy;
vec2 ab_perp = normalize(vec2(-abNow.y, abNow.x));
dAB += ab_perp * sign(circulation) * abs(circulation) * u_vorticityGain;
```

Both mechanisms create **tangential/perpendicular** forces → **rotation**.

**Combined effect**: Colors swirl around in response to L dynamics. Since L is oscillating everywhere and vorticity is everywhere, **everything rotates**.

**Missing**: Mechanisms that create **boundaries** or **domains** where rotation direction changes

---

## 🎨 WHY PASTEL RGB SPECIFICALLY?

### The RGB Primary Tendency

**Hue rotation mechanics**:
- Initial image converted to (L, a, b) via HSV
- Colors evolve via adoption, rotation, vorticity
- But there's no **attractor** toward specific hues
- Random walk in hue space tends toward uniform distribution

**RGB/CMY as attractors**:
In ab-space:
- RGB primaries are at angles: 0°, 120°, 240° (evenly spaced)
- When colors mix and rotate, they tend to pass through primaries
- Adoption + rotation can create "orbits" around primaries

**Lack of secondary colors** (orange, purple, green):
- No mechanisms that **favor** specific hue ranges
- No palette quantization or discretization
- Everything is continuous → tends toward primary-ish hues

---

## 🛠️ WHAT'S MISSING FOR CONTRAST & STRUCTURE?

### Missing Mechanism #1: L Pattern Formation

**Need**: Something to create **distinct L regions** (bright/dark domains)

**Options**:
A. **L Laplacian with nonlinearity**
   ```glsl
   float L_laplacian = (L_n + L_s + L_e + L_w) - 4.0 * lNow;
   if (abs(L_laplacian) < 0.05) {
       // Flat L field → destabilize
       dL += sign(hash) * u_LFlatBreakup;
   }
   ```

B. **Bring back simplified birth/death**
   ```glsl
   float n = lMean;  // Neighborhood density
   float birth = smoothstep(0.3, 0.35, n) * (1.0 - lNow);
   float death = smoothstep(0.6, 0.65, n) * lNow;
   dL += (birth - death) * u_birthDeathGain;
   ```

C. **L-based repulsion at boundaries**
   ```glsl
   if (lStddev > 0.2) {
       // High L variance = at boundary
       // Push L away from mean (amplify contrast)
       dL += -sign(lNow - lMean) * u_contrastGain;
   }
   ```

---

### Missing Mechanism #2: Saturation Variance

**Need**: Mix of gray (low S) and vivid (high S) regions

**Current problem**: All cells oscillate → all have medium-high saturation

**Solutions**:
A. **Lower saturation floor**
   ```glsl
   float s_target = 0.05 + 0.7 * abs(lNew - M);  // Allow near-gray
   ```

B. **Saturation depends on L itself, not just activity**
   ```glsl
   float s_target = 0.1 + 0.5 * abs(lNew - M) + 0.3 * lNew;
   // Bright + active = vivid
   // Dark or stable = gray
   ```

C. **Spatial saturation heterogeneity**
   ```glsl
   float s_noise = hash22(v_texCoord * 10.0).x;
   float s_target = mix(0.1, 0.8, s_noise) * abs(lNew - M);
   ```

---

### Missing Mechanism #3: Domain Formation

**Need**: Regions with different "character" (rotation direction, color family, activity level)

**Current problem**: All forces are local and uniform → global homogeneity

**Solutions**:
A. **Multi-stable states**
   ```glsl
   // If L > 0.6, pull toward 0.8 (bright attractor)
   // If L < 0.4, pull toward 0.2 (dark attractor)
   if (lNow > 0.6) dL += (0.8 - lNow) * u_attractorGain;
   if (lNow < 0.4) dL += (0.2 - lNow) * u_attractorGain;
   ```

B. **Hue quantization** (palette discretization)
   ```glsl
   float hue = atan(abNow.y, abNow.x) / (2.0 * PI);
   float hue_quantized = floor(hue * u_paletteSize) / u_paletteSize;
   vec2 ab_quantized = length(abNow) * vec2(cos(hue_quantized * 2.0 * PI),
                                             sin(hue_quantized * 2.0 * PI));
   dAB += (ab_quantized - abNow) * u_palettePull;
   ```

C. **Boundary amplification**
   ```glsl
   if (lStddev > 0.15 || length(abNow - abMean) > 0.2) {
       // At boundary → strengthen differences
       dL *= 1.5;
       dAB *= 1.5;
   }
   ```

---

## 🎯 IMMEDIATE FIXES TO TEST

### Fix 1: Allow Darker Colors
```glsl
// Change from:
lNew = max(0.01, lNew);
// To:
lNew = max(0.001, lNew);  // 0.1% instead of 1%
```
**Impact**: Allows much darker colors, near-black

---

### Fix 2: Lower Saturation Floor
```glsl
// Change from:
float s_target = 0.3 + 0.6 * abs(lNew - M);
// To:
float s_target = 0.1 + 0.6 * abs(lNew - M);
```
**Impact**: Stable regions become gray, more contrast

---

### Fix 3: Add L Contrast Amplification
```glsl
// After computing dL, before clamping:
if (lStddev > 0.15) {
    // At L boundary, amplify contrast
    float contrast_force = -sign(lNow - lMean) * lStddev * u_contrastGain;
    dL += contrast_force;
}
```
**Add parameter**: `u_contrastGain` (default: 0.5, range: 0-2)

**Impact**: Creates sharper L boundaries, distinct bright/dark regions

---

### Fix 4: Reduce Global Rotation
```glsl
// Lower these gains to reduce "everything swirls"
coreGrowthHueCoupling: 0.80 → 0.40
vorticityGain: 0.30 → 0.15
```
**Impact**: Less global swirling, more localized features

---

## 📋 SUMMARY

**Why it looks pastel RGB**:
1. ✅ Black floor at 1% luminance → no dark colors
2. ✅ Saturation floor at 30% → no gray/muted colors
3. ✅ Everything oscillates → everything is "active" → high saturation
4. ✅ Strong rotation forces → continuous swirling
5. ❌ No L pattern formation → no bounded objects
6. ❌ No domain mechanisms → one big homogeneous thing
7. ❌ No contrast amplification → smooth gradients, no sharp features

**To get contrast & bounded objects, need**:
- Lower black floor (0.1% instead of 1%)
- Lower saturation floor (10% instead of 30%)
- L contrast amplification at boundaries
- Some form of L pattern formation (birth/death OR multi-stable attractors)
- Reduce global rotation (lower coupling gains)
- Possibly: hue quantization for discrete color domains

**Next steps**:
1. User confirms diagnosis
2. Decide which fixes to try
3. Implement incrementally and test
