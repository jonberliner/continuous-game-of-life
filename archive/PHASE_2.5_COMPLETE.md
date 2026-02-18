# Phase 2.5: State-Dependent Angles + Contrast Fixes - COMPLETE ✅

**Date**: 2026-02-17  
**Status**: Implemented and integrated  
**Testing**: Ready for user validation

---

## Overview

This update addresses two major issues:
1. **Degenerate spirals** from fixed perpendicular forces
2. **Pastel RGB with no contrast** from parameter choices

---

## PART 1: State-Dependent Rotation Angles

### The Problem

**All forces used fixed 90° perpendicular rotation**:
- Diversity kick: always perpendicular to color
- Anti-consensus: always perpendicular to difference
- Vorticity: always perpendicular to ab vector
- Momentum coupling: always tangent to direction

**Result**: Uniform spirals everywhere → degenerate, boring

### The Solution

**Rotation angle now varies based on cell state**:

```glsl
angle = (L - 0.5) * weight_L +           // Bright/dark chirality
        (L - M) * weight_M +             // Oscillation phase
        (saturation - 0.5) * weight_S +  // Color intensity
        L_variance * weight_V;           // Border detection
```

**Result**: Different cells rotate in different directions → heterogeneous dynamics!

### What Changed

**Added shader functions**:
```glsl
vec2 rotate_vector(vec2 v, float angle)
float compute_state_angle(L, M, saturation, L_variance)
```

**Replaced 4 perpendicular forces**:
1. **Momentum hue coupling** (line ~338): Now uses state-dependent angle
2. **Diversity kick** (line ~359): State angle replaces perpendicular
3. **Anti-consensus** (line ~368): State angle replaces perpendicular
4. **Vorticity** (line ~379): Adds to state angle (additive as requested)

### New Parameters (4 total)

| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| `angleL` | 0.5 | -2 to 2 | Bright/dark regions have different chirality |
| `angleM` | 1.0 | -2 to 2 | Oscillation phase determines rotation direction |
| `angleS` | 0.3 | -2 to 2 | Vivid colors behave differently than gray |
| `angleV` | 0.8 | 0 to 2 | Borders have tangential flow, flat regions direct |

**All in new "State Angles" group**

---

## PART 2: Contrast & Object Formation Fixes

### Fix 1: Much Darker Colors Allowed

**Changed**:
```glsl
// OLD: lNew = max(0.01, lNew);  // 1% floor
// NEW: lNew = max(0.001, lNew); // 0.1% floor
```

**Impact**: Can now have near-black colors (10x darker than before)

---

### Fix 2: Allow Gray/Muted Colors

**Changed saturation floor**:
```glsl
// OLD: s_target = 0.3 + 0.6 * L_activity;  // 30% floor
// NEW: s_target = 0.1 + 0.7 * L_activity;  // 10% floor
```

**Impact**: 
- Stable regions can become gray/muted (10% saturation)
- Active regions still vivid (up to 80% saturation)
- Much wider dynamic range

---

### Fix 3: Contrast Amplification at Boundaries

**Added new mechanism** (line ~315):
```glsl
if (lStddev > 0.15) {
    // High variance = at boundary → amplify contrast
    float contrast_force = -sign(diff) * lStddev * u_contrastGain;
    dL += contrast_force;
}
```

**New parameter**: `contrastGain` (default: 0.5, range: 0-2)

**Effect**:
- Detects L boundaries via high variance
- Pushes bright side brighter, dark side darker
- Creates sharp edges and distinct regions

---

### Fix 4: Reduced Global Rotation

**Changed default gains**:
- `coreGrowthHueCoupling`: 0.80 → 0.40 (50% reduction)
- `vorticityGain`: 0.30 → 0.15 (50% reduction)

**Impact**: Less uniform global swirling, more localized features

---

## Expected Behaviors

### State-Dependent Angles

**With angleM = 1.0 (momentum-driven)**:
- Rising L → rotates one way
- Falling L → rotates opposite way
- Creates vortex pairs and eddies
- **No uniform spirals**

**With angleL = 0.5 (luminance-driven)**:
- Bright regions → one chirality
- Dark regions → opposite chirality
- Domain walls between different L values

**With angleV = 0.8 (variance-driven)**:
- Flat regions → direct approach
- Borders → tangential flow
- Natural obstacle avoidance

### Contrast & Objects

**Darker colors**:
- Should now see near-black regions
- Much better dynamic range
- Not everything glowing

**Gray regions**:
- Stable/inactive cells become muted
- Active cells stay vivid
- Spatial heterogeneity in saturation

