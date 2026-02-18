# Source & Chaos Analysis

## ISSUE 2: Source Greyscale Persists

### Why This Happens

The source influence code pulls `lNew` toward `src_L`:
```glsl
float source_pull_L = smoothstep(0.5, 0.1, dist_to_source_L) * (src_L - lNew);
lNew += source_pull_L * u_sourceBlend * 0.05;
```

**Problem**: Even at 0.01, this creates a PERSISTENT BIAS toward source luminance.
- If source pixel is dark (L=0.2), it constantly pulls that cell toward 0.2
- If source pixel is bright (L=0.8), it constantly pulls toward 0.8
- Result: **Source luminance structure persists as greyscale outline**

### Why Colors Don't Affect It

The chroma pull is SEPARATE and WEAKER (0.03 vs 0.05):
```glsl
abNew += source_pull_ab * u_sourceBlend * 0.03;
```

So luminance converges faster than chroma can spread from neighbors.

### THE FUNDAMENTAL ISSUE

**Source influence should NOT be a persistent attractor!**

Any constant bias accumulates over time. At 60 FPS:
- Frame 1: 0.01 pull
- Frame 2: 0.01 pull  
- Frame 3: 0.01 pull
- After 100 frames: Effectively locked to source

**Solution**: Source should be ONE-TIME initial condition, OR a very occasional "nudge", NOT continuous.

---

## ISSUE 3: System Too Predictable / Cyclic

### Why No Chaos?

Your observation is CORRECT and DEEP. Let's analyze what we have:

#### Our "Anti-Degeneracy" Mechanisms:
1. **Oscillation** (L-M coupling) → Creates **periodic** motion
2. **Attractors** → Pull to discrete levels → **Reduces phase space**
3. **Quantized angles** → Discrete directions → **Reduces degrees of freedom**
4. **Boundary sharpening** → Snap to thresholds → **Creates bistability**
5. **Noise** (0.025) → Very weak → **Insufficient for chaos**

### The Mathematics

**Chaos requires**:
1. **Sensitivity to initial conditions** (butterfly effect)
2. **Aperiodic** (never repeats)
3. **Bounded** (doesn't blow up)

**We have**:
1. ✅ Bounded (clamped 0-1)
2. ❌ **TOO MUCH STRUCTURE** (attractors, quantization)
3. ❌ **TOO LITTLE NONLINEARITY** (noise too weak)
4. ❌ **TOO DETERMINISTIC** (everything is smooth functions)

### Why Cyclic Patterns Emerge

**Attractors + Oscillation = Limit Cycles**

- L oscillates around attractors (0.15, 0.50, 0.85)
- Angles are quantized (4-10 directions)
- Boundary sharpening creates bistable switches
- Result: **Attracting periodic orbits** (limit cycles)

This is actually STABLE CHAOS - it looks complex but is predictable!

### What Would Create True Chaos?

1. **Stronger noise** (0.1-0.2, not 0.025)
2. **Remove/weaken attractors** (or make them time-varying)
3. **Remove angle quantization** (continuous angles)
4. **Add hard nonlinearities** (actual if/else branching on state)
5. **Multi-scale coupling** (fast + slow variables)
6. **Stochastic resets** (occasional random perturbations)

### The Discrete Shapes Problem

**Why no discrete shapes?**

Our mechanisms PREVENT isolated structures:
- **Diffusion** → Smooths boundaries
- **Color adoption** → Spreads uniformly
- **Vorticity** → Creates spirals (extended structures)
- **Anti-consensus** → Breaks uniformity but globally

**We're missing**:
- **Reaction-diffusion** → Creates spots/stripes
- **Lateral inhibition** → "Peaks suppress surroundings"
- **Threshold-triggered growth** → Binary on/off
- **Surface tension** (minimize boundary length)

---

## RECOMMENDATIONS

### For Source Image (Choose ONE):

**Option A: Remove continuous source influence**
```glsl
// NO source pull in dynamics
// Source is ONLY initial condition
```

**Option B: Occasional nudges (not continuous)**
```glsl
// Only apply source pull every N frames
if (mod(u_frameCount, 60.0) < 1.0) {
    // nudge toward source once per second
}
```

**Option C: Source affects RULES not STATE**
```glsl
// Source modulates parameters spatially
float local_noise = u_noiseGain * (1.0 + src_L);  // Bright areas noisier
```

### For Chaos & Discrete Shapes:

**Quick fixes**:
1. ↑ `noiseGain` to 0.10-0.15 (10× increase!)
2. ↓ `attractorGain` to 0.05 (weaken clustering)
3. ↓ `angleQuantization` to 1.0 (continuous angles)
4. ↑ `flatBreakupGain` to 2.0 (aggressive destabilization)

**Medium fixes** (new mechanisms):
5. Add **stochastic resets**: Random pixels occasionally reset
6. Add **lateral inhibition**: Bright cells suppress neighbors
7. Add **growth threshold**: If L > 0.7, actively grow outward

**Hard fix** (architectural):
8. Add second timescale (slow + fast variables)
9. Add reaction-diffusion coupling
10. Add **true random events** (not pseudo-random noise)

### Your Interesting Preset

Those settings actually CREATE the cyclic behavior:
- High `attractorGain` (1.85) → Strong clustering
- High angle quantization (10) → Discrete modes
- Low oscillation (0.20) → Damped → Settles
- High hysteresis (0.90) → Sticky states

**To make it MORE chaotic**, try:
- `noiseGain`: 0.025 → 0.12
- `attractorGain`: 1.85 → 0.10
- `angleQuantization`: 10 → 1
- `historyOscillationGain`: 0.20 → 1.50

This will be much less structured but more chaotic!
