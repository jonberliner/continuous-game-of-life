# State-Dependent Momentum Angles - Design

## The Degeneracy Problem

**Current Issue**: All color forces use fixed 90° perpendicular rotation:
```glsl
vec2 perp = vec2(-d.y, d.x);  // Always 90° CCW
```

This creates **uniform spirals everywhere** → degenerate, boring.

---

## State-Dependent Angle Proposal

**Core Idea**: The angle of applied force varies continuously based on cell state, creating heterogeneous dynamics.

### Formula Framework

```glsl
// Compute base direction (e.g., toward mean color)
vec2 base_dir = normalize(abMean - abNow);

// Compute rotation angle based on STATE
float rotation_angle = compute_state_angle(...);  // 0 to 2π

// Apply rotation
float c = cos(rotation_angle);
float s = sin(rotation_angle);
vec2 rotated_dir = vec2(
    base_dir.x * c - base_dir.y * s,
    base_dir.x * s + base_dir.y * c
);

dAB += rotated_dir * strength;
```

---

## Angle Functions (State → Rotation)

### Option 1: L-Driven Angle ⭐️⭐️⭐️

**Concept**: Rotation angle depends on L value

```glsl
float angle = (L_new - 0.5) * PI;  // -π/2 to +π/2

// L = 0.0 → angle = -π/2 (90° CW)
// L = 0.5 → angle = 0 (parallel/direct)
// L = 1.0 → angle = +π/2 (90° CCW)
```

**Effect**: 
- Bright regions pull/push in one direction
- Dark regions pull/push opposite direction
- Mid-luminance → direct approach/avoidance
- Creates **L-dependent chirality**

**Why pure**: Angle emerges from actual L field value
**Why interesting**: Different L domains have different rotation patterns

---

### Option 2: L-Momentum Angle ⭐️⭐️⭐️

**Concept**: Rotation angle depends on L momentum (activity)

```glsl
float L_momentum = L_new - M;
float angle = L_momentum * PI * 2.0;  // -2π to +2π (but typically -π to +π)

// L rising fast → large positive angle (CCW)
// L stable → angle ≈ 0 (direct)
// L falling fast → large negative angle (CW)
```

**Effect**:
- Active oscillating cells have strong rotation
- Stable cells have direct dynamics
- Direction of rotation depends on oscillation phase
- Creates **temporal heterogeneity**

**Why pure**: Uses existing momentum state
**Why interesting**: Oscillation phase determines rotation direction

---

### Option 3: Saturation-Driven Angle ⭐️⭐️

**Concept**: Rotation angle depends on saturation

```glsl
float s = length(abNow);
float angle = s * PI;  // 0 to π

// s = 0 (gray) → angle = 0 (direct)
// s = 0.5 → angle = π/2 (90° perpendicular)
// s = 1.0 (vivid) → angle = π (opposite/repel)
```

**Effect**:
- Gray cells adopt directly (fast mixing)
- Moderately saturated → spiral/tangent flow
- Highly saturated → repulsion/boundaries
- Creates **saturation-dependent dynamics**

**Why pure**: Rotation depends on own color state
**Why interesting**: Vivid colors resist mixing, gray mixes fast

---

### Option 4: Variance-Modulated Angle ⭐️⭐️⭐️

**Concept**: Rotation angle depends on local L variance (border detection)

```glsl
float angle = L_stddev * PI * 2.0;  // 0 to ~π (stddev rarely >0.5)

// Flat region (stddev ≈ 0) → angle ≈ 0 (direct)
// Border (high stddev) → angle → π (tangent/perpendicular)
```

**Effect**:
- Smooth regions: direct diffusion/adoption
- Borders: tangential flow (like flow around obstacle)
- Automatically detects features
- Creates **topology-dependent dynamics**

**Why pure**: Uses actual spatial structure
**Why interesting**: Flow naturally goes around features

---

### Option 5: Multi-Factor Composite ⭐️⭐️⭐️⭐️ (RECOMMENDED)

**Concept**: Combine multiple state factors

