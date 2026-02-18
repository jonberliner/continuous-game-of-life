# State-Dependent Angle Analysis - Is It Degenerate?

## 🔴 DIAGNOSIS: YES, PARTIALLY DEGENERATE

### Why We See Only Circles & Stripes

**Current angle formula:**
```glsl
angle = (L - 0.5) * angleL * PI +           // Bright/dark
        (L - M) * angleM * PI * 2.0 +       // Oscillation phase
        (saturation - 0.5) * angleS * PI +  // Saturation
        L_variance * angleV * PI;           // Variance
```

**Problems**:

1. **Global Synchronization**
   - All cells oscillate at similar frequency (same `memoryDecay`)
   - `(L - M)` becomes similar everywhere at any given time
   - `angleM` term creates GLOBAL rotation direction
   - Result: **Everything rotates together** → radiating circles

2. **Spatial Smoothing**
   - L diffuses → smooth gradients
   - M tracks L smoothly
   - L_variance is neighborhood average → smooth
   - Saturation is becoming uniform (our Phase 3 fix target)
   - **All inputs are smooth fields** → angle is smooth field
   - Result: **No discrete rotation domains** → stripes at boundaries

3. **Linear Combination of Smooth Fields = Smooth Field**
   - No sharp transitions
   - No local heterogeneity
   - Only large-scale gradients
   - Result: **Global patterns only**

---

## 🎯 WHY IT'S DEGENERATE

### Missing: Multi-Scale Temporal Heterogeneity

**All cells oscillate in phase because:**
- Same `memoryDecay` everywhere
- Diffusion synchronizes neighbors
- No mechanism to create different oscillation frequencies

**What we need**: Different regions oscillating at **different rates**

### Missing: Discrete Angle States

**Current**: Continuous angle from -π to +π
**Problem**: Smoothly varying → large gradients only

**What we need**: Angle quantized to discrete values (e.g., 0°, 45°, 90°, 135°, etc.)

### Missing: Nonlinear Angle Response

**Current**: Linear sum of factors
**Problem**: No sharp transitions, no surprises

**What we need**: Threshold-based angle switching

---

## 💡 FIXES FOR STATE-DEPENDENT ANGLE

### Fix 1: Quantize Angles (Creates Discrete Rotation Domains)

```glsl
// After computing continuous angle, snap to discrete values
float compute_state_angle(...) {
    // ... existing computation ...
    float angle = L_contrib + M_contrib + S_contrib + V_contrib;
    angle = mod(angle + PI, TWO_PI) - PI;
    
    // QUANTIZE to discrete angles
    float num_directions = u_angleQuantization;  // e.g., 8 directions
    if (num_directions > 1.0) {
        float angle_step = TWO_PI / num_directions;
        angle = floor((angle + PI) / angle_step) * angle_step - PI;
    }
    
    return angle;
}
```

**Effect**: 
- Instead of smooth angle field, discrete rotation domains
- Sharp boundaries between domains
- Local features form at domain boundaries

**Parameter**: `angleQuantization` (default: 4.0, range: 1-16)
- 1 = continuous (current)
- 4 = four cardinal directions (N, E, S, W)
- 8 = eight directions (adds diagonals)
- 16 = very fine quantization

---

### Fix 2: Position-Dependent Angle Bias (Breaks Synchronization)

```glsl
// Add to compute_state_angle
float compute_state_angle(...) {
    // ... existing computation ...
    
    // Add position-dependent bias (deterministic but spatially varying)
    vec2 spatial_freq = v_texCoord * u_spatialFrequency;
    float position_bias = (hash22(floor(spatial_freq * 10.0)).x - 0.5) * u_positionAngleBias * PI;
    
    angle += position_bias;
    
    // Then quantize if enabled
    // ...
}
```

**Effect**:
- Different spatial regions have different angle biases
- Breaks global synchronization
- Creates heterogeneous local rotation

**Parameters**:
- `spatialFrequency` (default: 5.0, range: 1-20): How fine-grained the spatial variation
- `positionAngleBias` (default: 0.5, range: 0-2): Strength of position effect

---

### Fix 3: Threshold-Based Angle Switching (Nonlinearity)

```glsl
float compute_state_angle(...) {
    // ... existing computation ...
    
    // If any factor crosses threshold, snap angle
    if (abs(M_contrib) > u_momentumThreshold * PI) {
        // High momentum - lock to perpendicular
        angle = sign(M_contrib) * PI * 0.5;
    }
    if (V_contrib > u_varianceThreshold * PI) {
        // High variance (boundary) - lock to tangent
        angle = PI * 0.5;
    }
    
    return angle;
}
```

**Effect**:
- Sharp transitions in rotation direction
- Creates discrete regimes
- High momentum → perpendicular lock
- Boundaries → tangential flow lock

**Parameters**:
- `momentumThreshold` (default: 0.8, range: 0.5-2.0)
- `varianceThreshold` (default: 0.6, range: 0.3-1.5)

---

### Fix 4: Multi-Frequency Oscillation (Breaks Temporal Sync)

