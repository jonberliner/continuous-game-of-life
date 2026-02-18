# Phase 1 Issues - Diagnostic Analysis

## Issue 1: Source Image Shadow Persists

### Investigation

Found source color bias code at line 314-319 in transition shader:
```glsl
vec2 abSrc = rgb2ab(src);
float srcRate = clamp(u_sourceColorAdherence * 0.20 * u_deltaTime * (1.0 - 0.5 * barrier), 0.0, 1.0);
abNew = mix(abNew, abSrc, srcRate);
```

**Good news**: Default value is `sourceColorAdherence = 0.0` in engine (line 168)

**However**: If this param is set via UI or presets, it WILL pull colors back to source.

### Solution: Remove Source Bias Entirely

For pure CA dynamics, we should completely remove source influence:

```glsl
// REMOVE these lines (314-319):
// vec2 abSrc = rgb2ab(src);
// float srcRate = clamp(u_sourceColorAdherence * 0.20 * u_deltaTime * (1.0 - 0.5 * barrier), 0.0, 1.0);
// abNew = mix(abNew, abSrc, srcRate);
```

**Alternative**: Keep code but ensure it's truly zero. The shadow might be:
1. Initial conditions (starting from source image colors) - this is OK, just slow evolution
2. Params not actually zero - check UI sliders
3. Edge detection still using original image

---

## Issue 2: Black Degeneracy (Critical!)

### The Problem

Large patches or whole screen collapse to black (L → 0).

### Root Cause Analysis

Let me trace what happens when a region becomes uniformly dark:

#### Initial State: Uniform Dark Region
```
L_now = 0.1 (dark)
L_mean = 0.1 (neighbors also dark)
M = 0.1 (memory tracks L)
L_stddev = 0.0 (flat region)
```

#### L Dynamics Evaluation:

**Term (A): Diffusion**
```glsl
dL += (L_mean - L_now) * u_coreLDiffGain
dL += (0.1 - 0.1) * 0.5 = 0.0  // No effect (uniform)
```

**Term (B): History Oscillation**
```glsl
float deviation = L_now - M = 0.1 - 0.1 = 0.0
dL += -deviation * u_historyOscillationGain = 0.0  // No effect (at equilibrium)
```

**Term (C): Non-Monotonic Conformity**
```glsl
float diff = L_now - L_mean = 0.1 - 0.1 = 0.0
float absDiff = 0.0

if (absDiff < 0.15) {  // TRUE
    dL += -sign(0.0) * u_divergenceGain  // sign(0) = 0!
    dL += 0.0  // No effect!
}
```

**PROBLEM**: `sign(0.0) = 0.0` in GLSL! When perfectly uniform, divergence term = 0!

**Term (D): Variance-Driven**
```glsl
float varianceBoost = 0.0 * u_varianceAmplifyGain = 0.0  // No variance
float flatness = 1.0 - 0.0 = 1.0  // Maximally flat
float flatPenalty = 1.0 * u_flatBreakupGain = 0.5
float dLSign = sign(0.0) = 0.0  // PROBLEM AGAIN!

dL += (0.0 - 0.5) * 0.0 = 0.0  // No effect!
```

**Total dL = 0.0** → Region stays dark forever!

### The Bug: `sign(0.0) = 0.0`

When `dL = 0.0` (perfectly stable), both divergence and flat penalty become zero because they're multiplied by `sign(dL)`.

This creates a **stable equilibrium at uniform L** despite our anti-degeneracy mechanisms!

### Solution 1: Fix Flat Breakup (Don't Multiply by sign(dL))

Change line 245:
```glsl
// OLD (broken):
dL += (varianceBoost - flatPenalty) * dLSign;

// NEW (fixed):
// In flat regions, ADD noise regardless of dL direction
if (flatness > 0.5) {  // Very flat
    // Add random perturbation to break symmetry
    float flatForce = flatPenalty * (hash22(v_texCoord + u_frameCount * 0.001).x - 0.5);
    dL += flatForce;
} else {
    // In structured regions, amplify existing changes
    dL += varianceBoost * dLSign;
}
```

