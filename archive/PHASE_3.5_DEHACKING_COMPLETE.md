# Phase 3.5: De-Hacking & User Fixes Complete

**Date**: 2026-02-17  
**Philosophy**: Remove imposed logic, trust emergence  
**Status**: ✅ All 6 fixes implemented

---

## 🎯 WHAT WAS REMOVED (De-Hacking)

### 1. **Saturation Coupling** - REMOVED ENTIRELY ❌
**Before**: Complex 4-factor weighted saturation target
```glsl
// REMOVED THIS HACK:
float s_from_activity = 0.1 + 0.5 * L_activity;
float s_from_variance = 0.2 + 0.6 * L_stddev;
float s_from_isolation = 0.3 + 0.7 * (1.0 - uniformity * 10.0);
float s_from_L = 0.2 + 0.4 * abs(lNow - 0.5);
float s_target = weighted_combination(...);
dAB += s_dir * (s_target - s) * u_saturationGain;
```

**After**: Pure emergence
```glsl
// Saturation = length(abNow) evolves naturally from:
// - Adoption (mixing), rotation (momentum), diversity, anti-consensus, vorticity
// No imposed "s_target" logic!
```

**Why**: Saturation is ALREADY emergent from chroma vector field dynamics. The coupling was imposing artificial constraints.

**Parameters Removed**: 
- `saturationGain`
- `satActivityWeight`
- `satVarianceWeight`
- `satIsolationWeight`
- `satLWeight`

**Total: 5 parameters removed, ~20 shader lines removed**

---

### 2. **Darkness Recovery** - REMOVED ❌
**Before**: Special stochastic recovery mechanism
```glsl
// REMOVED THIS HACK:
if (lNew < 0.05 && lMean < 0.1) {
    float darkness = 1.0 - (lNew + lMean) * 0.5 / 0.1;
    float recovery = darkness * u_darknessRecovery * (hash22(...).x - 0.3);
    lNew = clamp(lNew + recovery * u_deltaTime, 0.001, 1.0);
}
```

**After**: Natural recovery from existing mechanisms
- Diffusion (neighbors pull up dark cells)
- Noise (random perturbation)
- Oscillation (L-M dynamics)
- Divergence (push apart when too similar)

**Why**: Recovery should emerge from CA rules, not special cases.

**Parameters Removed**:
- `darknessRecovery`

**Total: 1 parameter removed, ~6 shader lines removed**

---

## ✅ WHAT WAS FIXED (Emergence-Preserving)

### 3. **Square Artifacts** - FIXED ✅
**Before**: `floor(spatial_freq * 10.0)` created visible 20×20 pixel grid

**After**: Continuous spatial variation
```glsl
// Smooth position-dependent variation (no discretization)
float position_bias = (hash22(v_texCoord * u_spatialFrequency).x - 0.5) * u_positionAngleBias * PI;
```

**Why This Is Emergent**: Position creates local variation in rotation angle, but smoothly. No artificial grid.

---

### 4. **Pure Black Allowed** - FIXED ✅
**Before**: `lNew = max(0.001, lNew);` (floor at 0.1% brightness)

**After**: `lNew = max(0.0, lNew);` (true black allowed)

**Why This Is Emergent**: 
- Attractors naturally pull toward 0.15/0.50/0.85
- Occasional dips to 0.0 create true contrast
- Recovery from existing mechanisms (diffusion, noise, oscillation)
- No special cases needed

---

### 5. **Dynamic Thresholds** - FIXED ✅
**Before**: Hardcoded thresholds at 0.35 and 0.65

**After**: Computed from attractor positions
```glsl
float threshold_low = (u_attractor1 + u_attractor2) * 0.5;   // Default: (0.15 + 0.50) * 0.5 = 0.325
float threshold_high = (u_attractor2 + u_attractor3) * 0.5;  // Default: (0.50 + 0.85) * 0.5 = 0.675
```

**Why This Is Emergent**: Boundaries naturally occur BETWEEN stable states. Thresholds now respect the attractor landscape.

**Hysteresis also made dynamic**:
```glsl
// Resistance proportional to distance from attractor
float band_center = u_attractor2;
float band_width = threshold_high - threshold_low;
float dist_from_center = abs(lNow - band_center);
dL *= (1.0 - u_hysteresisGain * (1.0 - dist_from_center * 2.0 / band_width));
```

---

### 6. **Speed Range Increased** - FIXED ✅
**Before**: `deltaTime` range 0.01 - 1.0, default 0.20

**After**: Range 0.01 - 5.0, default 0.50 (2.5× faster)

**Why**: User reported slow evolution. Increased range allows exploration of faster dynamics.

---

### 7. **Source Blend (Post-Processing)** - ADDED ✅
**New Mechanism**: Pure post-processing blend, does NOT affect CA dynamics