**Sharper boundaries**:
- Contrast amplification creates edges
- Distinct bright/dark domains
- Less smooth gradients everywhere

**Less uniform rotation**:
- Localized features instead of global swirl
- State-dependent rotation creates variety

---

## All Changes Summary

### Shader Changes (coreV1Shaders.js)
1. ✅ Added 5 new uniforms (`contrastGain`, `angleL`, `angleM`, `angleS`, `angleV`)
2. ✅ Added helper functions (`rotate_vector`, `compute_state_angle`)
3. ✅ Black floor: 0.01 → 0.001 (line 325)
4. ✅ Saturation floor: 0.3 → 0.1 (line 346)
5. ✅ Added contrast amplification mechanism (line ~315)
6. ✅ Replaced momentum coupling with state-angle (line ~338)
7. ✅ Replaced diversity kick with state-angle (line ~359)
8. ✅ Replaced anti-consensus with state-angle (line ~368)
9. ✅ Made vorticity additive to state-angle (line ~379)

### Parameter Changes (tunableParams.js)
1. ✅ Added `contrastGain` (default: 0.5)
2. ✅ Added 4 state angle weights (`angleL`, `angleM`, `angleS`, `angleV`)
3. ✅ Reduced `coreGrowthHueCoupling`: 0.80 → 0.40
4. ✅ Reduced `vorticityGain`: 0.30 → 0.15

### Engine Changes (coreV1Engine.js)
1. ✅ Pass 5 new uniforms to transition shader

**Total new parameters**: 5  
**Modified defaults**: 2  
**Total tunable params**: 23 (was 18)

---

## Testing Checklist

### What to Look For (Good Signs)

- [ ] **Variety of rotation directions** across the field
- [ ] **Vortex pairs** (adjacent regions rotating opposite ways)
- [ ] **Dark colors** appearing (near-black, not just dim)
- [ ] **Gray/muted regions** (low saturation in stable areas)
- [ ] **Sharp boundaries** between bright/dark domains
- [ ] **Localized features** instead of one global swirl
- [ ] **Domain walls** where different chiralities meet

### What to Avoid (Bad Signs)

- [ ] Still uniform spiral everywhere (angle weights too low?)
- [ ] Still all pastel (saturation gain too high?)
- [ ] Still no dark colors (contrast gain too low?)
- [ ] Chaotic noise (angle weights too high?)
- [ ] No motion at all (all gains set to zero?)

---

## Tuning Recommendations

### Conservative Start (test state angles gently)
```
angleL: 0.2
angleM: 0.5
angleS: 0.1
angleV: 0.3
contrastGain: 0.3
```

### Default (balanced)
```
angleL: 0.5
angleM: 1.0
angleS: 0.3
angleV: 0.8
contrastGain: 0.5
```

### Aggressive (maximum heterogeneity)
```
angleL: 1.0
angleM: 1.5
angleS: 0.6
angleV: 1.2
contrastGain: 1.0
```

### To emphasize specific factors

**Oscillation-phase driven** (temporal heterogeneity):
- `angleM` high (1.5), others low

**Luminance-domain driven** (spatial domains):
- `angleL` high (1.0), others low

**Saturation-dependent** (vivid vs gray behavior):
- `angleS` high (0.8), others low

**Border-topology driven** (flow around features):
- `angleV` high (1.5), others low

---

## Design Philosophy Alignment

✅ **All changes are pure emergence**:
- State angles read actual cell state (L, M, saturation, variance)
- Contrast amplification responds to spatial structure (variance)
- No hardcoded patterns or imposed directions
- Angle varies continuously with state

✅ **Non-degenerate**:
- Fixed 90° → continuous [-180°, +180°] range
- Different states → different angles → heterogeneous dynamics
- Combines 4 independent factors

✅ **Interesting**:
- Vortex pairs from momentum phase differences
- Domain walls from L gradients
- Color-dependent rotation from saturation
- Natural obstacle avoidance from variance

---

## Next Steps After Testing

If this works well, we can add:

**Phase 3**: Cross-variance modulation
- L variance gates color adoption
- Color variance drives L oscillation
- Bidirectional inter-channel feedback

**Phase 4**: Dynamic sampling radius
- Boring cells sample wide (search)
- Active cells sample narrow (focus)
- State-dependent sensing range

---

## Files Modified

1. `src/render/coreV1Shaders.js` - Core dynamics
2. `src/ui/tunableParams.js` - Parameter definitions
3. `src/core/coreV1Engine.js` - Uniform passing

**No breaking changes** - all new params have defaults, existing presets will work (with new defaults)
