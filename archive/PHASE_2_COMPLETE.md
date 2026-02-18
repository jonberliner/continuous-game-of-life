# Phase 2: Spatial Geometry Mechanisms - COMPLETE ✅

**Date**: 2026-02-17  
**Status**: Implemented and integrated  
**Testing**: Ready for user validation

---

## Overview

Phase 2 adds mechanisms that respond to the **spatial geometry** of state fields, creating structure from flatness and spirals from circulation.

---

## What Was Added

### 1. Chroma Laplacian Anti-Consensus (`u_antiConsensusGain`)

**Location**: `coreV1TransitionShader` - section (F)

**Formula**:
```glsl
vec2 laplacian_ab = (ab_north + ab_south + ab_east + ab_west) - 4.0 * abNow;
float curvature = length(laplacian_ab);

if (curvature < 0.02) {
    // Very flat color field - add perpendicular force
    float flatness = (0.02 - curvature) / 0.02;
    vec2 diff = abNow - abMean;
    vec2 perp_consensus = normalize(vec2(-diff.y, diff.x));
    dAB += perp_consensus * flatness * u_antiConsensusGain;
}
```

**Purpose**:
- Measures **color field curvature** using discrete Laplacian (4-neighbor stencil)
- Detects "flat" color regions (near-zero curvature)
- Applies perpendicular force to create internal structure
- **Emergent property**: Prevents large uniform color patches from persisting

**Tuning**:
- **Default**: 0.40
- **Range**: 0.0 - 1.5
- Higher values = more aggressive anti-uniformity

---

### 2. Vorticity Color Rotation (`u_vorticityGain`)

**Location**: `coreV1TransitionShader` - section (G)

**Formula**:
```glsl
float dLdx = (L_e - L_w) * 0.5;
float dLdy = (L_n - L_s) * 0.5;
float circulation = dLdx - dLdy;  // Measure of L field asymmetry

if (abs(circulation) > 0.01) {
    vec2 ab_perp = normalize(vec2(-abNow.y, abNow.x));
    float rot_sign = sign(circulation);
    dAB += ab_perp * rot_sign * abs(circulation) * u_vorticityGain;
}
```

**Purpose**:
- Measures **circulation (curl)** of the L field using central differences
- When L has asymmetric gradients (swirls), colors rotate
- **Emergent property**: Spirals and waves arise from L field structure
- Direction of rotation depends on L field topology (not hardcoded)

**Tuning**:
- **Default**: 0.30
- **Range**: 0.0 - 1.0
- Higher values = stronger spiral formation

---

## Implementation Details

### Files Modified

1. **`src/render/coreV1Shaders.js`**:
   - Added 4-neighbor sampling at start of chroma update section
   - Implemented Laplacian calculation (section F)
   - Implemented vorticity calculation (section G)
   - Both mechanisms use existing `(L, a, b, M)` state

2. **`src/ui/tunableParams.js`**:
   - Added `antiConsensusGain` parameter
   - Added `vorticityGain` parameter
   - Both in `'Core V1 Diversity'` group

3. **`src/core/coreV1Engine.js`**:
   - Added uniform passing for `u_antiConsensusGain`
   - Added uniform passing for `u_vorticityGain`

### Computational Cost

**Additional texture samples per pixel**: 4 (north, south, east, west neighbors)

These are **shared** between both mechanisms, so the overhead is minimal.

---

## Testing Criteria

### Expected Behaviors

1. **Flat Color Regions**:
   - Should develop internal structure
   - Hue should start rotating/swirling when too uniform
   - No more large static color blobs

2. **L Field Dynamics**:
   - When L has interesting gradients (waves, borders), colors should spiral
   - Direction of spirals should vary across the field
   - Not uniform rotation - **emergent** from local L geometry

3. **Interaction with Existing Mechanisms**:
   - Should work with Phase 1 oscillatory dynamics
   - Should enhance, not override, momentum-driven hue coupling
   - Should create richer texture than Phase 1 alone

### What to Look For

**Good signs**:
- Color spirals emerging at L wavefronts
- Flat patches breaking up into gradients
- Variety of rotation directions across the field

**Bad signs (please report)**:
- Uniform global rotation (vorticity should be local)
- Color noise/instability (gain too high)
- No visible effect (gain too low or L field too static)

---

## Tuning Recommendations

### Conservative (subtle enhancement):
```
antiConsensusGain: 0.20
vorticityGain: 0.15
```

### Default (balanced):
```
antiConsensusGain: 0.40
vorticityGain: 0.30
```

### Aggressive (strong spatial effects):
```
antiConsensusGain: 0.80
vorticityGain: 0.60
```

---

## Design Philosophy Alignment

Both mechanisms are **pure emergent**:

✅ **Laplacian Anti-Consensus**:
- Responds to local field geometry (curvature)
- No external phase or imposed structure
- Force direction emerges from local gradient

✅ **Vorticity Color Rotation**:
- Driven by L field circulation (asymmetric gradients)
- Rotation direction comes from field topology
- Not "spin all colors clockwise" - it's position-dependent

---

## Next Steps

After validating Phase 2, we'll proceed to:

**Phase 3**: Cross-Variance Modulation  
- L variance modulates chroma dynamics
- Chroma variance modulates L dynamics
- Creates inter-channel feedback loops

**Estimated time**: 30 minutes  
**Risk**: Low (no new sampling required)

---

## Notes

- No degeneracy mechanisms introduced
- Both forces are **additive** to existing chroma dynamics
- Can be disabled independently by setting gain to 0
- Performance impact negligible (4 samples already done in many shaders)