```glsl
float L_contribution = (L_new - 0.5) * u_angleL;           // -π to +π
float M_contribution = (L_new - M) * u_angleM;             // -π to +π  
float S_contribution = (length(abNow) - 0.5) * u_angleS;   // -π to +π
float V_contribution = L_stddev * u_angleV;                 // 0 to +π

// Weighted sum
float angle = L_contribution + M_contribution + S_contribution + V_contribution;

// Normalize to [-π, π]
angle = mod(angle + PI, TWO_PI) - PI;
```

**Effect**:
- Each factor contributes to rotation direction
- Rich heterogeneous patterns
- User can tune which factors dominate
- Non-uniform spirals, flows, eddies

**Why pure**: All factors are actual cell/neighborhood state
**Why interesting**: Emergent complexity from state interaction

---

## Implementation: Replace Perpendicular Forces

### Current Code to Replace

#### 1. Diversity Kick (lines ~335-342)
```glsl
// OLD: Fixed perpendicular
vec2 perp = normalize(vec2(-abNow.y, abNow.x));
dAB += perp * strength * u_diversityKick;

// NEW: State-dependent angle
float angle = compute_state_angle(L_new, M, length(abNow), L_stddev);
vec2 base = length(abNow) > 1e-5 ? normalize(abNow) : vec2(1, 0);
vec2 rotated = rotate_vector(base, angle);
dAB += rotated * strength * u_diversityKick;
```

#### 2. Anti-Consensus (lines ~344-357)
```glsl
// OLD: Fixed perpendicular to (ab - mean)
vec2 perp_consensus = normalize(vec2(-diff.y, diff.x));
dAB += perp_consensus * flatness * u_antiConsensusGain;

// NEW: State-dependent
float angle = compute_state_angle(...);
vec2 base = length(diff) > 1e-5 ? normalize(diff) : vec2(1, 0);
vec2 rotated = rotate_vector(base, angle);
dAB += rotated * flatness * u_antiConsensusGain;
```

#### 3. Vorticity (lines ~359-372)
```glsl
// OLD: Fixed perpendicular to ab_now
vec2 ab_perp = normalize(vec2(-abNow.y, abNow.x));
dAB += ab_perp * sign(circulation) * abs(circulation) * u_vorticityGain;

// NEW: Vorticity modulates angle, not just sign
float base_angle = compute_state_angle(...);
float vorticity_angle = base_angle + circulation * u_vorticityAngleScale;
vec2 base = length(abNow) > 1e-5 ? normalize(abNow) : vec2(1, 0);
vec2 rotated = rotate_vector(base, vorticity_angle);
dAB += rotated * abs(circulation) * u_vorticityGain;
```

#### 4. Momentum Hue Coupling (lines ~318-320)
```glsl
// OLD: Fixed tangent
vec2 tangent = normalize(vec2(-d.y, d.x));
dAB += tangent * L_momentum * u_coreGrowthHueCoupling;

// NEW: State-dependent angle
float angle = compute_state_angle(...);
vec2 base = length(d) > 1e-5 ? normalize(d) : vec2(1, 0);
vec2 rotated = rotate_vector(base, angle);
dAB += rotated * L_momentum * u_coreGrowthHueCoupling;
```

---

## Shader Helper Functions

```glsl
// Rotate a 2D vector by angle (radians)
vec2 rotate_vector(vec2 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

// Compute state-dependent rotation angle
// Returns angle in radians: [-π, π]
float compute_state_angle(
    float L_val,           // Current luminance
    float M_val,           // Momentum memory
    float saturation,      // Current saturation
    float L_variance,      // Neighborhood L variance
    float u_angleL,        // Weight for L contribution
    float u_angleM,        // Weight for momentum contribution
    float u_angleS,        // Weight for saturation contribution
    float u_angleV         // Weight for variance contribution
) {
    const float PI = 3.14159265359;
    const float TWO_PI = 6.28318530718;
    
    // Each factor contributes to rotation
    float L_contrib = (L_val - 0.5) * u_angleL * PI;
    float M_contrib = (L_val - M_val) * u_angleM * PI * 2.0;
    float S_contrib = (saturation - 0.5) * u_angleS * PI;
    float V_contrib = L_variance * u_angleV * PI;
    
    // Sum and wrap to [-π, π]
    float angle = L_contrib + M_contrib + S_contrib + V_contrib;
    angle = mod(angle + PI, TWO_PI) - PI;
    
    return angle;
}
```

---