**Display Shader**:
```glsl
vec3 ca_rgb = hsv2rgb(...);  // Pure CA result
vec3 src_rgb = texture2D(u_originalImage, v_texCoord).rgb;
vec3 final_rgb = mix(ca_rgb, src_rgb, u_sourceBlend);  // Blend at display
```

**Why This Is Clean**:
- CA dynamics are 100% pure (no source influence)
- Source image is visual overlay only
- 0% = pure CA, 100% = pure source, 50% = blend

**New Parameter**:
- `sourceBlend` (0.0 - 1.0, default 0.0, step 0.01)

---

## 📊 NET CHANGES

### Parameters
- **Removed**: 6 parameters (saturation weights + darknessRecovery)
- **Added**: 1 parameter (sourceBlend)
- **Net**: -5 parameters (45 → 40 total)

### Shader Lines
- **Removed**: ~26 lines (saturation coupling + darkness recovery)
- **Modified**: ~10 lines (artifacts, black floor, dynamic thresholds)
- **Added**: ~8 lines (source blend in display shader)
- **Net**: -18 shader lines (cleaner, more emergent)

### Files Modified
1. `src/render/coreV1Shaders.js`:
   - Display shader: +3 uniforms, +5 lines
   - Transition shader: -26 lines, fixed 3 bugs
2. `src/ui/tunableParams.js`:
   - Removed 5 params (Phase 3C saturation)
   - Modified 1 param (deltaTime range)
   - Added 1 param (sourceBlend)
3. `src/core/coreV1Engine.js`:
   - Updated render() to pass sourceBlend

---

## 🎨 EXPECTED BEHAVIOR CHANGES

### What Should Improve
✅ **No more square artifacts** - Smooth continuous spatial variation  
✅ **True black appears** - L can reach 0.0 for maximum contrast  
✅ **Richer saturation variety** - Emerges naturally from vector field, not imposed  
✅ **Faster evolution** - Default 2.5× faster, max 25× faster (5.0 vs 0.2)  
✅ **Dynamic boundaries** - Thresholds follow attractor positions  
✅ **Source image blending** - Clean post-processing overlay (0-100%)  

### What Should Stay the Same
✅ All other Phase 3 mechanisms (attractors, competition, angles, etc.)  
✅ Oscillatory dynamics (L-M coupling)  
✅ Anti-degeneracy forces (divergence, diversity, anti-consensus)  

---

## 🧪 TESTING CHECKLIST

Visual inspection after refresh:
- [ ] No visible grid/pixelation artifacts?
- [ ] True black regions appear (not just dark gray)?
- [ ] Rich vivid colors emerge naturally?
- [ ] Evolution feels faster/more responsive?
- [ ] Boundary sharpness at attractor thresholds?
- [ ] Source blend slider works (0% = pure CA, 100% = source)?

Parameter testing:
- [ ] `deltaTime` 0.01 → 5.0: Speed scales as expected?
- [ ] `sourceBlend` 0 → 1: Smooth transition CA → source?
- [ ] Attractor positions: Thresholds update dynamically?

---

## 🎯 DESIGN PHILOSOPHY COMPLIANCE

### ✅ Removed All Non-Emergent Hacks
1. ❌ Saturation coupling (imposed logic)
2. ❌ Darkness recovery (special case)

### ✅ Kept Only Emergent Mechanisms
1. ✅ Attractors (stable points in state space)
2. ✅ Quantization (discrete symmetries)
3. ✅ Competition (amplify differences)
4. ✅ Oscillation (second-order dynamics)
5. ✅ All vector field operations (adoption, rotation, diversity)

### ✅ Source as Post-Processing (Not CA Rule)
- CA evolves purely from local state
- Source is visual overlay only
- Clean separation of concerns

---

## 📝 REMAINING PARAMETER COUNT

**Total: 40 parameters** (was 45)

### By Group
- Luminance (L): 10
- Chroma (Color): 5 (removed saturationGain)
- Diversity: 3
- State Angles: 4
- Angle Fixes (3A): 6
- Multi-Stability (3B): 5 (removed darknessRecovery)
- ~~Saturation Mixing (3C)~~: 0 (REMOVED ENTIRELY)
- Boundaries (3D): 3
- System: 5 (added sourceBlend, modified deltaTime)

---

## 🚀 READY TO TEST

All code compiled without errors. System is now:
- **Cleaner** (fewer hacks)
- **More emergent** (trust vector field dynamics)
- **Faster** (2.5× default speed)
- **More flexible** (source blend for future image exploration)

Refresh and observe:
1. No grid artifacts ✨
2. True blacks appear ✨
3. Vivid colors emerge naturally ✨
4. Faster, more dynamic evolution ✨
5. Source blend available for experimentation ✨

**Total implementation time**: ~15 minutes  
**Philosophy**: Trust emergence, remove hacks! 🎨
