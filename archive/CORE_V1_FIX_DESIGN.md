# Core V1 Engine Fix - Design Document

## Problem Summary

Current CoreV1 engine degenerates to static equilibrium because:
1. No temporal memory - pure feedforward averaging
2. Diffusion dominates - all terms reduce variance
3. Growth-driven dynamics stop at equilibrium
4. No mechanism to break stable states

## Solution: True CA State Encoding

All history, momentum, and memory **must be encoded in cell state** (RGBA channels).
No separate history textures - this is a cellular automaton.

---

## State Encoding Scheme

### Current (Broken) Encoding
```
RGB = display color derived from (L, a, b)
A = unused/opaque
```

### New Encoding
```
R = L     (luminance/density, [0,1])
G = a     (chroma x-axis, [-1,1] stored as [0,1])
B = b     (chroma y-axis, [-1,1] stored as [0,1])
A = M     (momentum/memory, [0,1])
```

Where:
- **L**: Current luminance (like cell density/activity)
- **a, b**: Chroma vector (S·cos(2πH), S·sin(2πH))
- **M**: Temporal memory (encodes recent history for oscillation)

### Display Mapping
For visualization only, convert (L, a, b) → RGB using HSV:
```glsl
vec3 display = abL2rgb(vec2(a, b), L);
```

---

## Momentum/Memory Channel (M)

The **M channel** encodes temporal information for anti-degeneracy.

### Option A: Momentum (Velocity Memory)
```
M = sign and magnitude of recent L change
M = 0.5 + 0.5 * tanh(dL_recent)
```
- M > 0.5: L was increasing recently
- M < 0.5: L was decreasing recently
- M ≈ 0.5: L stable

### Option B: Exponential Moving Average
```
M = exponential_avg(L, decay=0.95)
M_new = 0.95 * M + 0.05 * L
```
- Slow-moving history of L
- Compare L vs M to detect deviation

### Option C: Stasis Tracker
```
M tracks how long cell has been "boring"
M increases when |dL| + |d(ab)| is small
M decreases when big changes occur
```

**Recommendation: Use Option B (EMA)** - simple, interpretable, creates oscillations.

---

## Anti-Degeneracy Dynamics

### 1. Oscillatory L Dynamics

Instead of pure diffusion + global attractor, use **deviation from history**:

```glsl
float M = state.a;  // Memory (slow EMA of L)
float L = state.r;  // Current L

// Neighborhood info
float L_mean = conv.r;
float L_variance = conv.g;  // NEW: need to compute this

// === Core L Update ===
float dL = 0.0;

// (A) Local diffusion - moderate strength
dL += (L_mean - L) * diffusionGain;

// (B) History oscillation - anti-stability
// If L > M (above trend), push down; if L < M, push up
// This creates overshooting around the moving average
float deviation = L - M;
dL += -deviation * historyOscillationGain;  // ANTI-DAMPING

// (C) Non-monotonic reaction
// Cells want to be different from neighbors, but not too different
float conformityPressure = 0.0;
if (abs(L - L_mean) < 0.15) {
    // Too similar → diverge
    conformityPressure = -sign(L - L_mean) * divergenceGain;
} else if (abs(L - L_mean) > 0.4) {
    // Too different → converge slightly
    conformityPressure = sign(L_mean - L) * moderationGain;
}
dL += conformityPressure;

// (D) Variance-driven activation
// High local variance → amplify (borders/features grow)
// Low local variance → destabilize (flat regions break up)
float varianceBoost = L_variance * varianceAmplifyGain;
float flatPenalty = (1.0 - L_variance) * flatBreakupGain;
dL += (varianceBoost - flatPenalty) * sign(dL);

L_new = clamp(L + dL * dt * L_rate, 0.0, 1.0);
```

### 2. History-Driven Chroma Dynamics

Chroma should **not just adopt neighborhood average**. Instead:

```glsl
vec2 ab_now = state.gb * 2.0 - 1.0;  // Decode from [0,1] to [-1,1]
vec2 ab_mean = conv.ab;

vec2 d = ab_mean - ab_now;
float d_mag = length(d);

vec2 dAB = vec2(0.0);

// (A) Adoption with non-monotonic strength
// Small difference: weak adoption (maintain diversity)
// Medium difference: strong adoption (propagation)
// Large difference: weak adoption (boundaries sharpen)
float adoptStrength = 0.0;
if (d_mag < 0.1) {
    adoptStrength = 0.2;  // Weak - preserve local color
} else if (d_mag < 0.4) {
    adoptStrength = 1.5;  // Strong - propagate color waves
} else {
    adoptStrength = 0.4;  // Weak - maintain sharp boundaries
}
dAB += d * adoptStrength * adoptGain;

// (B) Tangential rotation (hue shift)
// Rotate around neighborhood direction based on L momentum
vec2 tangent = d_mag > 1e-5 ? normalize(vec2(-d.y, d.x)) : vec2(0.0);
float L_momentum = L_new - M;  // How fast L is changing
dAB += tangent * L_momentum * rotationGain;

// (C) Saturation pressure from L
// High L → increase saturation
// Low L → decrease saturation
float s_now = length(ab_now);
float s_target = 0.3 + 0.5 * L_new;
vec2 s_push = s_now > 1e-5 ? normalize(ab_now) * (s_target - s_now) : vec2(0.0);
dAB += s_push * saturationGain;

// (D) Random walk (subtle stochasticity using position-based noise)
vec2 noise = hash22(v_texCoord + vec2(time * 0.01)) * 2.0 - 1.0;
dAB += noise * noiseGain * (1.0 - M);  // More noise when not in flow

ab_new = clamp(ab_now + dAB * dt * color_rate, -1.0, 1.0);
```