**Problem**: All cells use same `memoryDecay` → same oscillation frequency

**Solution**: Make memory decay spatially varying

```glsl
// In transition shader, before computing L momentum
float spatial_noise = hash22(v_texCoord * u_memoryFreqScale).x;
float local_memory_decay = u_memoryDecay * (0.5 + spatial_noise);  // Range: 0.5x to 1.5x

// Use local_memory_decay instead of u_memoryDecay
float M_new = M * (1.0 - local_memory_decay) + lNew * local_memory_decay;
```

**Effect**:
- Different regions oscillate at different frequencies
- Phase relationships become complex
- Local beating patterns emerge
- No more global synchronization

**Parameter**: `memoryFreqScale` (default: 10.0, range: 1-50)
- How spatially varying the frequency is

---

## 🎯 RECOMMENDED: COMBINED FIX

### Add All 4 Fixes Together

**Why**: Each addresses different aspect of degeneracy
1. **Quantization** → discrete domains
2. **Position bias** → spatial heterogeneity
3. **Threshold switching** → nonlinearity
4. **Multi-frequency** → temporal heterogeneity

**Total new parameters**: 6
- `angleQuantization` (4.0)
- `spatialFrequency` (5.0)
- `positionAngleBias` (0.5)
- `momentumThreshold` (0.8)
- `varianceThreshold` (0.6)
- `memoryFreqScale` (10.0)

**Expected Results**:
- ✅ Discrete rotation domains (not smooth spirals)
- ✅ Local eddies and vortices (not global circles)
- ✅ Complex beating patterns (not radiating stripes)
- ✅ Spatial heterogeneity (not synchronized)
- ✅ Truly exotic dynamics

---

## 📋 REVISED PHASE 3 IMPLEMENTATION PLAN

### Phase 3A: Fix Angle Degeneracy (6 params)
1. Angle quantization
2. Position-dependent bias
3. Threshold switching
4. Multi-frequency oscillation

### Phase 3B: Multi-Stable Attractors (5 params)
1. Attractor positions (3 tunable)
2. Attractor gain
3. Darkness recovery (with floor at 0.001)

### Phase 3C: Saturation Heterogeneity (4 params)
1. satVarianceWeight
2. satIsolationWeight
3. satLWeight
4. satActivityWeight (keep existing, add others)

### Phase 3D: Boundary Sharpening (3 params)
1. boundaryAmplify
2. hysteresisGain
3. competitionGain

**Total**: 18 new parameters across 4 phases

---

## 🔬 DEGENERACY CHECK

### Before Fixes
❌ Global synchronized oscillation
❌ Smooth angle field → large patterns only
❌ Radiating circles from phase waves
❌ Stripes from smooth gradients

### After Phase 3A (Angle Fixes)
✅ Discrete rotation domains
✅ Spatially varying oscillation frequency
✅ Local vortices and eddies
✅ Complex multi-scale patterns

### After Phase 3B (Attractors)
✅ Discrete brightness levels
✅ Local isolated structures
✅ Both small and large features

### After Phase 3C (Saturation Heterogeneity)
✅ Spatial saturation variation
✅ Vivid borders, muted centers
✅ Not uniform color intensity

### After Phase 3D (Boundary Sharpening)
✅ Sharp state transitions
✅ Winner-take-all competition
✅ Stable local features

---

## 🎯 IMPLEMENTATION ORDER

### Recommended: Start with Angle Fixes

**Why**: Addresses the immediate "circles and stripes" problem

**Order**:
1. **3A: Angle degeneracy fixes** (45 min, 6 params)
   - Should immediately see more exotic patterns
   - Test and validate
   
2. **3B: Multi-stable attractors** (30 min, 5 params)
   - Adds discrete brightness domains
   - Local structure formation
   
3. **3C: Saturation heterogeneity** (25 min, 4 params)
   - Spatial saturation variety
   - Breaks uniform vividness
   
4. **3D: Boundary sharpening** (20 min, 3 params)
   - Polish - sharper features
   - Winner-take-all dynamics

**Total time**: ~2 hours
**Total new params**: 18

---

## ⚡ QUICK FIX OPTION

If you want to test immediately, **just add angle quantization** (1 param):

```glsl
// In compute_state_angle, at the end:
if (u_angleQuantization > 1.0) {
    float step = TWO_PI / u_angleQuantization;
    angle = floor((angle + PI) / step) * step - PI;
}
```

**Effect**: Discrete rotation domains instead of smooth spirals

**Test with**: `angleQuantization = 4` (four cardinal directions)

Should immediately break up radiating circles into discrete rotating domains!

---

## USER DECISION NEEDED

Given the angle degeneracy analysis:

**A. Do all 4 sub-phases (3A + 3B + 3C + 3D) = 18 params**
   - Most thorough
   - Addresses all degeneracies
   - ~2 hours implementation

**B. Do angle fixes + attractors (3A + 3B) = 11 params**
   - Core fixes only
   - ~1.25 hours

**C. Quick test: Just angle quantization = 1 param**
   - See if this helps immediately
   - 5 minutes

Which would you like?