### Solution 2: Fix Divergence Term (Handle Zero Diff)

Change lines 229-231:
```glsl
// OLD (broken):
if (absDiff < 0.15) {
    dL += -sign(diff) * u_divergenceGain;  // Fails when diff = 0
}

// NEW (fixed):
if (absDiff < 0.15) {
    if (abs(diff) < 0.01) {
        // Perfectly uniform - add random perturbation
        float randomPush = (hash22(v_texCoord + u_frameCount * 0.002).x - 0.5) * 2.0;
        dL += randomPush * u_divergenceGain;
    } else {
        // Nearly uniform - push apart
        dL += -sign(diff) * u_divergenceGain;
    }
}
```

### Solution 3: Ensure Noise is Always Present

The current noise term (line 285-287) is CHROMA noise, not L noise!

We need to add L noise too:

```glsl
// After computing dL, BEFORE clamping:
// Always add small L noise to prevent exact equilibrium
float L_noise = (hash22(v_texCoord * 500.0 + u_frameCount * 0.003).x - 0.5) * u_noiseGain * 0.5;
dL += L_noise;
```

### Solution 4: Alternative Flat Breakup

Replace variance-driven term entirely:

```glsl
// (D) Variance-driven dynamics - FIXED VERSION
if (lStddev < 0.05) {
    // Very flat region - unstable!
    // Push in random direction
    float flatForce = (0.05 - lStddev) / 0.05;  // 0 to 1
    float randomDir = hash22(v_texCoord + u_frameCount * 0.001).x - 0.5;
    dL += randomDir * flatForce * u_flatBreakupGain;
} else {
    // Structured region - amplify gradients
    float varianceBoost = lStddev * u_varianceAmplifyGain;
    dL += varianceBoost * dLSign;
}
```

---

## Recommended Fix (Comprehensive)

Implement all three noise sources:

1. **L perturbation noise** (always active, small)
2. **Flat breakup noise** (when variance low)
3. **Divergence noise** (when perfectly uniform)

This ensures equilibrium is NEVER exact, preventing stable black regions.

---

## Why Black Specifically?

Black (L = 0) is especially stable because:

1. **Boundary clamping**: `lNew = clamp(..., 0.0, 1.0)` hard floor at 0
2. **Saturation coupling**: Activity-based saturation means dark = low activity = gray (no color diversity to drive change)
3. **Momentum rotation**: If ab is also uniform (gray), rotation term = 0

Black + gray + uniform = **perfect trap state**.

---

## Implementation Plan

### Fix 1: Remove Source Bias (Optional but Clean)
Comment out lines 314-319 in transition shader.

### Fix 2: Add L Noise (Critical)
Add small constant noise to dL before clamping.

### Fix 3: Fix Flat Breakup (Critical)
Don't multiply by sign(dL) - instead add random perturbation directly.

### Fix 4: Fix Divergence at Zero (Important)
Handle perfectly uniform case with random push.

---

## Testing After Fix

Run simulation and verify:
- [ ] Black regions don't stay black > 100 frames
- [ ] Uniform patches spontaneously break up
- [ ] Always some activity visible (never perfectly static)
- [ ] No stable equilibria exist

---

## Mathematical Insight

**The fundamental problem**: We designed anti-degeneracy mechanisms that depend on `sign(dL)` or `sign(diff)`, but when the system reaches perfect uniformity, these derivatives are EXACTLY zero, nullifying our defenses.

**The solution**: Anti-degeneracy forces must be **independent of current gradients** in the degenerate case. Use stochastic forces that don't depend on existing structure.

**Key principle**: "To break symmetry, you need asymmetry from outside the symmetric state."

When everything is uniform (symmetric), derivatives are all zero. You need an external perturbation (noise) that doesn't depend on those derivatives.