### 3. Memory Update

```glsl
// Exponential moving average of L
float M_old = state.a;
float M_new = M_old * (1.0 - memoryDecay) + L_new * memoryDecay;
```

**Key**: `memoryDecay` should be small (0.02 - 0.05) so M changes slowly.
This creates the "restoring force" for oscillations.

---

## Convolution Updates

Current convolution only computes:
```
(L_mean, a_mean, b_mean)
```

Need to add:
```
L_variance (or at least a proxy for local heterogeneity)
```

Options:
1. Compute true variance: `E[(L - L_mean)²]`
2. Compute sum of absolute differences
3. Compute gradient magnitude

**Recommendation**: Compute variance properly in convolution shader.

Updated convolution output:
```
R = L_mean
G = L_variance  (or L_stddev)
B = a_mean
A = b_mean
```

Then in transition shader, unpack:
```glsl
float L_mean = conv.r;
float L_var = conv.g;
vec2 ab_mean = conv.ba;
```

---

## Parameter Set (Minimal Core)

All parameters should have clear roles:

### L Dynamics
- `diffusionGain` (0.0-2.0, default 0.5) - Smoothing strength
- `historyOscillationGain` (0.0-2.0, default 0.8) - Anti-stability
- `divergenceGain` (0.0-1.0, default 0.3) - Break up uniformity
- `moderationGain` (0.0-1.0, default 0.2) - Prevent runaway
- `varianceAmplifyGain` (0.0-1.0, default 0.5) - Boost features
- `flatBreakupGain` (0.0-1.0, default 0.2) - Destabilize flat areas
- `L_rate` (0.0-10.0, default 1.0) - Overall L speed

### Chroma Dynamics
- `adoptGain` (0.0-2.0, default 1.0) - Color propagation
- `rotationGain` (0.0-2.0, default 0.8) - Hue flow
- `saturationGain` (0.0-1.0, default 0.3) - L-chroma coupling
- `noiseGain` (0.0-0.1, default 0.02) - Subtle randomness
- `color_rate` (0.0-10.0, default 1.0) - Overall color speed

### Memory
- `memoryDecay` (0.01-0.2, default 0.05) - How fast M tracks L

### Spatial
- `radius` (0.01-0.1, default 0.03) - Neighborhood size

---

## Non-Monotonic Interaction Diagram

```
Adoption Strength vs Distance:

  1.5 |     ╱╲
      |    ╱  ╲___
  1.0 |   ╱       ╲
      |  ╱         ╲___
  0.5 | ╱              ╲___
      |╱___________________╲___
  0.0 +----+----+----+----+----
      0   0.1  0.2  0.4  0.6  1.0
           d_mag (color difference)
```

This creates:
- **Waves** at medium differences (high adoption)
- **Boundaries** at large differences (low adoption)
- **Diversity** at small differences (weak adoption)

---

## Implementation Phases

### Phase 1: State Encoding
- Modify state textures to store (L, a, b, M) explicitly
- Update display shader to convert L,a,b → RGB
- Initialize M to L on reset

### Phase 2: Convolution Extension
- Add L_variance computation to convolution shader
- Pack as (L_mean, L_var, a_mean, b_mean)

### Phase 3: Memory Update
- Add M update as exponential moving average
- Test that M lags L correctly

### Phase 4: Oscillatory L Dynamics
- Implement history-deviation term
- Add non-monotonic conformity pressure
- Add variance-driven terms
- Test for sustained oscillation

### Phase 5: Chroma Overhaul
- Non-monotonic adoption function
- Momentum-driven rotation
- Saturation coupling
- Position-based subtle noise

### Phase 6: Tuning & Validation
- Find parameter ranges that avoid degenerate states
- Ensure no parameter set leads to freeze
- Verify color diversity persists for 1000+ frames

---

## Success Metrics

System is **non-degenerate** if after 500+ frames:
1. **Activity**: `mean(|dL|)` > 0.001
2. **Color variance**: `stddev(H)` > 0.1
3. **Spatial variance**: `stddev(L)` > 0.05
4. **No freeze**: max stasis time < 20 frames

---

## Key Insights

### Why This Won't Degenerate

1. **M lags L** → creates restoring force → oscillations never stop
2. **Non-monotonic adoption** → maintains boundaries and waves simultaneously
3. **Variance-dependent terms** → flat regions are unstable
4. **Momentum-driven rotation** → colors flow as long as L oscillates
5. **Divergence pressure** → similar neighbors repel slightly
6. **No global attractors** → no fixed point for the system

### Why This Is CA-Native

- All state in RGBA channels (no external history)
- Each cell updates from its own state + neighborhood
- Deterministic (except optional subtle noise)
- Modular (can swap L update, chroma update independently)

---

## Next Step

Implement Phase 1-2: Update state encoding and convolution shader.