## New Parameters

```javascript
// State-dependent angle weights
{ key: 'angleL', default: 0.5, min: -2.0, max: 2.0, step: 0.1,
  group: 'State Angles', label: 'L → Angle Weight',
  hint: 'How much L value affects rotation angle. Bright/dark have different chirality' },

{ key: 'angleM', default: 1.0, min: -2.0, max: 2.0, step: 0.1,
  group: 'State Angles', label: 'Momentum → Angle Weight',
  hint: 'How much L momentum affects rotation. Oscillation phase determines flow direction' },

{ key: 'angleS', default: 0.3, min: -2.0, max: 2.0, step: 0.1,
  group: 'State Angles', label: 'Saturation → Angle Weight',
  hint: 'How much saturation affects rotation. Vivid colors behave differently than gray' },

{ key: 'angleV', default: 0.8, min: 0.0, max: 2.0, step: 0.1,
  group: 'State Angles', label: 'Variance → Angle Weight',
  hint: 'How much L variance affects rotation. Borders have tangential flow' },
```

---

## Expected Behaviors

### With L-Weighted Angle (`angleL` high)
- Bright regions rotate one way
- Dark regions rotate opposite way
- **Domain separation** by luminance
- No uniform global spiral

### With Momentum-Weighted Angle (`angleM` high)
- Rising L → one rotation direction
- Falling L → opposite rotation
- **Phase-dependent dynamics**
- Oscillation creates vortex pairs

### With Saturation-Weighted Angle (`angleS` high)
- Gray cells adopt directly (fast mixing)
- Vivid cells rotate strongly
- **Color-dependent topology**
- Creates color domains with sharp boundaries

### With Variance-Weighted Angle (`angleV` high)
- Flat regions diffuse directly
- Borders have tangential flow
- **Automatic obstacle avoidance**
- Flow naturally preserves features

### With All Weights Active (Composite)
- Rich heterogeneous dynamics
- Different regions behave differently
- **Emergent complexity**
- Non-degenerate patterns

---

## Design Philosophy Alignment

**Is this pure emergence?** ✅ YES

1. **Reads actual state**: L, M, saturation, variance all exist in field
2. **No hardcoded patterns**: Angle emerges from local conditions
3. **Could physics do this?**: YES - like magnetic/electric fields rotating particles based on charge/spin
4. **Local rule**: Each cell computes angle from own state + immediate neighbors
5. **Non-degenerate**: Different states → different angles → heterogeneous dynamics

**Why better than perpendicular?**
- Perpendicular is ONE fixed angle (90°)
- State-dependent uses CONTINUOUS angle range [-180°, +180°]
- Creates **spatial heterogeneity** instead of uniform spirals

---

## Implementation Plan

### Step 1: Add Helper Functions (5 min)
- `rotate_vector()`
- `compute_state_angle()`

### Step 2: Add Parameters (2 min)
- Four angle weight parameters

### Step 3: Replace Perpendicular Forces (15 min)
- Diversity kick
- Anti-consensus
- Vorticity
- Momentum coupling

### Step 4: Test & Tune (ongoing)
- Start with single weight active
- Gradually add others
- Observe emergent patterns

**Total time**: ~25 minutes

---

## Alternative: Simpler Version

If full composite is too complex, start with **just momentum-driven angle**:

```glsl
// Simplest version - just use L momentum
float angle = (L_new - M) * u_angleGain * PI * 2.0;

// Apply same angle to ALL rotational forces
vec2 rotated = rotate_vector(base_direction, angle);
```

**One parameter**: `u_angleGain` (default: 1.0, range: -2 to 2)

**Effect**: Oscillation phase determines rotation direction globally, but each cell oscillates independently → heterogeneous

---

## Questions for User

1. **Start simple or full composite?**
   - Simple: Just momentum-driven angle (1 param)
   - Full: All four factors (4 params)

2. **Should vorticity ADD to angle or REPLACE it?**
   - Add: `angle = state_angle + circulation * scale`
   - Replace: `angle = circulation * scale` (keep vorticity as is)

3. **Apply to all forces or selectively?**
   - All: Diversity, anti-consensus, vorticity, momentum coupling
   - Some: User specifies which ones get state-dependent angle

Ready to implement when you give the word!
