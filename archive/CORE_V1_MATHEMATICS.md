# Core V1: Mathematical Analysis

## Why the Old System Degenerates

### Old L Dynamics
```
dL/dt = α(L_mean - L) + β(0.5 - L) + γ(s - 0.25)
```

**Equilibrium analysis**:
At equilibrium, dL/dt = 0:
```
α(L_mean - L) + β(0.5 - L) + γ(s - 0.25) = 0
```

If the system becomes spatially uniform (L = L_mean), then:
```
β(0.5 - L) + γ(s - 0.25) = 0
L_eq = 0.5 + (γ/β)(s - 0.25)
```

This is a **stable fixed point**. Small perturbations decay:
- If L > L_eq: β term pushes L down
- If L < L_eq: β term pushes L up

**Stability**: The term `β(0.5 - L)` is a **global attractor** with no repulsion. Once reached, system stays there forever.

### Old Chroma Dynamics
```
dAB/dt = adopt + repel + hueDrive

adopt = (AB_mean - AB) * α_adopt
repel = -d/|d| * α_repel * (1 - smoothstep(0.02, 0.25, |d|))
hueDrive = tangent * (L_new - L_old) * α_hue
```

**Equilibrium analysis**:
1. As system uniformizes, AB → AB_mean, so `adopt → 0`
2. As |d| → 0, repel term vanishes (smoothstep → 1)
3. At L equilibrium, `L_new ≈ L_old`, so `hueDrive → 0`

**Result**: All chroma forces → 0 at equilibrium. System freezes.

### Phase Portrait (Old System)

```
      dL/dt
        ↑
        |
        |   ← negative (decay)
━━━━━━━┿━━━━━━━━━━━━━━━━→ L
        |             ↑ L_eq
        |
        ↓ positive (growth)
```

Single stable fixed point at L_eq. No oscillation, no limit cycle.

---

## Why the New System Doesn't Degenerate

### New L Dynamics
```
dL/dt = α(L_mean - L)                    [diffusion]
      - β(L - M)                         [oscillation]
      + conformity(L, L_mean)            [non-monotonic]
      + variance_term(L_stddev, dL)      [anti-flat]
      
dM/dt = γ(L - M)     where γ << 1       [slow tracking]
```

**Key difference**: M is a **dynamic variable**, not a constant.

### Dynamical System Analysis

This is now a 2D system (L, M) instead of 1D (L only).

State space: (L, M) ∈ [0,1] × [0,1]

**Nullclines**:
1. L-nullcline: where dL/dt = 0
2. M-nullcline: where dM/dt = 0 → L = M (diagonal line)

For simplified version (ignoring conformity terms):
```
dL/dt = α(L_mean - L) - β(L - M)
dM/dt = γ(L - M)
```

**M-nullcline**: L = M

**L-nullcline**: 
```
α(L_mean - L) - β(L - M) = 0
M = L - (α/β)(L_mean - L)
```

If L > L_mean: M > L (M-nullcline below current M)
If L < L_mean: M < L (M-nullcline above current M)

### Phase Portrait (New System)

```
    M
    ↑
 1  |     dM/dt > 0        spiral or
    |   ↗                  limit cycle
    |  /
    | /___dL/dt = 0
0.5 |/_____ dM/dt = 0
    |↘     (L = M)
    |  ↘
    |    ↘  dM/dt < 0
    +────────────────→ L
    0   0.5          1
```

**Critical insight**: 
- When L increases, M lags behind (γ small)
- Growing L builds up potential energy: (L - M) grows
- Eventually -β(L - M) term dominates, reversing dL/dt
- L decreases but M still catching up from below
- Cycle repeats

This creates a **limit cycle** (sustained oscillation), not a fixed point.

### Lyapunov Function Analysis

For the old system, Lyapunov function exists:
```
V(L) = (L - L_eq)²
dV/dt < 0 for all L ≠ L_eq
```

This proves convergence to fixed point.

For the new system, **no global Lyapunov function exists** because:
- M is state-dependent
- Oscillation term -β(L - M) is not gradient descent of any potential

This means system can sustain oscillations indefinitely.

---

## Non-Monotonic Conformity

Old system:
```
adopt = constant * (AB_mean - AB)
```
Always pulls toward average → homogenization.

New system:
```
conformity(d) = {
    -k₁           if |d| < 0.15   [diverge]
     0            if 0.15 ≤ |d| ≤ 0.4  [neutral]
    +k₂           if |d| > 0.4    [moderate]
}
```

This creates **bistability** in local neighborhoods:
- Regions can sustain differences in [0.15, 0.4] range
- Too similar → repel
- Too different → attract slightly

Result: **Spatial heterogeneity is stable**.

### Energy Landscape

```
E(d)
  ↑
  |      ╱╲
  |     ╱  ╲___
  |    ╱        ╲___
  |___╱              ╲___
  +────────────────────→ |d|
  0   0.15   0.4       1.0
      min    barrier   min
```

Multiple local minima → diverse states can coexist.

---

## Variance-Driven Terms

```
variance_term = {
    +amplify * L_stddev        if dL > 0   [boost features]
    -breakup * (1 - L_stddev)  if dL < 0   [destabilize flat]
}
```

This creates **self-organization**:
- High-contrast regions (borders) → amplified changes → sharper
- Low-contrast regions (flat) → destabilized → broken up

**Turing-like instability**: Flat regions are linearly unstable.

Perturbation δL in flat region:
```
d(δL)/dt ≈ +breakup * δL
```
Positive feedback → perturbations grow.

But high-variance regions stabilize borders through amplification of existing structure.

---

## Chroma Rotation Dynamics

### Old System
```
hueDrive = tangent * (L_new - L_old)
```
At L equilibrium: L_new ≈ L_old → hueDrive = 0

### New System
```
rotationTerm = tangent * (L_new - M)
```
Key: Uses **M** not L_old. Since M lags L:
- When L oscillates, (L - M) alternates sign but never goes to zero
- Chroma continuously rotates

**Result**: Colors flow as long as L oscillates.

Even if L_mean becomes constant, individual cells oscillate around their local L_mean, maintaining (L - M) ≠ 0.

---

## Noise Role

Old system: No noise → deterministic convergence to fixed point

New system: 
```
noiseTerm = hash(position) * strength * (1 - |L_momentum|)
```

Noise is **stronger in stable regions**, weaker where already active.

This provides:
1. **Symmetry breaking** - prevents perfect uniform state
2. **Seed diversity** - initiates new patterns in quiet regions
3. **Anti-crystallization** - prevents frozen boundaries

Strength is tiny (0.02 default) so doesn't dominate, just nudges.

---

## Full System Dimensionality

Per cell state: (L, a, b, M) = 4D
Coupled to neighbors via convolution.

Effective dynamics:
```
dL/dt = f₁(L, M, L_mean, L_stddev, |ab|)
da/dt = f₂(a, b, a_mean, b_mean, L - M)
db/dt = f₃(a, b, a_mean, b_mean, L - M)
dM/dt = γ(L - M)
```

This is a 4D dynamical system with:
- No global attractors (non-gradient)
- Non-monotonic couplings (bistability)
- Spatial coupling (diffusive + non-local)
- Small stochastic forcing (noise)

**Expected behavior**: 
- Spatio-temporal chaos
- Turbulent-like dynamics
- Sustained complex patterns
- No fixed points

---

## Comparison Table

| Property | Old System | New System |
|----------|------------|------------|
| State dimension | 3D (L,a,b) | 4D (L,a,b,M) |
| L dynamics | 1st order | 2nd order (via M) |
| Equilibrium | Stable fixed point | Limit cycle |
| Attractor type | Point attractor | Strange attractor |
| Chroma coupling | Via L_change | Via L_momentum |
| Spatial term | Monotonic diffusion | Non-monotonic + variance |
| Noise | None | Position-based |
| Lyapunov function | Exists | Does not exist |
| Long-term behavior | Freeze at uniform | Sustained oscillation |

---

## Preventing Pathologies

### Runaway Growth
Old: Clamping after update
New: Clamping + moderation term for |L - L_mean| > 0.4

### Color Saturation > 1
Both: Normalize |ab| if exceeds 1

### Numerical Instability
Both: Timestep limiting via maxDelta parameters

### Stagnation
Old: No mechanism (fails here)
New: Multiple mechanisms:
- Oscillation term (always active)
- Flat breakup (targets quiet regions)
- Divergence pressure (prevents uniformity)
- Noise (seeds new activity)

---

## Theoretical Guarantees

**Cannot prove** perpetual motion for full nonlinear system.

**Can prove** for linearized system around uniform state:
1. Uniform state (L = L_mean = M, ab = ab_mean) has eigenvalues with positive real parts
2. Linearized system is **unstable** around uniform state
3. Therefore uniform state cannot be reached (unstable fixed point)

Perturbation around uniform:
```
δL(t) ≈ δL(0) * exp(λt)
```
Where λ has positive component from:
- Flat breakup term
- Divergence pressure
- Noise accumulation

**Conclusion**: System is **structurally non-degenerative**.

Small deviations from boring states amplify rather than decay.

---

## Next Steps

1. Implement according to pseudocode
2. Verify limit cycle in (L, M) phase space
3. Measure oscillation period and amplitude
4. Check spatial correlation length
5. Validate color diversity metrics over 1000+ frames
6. Tune parameters for desired aesthetic balance

The mathematics predicts:
- **Sustained dynamics** ✓
- **Spatial heterogeneity** ✓  
- **Color diversity** ✓
- **No degenerate fixed points** ✓
