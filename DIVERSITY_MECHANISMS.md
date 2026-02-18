# Diversity Mechanisms for CoreV1 CA

## Current Problem

The system shows initial movement but diffuses into uniform color patches. Colors and patterns homogenize despite the oscillatory L dynamics working.

**Root Issue**: While L oscillates preventing stasis, chroma dynamics still converge to local averages. The non-monotonic adoption isn't strong enough, and there's insufficient pressure maintaining diversity.

---

## Design Philosophy: Emergence vs Hardcoding

**Goal**: Create mechanisms where complex patterns **emerge** from simple local rules, not from hardcoded global behaviors.

### The Core Question: What Is Emergence?

**Pure CA principles**:
- ✅ State-driven: All behavior comes from cell state + neighbor states
- ✅ Local rules: No global coordination or external fields
- ✅ Emergent structure: Patterns arise from interactions, not presets
- ❌ Avoid: Hardcoded phases, predetermined wave directions, external clocks

### The Nature Test: Could Physics Do This?

**Emergent mechanisms feel natural** because they're things that happen in physical/chemical systems:
- Diffusion along gradients (chemotaxis)
- Surface tension from curvature (Laplacian)
- Vortices from shear asymmetry
- Variance-triggered responses (homeostasis)

**Imposed mechanisms feel artificial** because they require external coordination:
- Phase detection (needs a protractor and clock)
- Global synchronization (needs a conductor)
- Predetermined directions (needs a compass)

### Why Phase Bothers Us

When we write `phase = atan(dL_dt, L - M)`, we're imposing an **observer's coordinate system**. Phase is something we *see* when we watch oscillators, but it's not something the cell "knows about." 

It's like saying "cells at 90° phase repel" - but the cell doesn't have a protractor! It only knows: "What am I? What are my neighbors?"

### Why Direction Doesn't Bother Us

When we write `gradient = (ab_east - ab_west)`, we're **reading something that exists** in the field. The gradient is there in the spatial distribution. The cell is just "sensing" which way concentration changes around it.

This is **chemotaxis** - literally how bacteria work. Pure local physics.

### The Spectrum of Emergence

**Most Pure** (Like Physics):
1. ✅ **Spatial gradients**: Reading existing field geometry
2. ✅ **Curvature/Laplacian**: Second-order spatial structure
3. ✅ **Local variance**: Comparing self to immediate history
4. ✅ **Asymmetry forces**: Net imbalance creates motion

**Middle Ground** (Requires Computation but Still Local):
5. ⚠️ **Multi-scale momentum**: Needs memory at different rates (but still self-state)
6. ⚠️ **Directional memory**: Remembering recent flow (but just storing a vector)

**Least Pure** (Imposed Coordination):
7. ❌ **Phase detection**: Requires cycle tracking and comparison
8. ❌ **Global clocks**: External time reference beyond discrete steps
9. ❌ **Predetermined patterns**: Literally hardcoding wave shapes

### Guidelines for Pure Emergence

**Ask These Questions:**

1. **"Does this read or invent?"**
   - ✅ Reading: Measuring gradients, curvature, variance that exists
   - ❌ Inventing: Imposing phases, directions, clocks

2. **"Could a cell do this with local sampling?"**
   - ✅ Yes: Sample neighbors, compare to self, respond
   - ❌ No: Requires global coordination or abstract concepts

3. **"Does the behavior emerge or get prescribed?"**
   - ✅ Emerge: Spirals from asymmetry, waves from propagation
   - ❌ Prescribed: "Rotate clockwise," "synchronize to this phase"

4. **"Would this work in a chemical system?"**
   - ✅ Yes: Gradients drive diffusion, curvature creates pressure
   - ❌ No: Chemicals don't know what "phase" they're at

### Why This Matters

**Emergent systems surprise us.** We set up simple rules and get complex, unpredictable patterns. That's the magic of CA.

**Imposed systems do what we told them.** We hardcode spirals, we get spirals. No surprise, no discovery.

**The goal**: Set up conditions where interesting things *must* happen, but we don't know exactly what. Then watch and see what emerges.

### Practical Rule

**If you can explain the mechanism to someone without using abstract math terms (phase, frequency, amplitude), it's probably emergent.**

- ✅ "Cells move toward higher concentration"
- ✅ "Flat regions become unstable"
- ✅ "Imbalanced pulls create rotation"
- ❌ "Cells synchronize phase to π/2 offset"
- ❌ "Oscillators couple through shared frequency"

---

## Mechanism Categories

### Type 1: Direct State Tracking (Most CA-Native)
Cell maintains statistics about its own history. Rules respond to those statistics.

### Type 2: Interaction Modulation (Emergent)
Cell state modulates HOW it interacts with neighbors. Direction, strength, and range emerge from local conditions.

### Type 3: External Coordination (Least CA-Native)
Global phases, synchronized clocks, predetermined wave directions.
**Avoid these** - they don't emerge, they're imposed.

---

## Proposed Mechanisms

### 1. Hue Variance Tracking ⭐️ (Type 1 - Pure CA)

**Concept**: Track temporal variance of own hue. Low variance signals stagnation.

**State Addition**:
```
RGBA: (L, a, b, M)  [current]
→ Need 5th channel for V (variance)

Options:
A) Pack V into unused bits
B) Use separate texture (variance buffer)
C) Approximate V from |dAB| history (no extra channel)
```

**Option C - No Extra Channel** (Recommended):
```glsl
// Encode recent |dAB| magnitude in noise strength
// Higher recent change → lower V → less noise needed
// Lower recent change → higher V → more noise needed

float recent_change = length(ab_now - ab_previous);
// But we don't have ab_previous... unless we use M's lag!

// Alternative: Use M channel for both L-memory AND variance proxy
// Variance proxy: |ab_now - ab_mean| relative to |L_now - M|
float color_deviation = length(ab_now - ab_mean);
float L_deviation = abs(L_now - M);

// When L oscillates but color doesn't → pump up color diversity
float diversity_deficit = max(0.0, L_deviation * 0.5 - color_deviation);
```

**Rules**:
```glsl
// Diversity pressure inversely proportional to local color activity
float diversity_pressure = 0.0;

if (color_deviation < 0.05) {
    // Very uniform color neighborhood
    diversity_pressure = u_diversityGain * (0.05 - color_deviation) * 10.0;
    
    // Push color perpendicular to current ab direction
    vec2 perp = vec2(-ab_now.y, ab_now.x);
    if (length(perp) > 1e-5) {
        perp = normalize(perp);
    }
    dAB += perp * diversity_pressure;
}
```

**Effect**:
- Uniform color regions spontaneously diverge
- Direction of divergence is perpendicular to current color (creates rotation)
- Strength proportional to uniformity
- No extra state needed

**Pros**: 
- Pure emergence - diversity arises when needed
- No extra channels
- Simple to implement

**Cons**: 
- Need to tune gain carefully

---

### 2. Directional Gradient Memory ⭐️⭐️ (Type 2 - Emergent Flow)

**Concept**: Remember which direction color gradients came from. Sample more in that direction when exploring.

**State Encoding**:
```
Can we encode direction without extra channels?
Current: (L, a, b, M)

Idea: Use the ab vector itself as directional bias
- ab vector has magnitude (saturation) and angle (hue)
- The RATE of ab change gives us implicit direction
- Recent ab momentum = implicit flow direction
```

**Implementation (No Extra State)**:
```glsl
// Compute local chroma gradient in convolution shader
// Sample in 4 cardinal directions
vec2 ab_center = vec2(a, b);
vec2 ab_right = sample_ab(coord + vec2(px, 0));
vec2 ab_left = sample_ab(coord - vec2(px, 0));
vec2 ab_up = sample_ab(coord + vec2(0, py));
vec2 ab_down = sample_ab(coord - vec2(0, py));

vec2 gradient_x = (ab_right - ab_left) * 0.5;
vec2 gradient_y = (ab_up - ab_down) * 0.5;

// Gradient magnitude and direction
float grad_mag = length(vec2(length(gradient_x), length(gradient_y)));
// Store gradient info in convolution output somehow...
```

**Problem**: Where to pack gradient direction? Convolution already outputs:
```
(L_mean, L_stddev, a_mean, b_mean)  // all 4 channels used
```

**Solution A - Two-Pass Convolution**:
- Pass 1: (L_mean, L_stddev, a_mean, b_mean) - existing
- Pass 2: (gradient_mag, gradient_angle, Laplacian_L, Laplacian_ab)

**Solution B - Compute Gradient On-The-Fly in Transition**:
```glsl
// In transition shader, sample neighbors directly
vec2 ab_now = decode_ab(current);
vec2 ab_east = decode_ab(texture2D(u_currentState, coord + vec2(px, 0)));
vec2 ab_west = decode_ab(texture2D(u_currentState, coord - vec2(px, 0)));

vec2 gradient = (ab_east - ab_west) * 0.5;
float grad_angle = atan(gradient.y, gradient.x);
```

**Directional Bias Rule**:
```glsl
// Sample more in gradient direction when variance is low
// Sample isotropically when variance is high

float color_activity = length(ab_now - ab_mean);

if (color_activity < 0.1) {
    // Low activity - explore in gradient direction
    // Bias tangent rotation toward gradient
    vec2 gradient_dir = compute_gradient();
    vec2 explore_dir = normalize(gradient_dir);
    
    dAB += explore_dir * u_explorationGain * (0.1 - color_activity);
} else {
    // High activity - let normal dynamics dominate
    // No bias
}
```

**Effect**:
- Colors "remember" which way they were flowing
- Low-activity regions explore in the direction gradients point
- Creates persistent flow patterns
- Anisotropic propagation emerges

**Pros**:
- Truly emergent - direction comes from actual gradients
- Creates flow and directionality without hardcoding
- No extra state needed (compute on-the-fly)

**Cons**:
- More computation per frame
- Need to sample neighbors in transition shader

---

### 3. Multi-Scale Momentum ⭐️⭐️⭐️ (Type 1 - Temporal Richness)

**Concept**: Track L momentum at multiple time scales. Novelty = when scales disagree.

**State Addition**:
```
Current: M (single EMA of L)
Proposed: M_fast, M_slow (two time scales)

Problem: Only 4 RGBA channels, already using all:
R = L
G = a
B = b  
A = M

Can we fake it without extra channels?
```

**Clever Solution - Compute M_slow from M**:
```glsl
// M is already a slow-ish tracker (decay = 0.05)
// Treat M as "fast" momentum
// Compute M_slow in shader as EMA of M itself

// But we need to STORE M_slow somewhere...
// Can't compute it freshly each frame or it's not really slow

// OPTION: Use small auxiliary texture (1x1 pixel per cell region)
// Store M_slow in downsampled buffer

// Actually... can we use texture LOD?
// Sample M from mipmap level 0 = M_fast
// Sample M from mipmap level 2 = M_slow (averaged over 4x4 region)
```

**Implementation**:
```glsl
// Enable mipmaps for state texture
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.generateMipmap(gl.TEXTURE_2D);

// In shader
float M_fast = texture2D(u_currentState, coord).a;
float M_slow = texture2DLod(u_currentState, coord, 2.0).a;  // mip level 2

float scale_divergence = abs(M_fast - M_slow);

// When scales diverge, it means we're in transition
// Boost diversity and exploration
if (scale_divergence > 0.05) {
    float novelty = scale_divergence * u_noveltyGain;
    dAB += hash22(coord) * novelty;  // Add noise
}
```

**Effect**:
- Detects when cell is in "interesting" transitional state
- Fast oscillations on top of slow trends
- Bursting behavior
- Multi-scale patterns

**Pros**:
- Rich temporal structure
- Can use mipmap trick (no extra storage)
- Truly multi-scale emergence

**Cons**:
- Mipmap generation has cost
- Spatial averaging in mipmap may not be ideal

---

### 4. Laplacian-Based Anti-Consensus ⭐️ (Type 2 - Spatial Emergence)

**Concept**: Measure local color field curvature. Flat regions = consensus = boring. Add anti-flatness force.

**Already Computing**:
```
L_stddev in convolution = spatial variance
```

**Need to Add**:
```glsl
// Chroma Laplacian = sum of second derivatives
vec2 ab_center = decode_ab(center);
vec2 ab_north = decode_ab(sample_north);
vec2 ab_south = decode_ab(sample_south);
vec2 ab_east = decode_ab(sample_east);
vec2 ab_west = decode_ab(sample_west);

// Discrete Laplacian
vec2 laplacian_ab = (ab_north + ab_south + ab_east + ab_west) - 4.0 * ab_center;
float curvature = length(laplacian_ab);
```

**Store in Convolution Output**:
```
Current: (L_mean, L_stddev, a_mean, b_mean)
Problem: All channels used

Could replace one:
Option A: (L_mean, L_stddev, ab_curvature, ab_mean_angle)
- Pack ab_mean as angle+magnitude instead of (x,y)
- Free up one channel for curvature
```

**Anti-Consensus Rule**:
```glsl
float curvature = conv.b;  // if we packed it there
vec2 ab_mean_decoded = decode_polar(conv.a);  // magnitude+angle

if (curvature < 0.02) {
    // Very flat color field - boring!
    // Push perpendicular to mean
    vec2 anti_consensus = perpendicular(ab_now - ab_mean);
    dAB += anti_consensus * u_antiConsensusGain;
}
```

**Effect**:
- Flat color regions develop internal structure
- Creates boundaries and features spontaneously
- Pure reaction to spatial geometry

**Pros**:
- Purely spatial/geometric
- No temporal state needed
- Prevents boring flat patches

**Cons**:
- Need to pack convolution output cleverly
- Laplacian computation adds samples

---

### 5. Rotation from Asymmetry (Type 2 - Pure Emergence)

**Concept**: When adoption is asymmetric (pulling harder from one direction than another), rotate perpendicular.

**Implementation**:
```glsl
// Sample directionally
vec2 ab_now = decode_ab(current);
vec2 pull_north = (ab_sample_north - ab_now) * adoption_strength(north);
vec2 pull_south = (ab_sample_south - ab_now) * adoption_strength(south);
vec2 pull_east = (ab_sample_east - ab_now) * adoption_strength(east);
vec2 pull_west = (ab_sample_west - ab_now) * adoption_strength(west);

// Net directional pull
vec2 net_pull = pull_north + pull_south + pull_east + pull_west;

// If pulls are imbalanced, rotate perpendicular to net pull
vec2 rotation_dir = vec2(-net_pull.y, net_pull.x);

// Rotation strength proportional to |net_pull|
float rotation_strength = length(net_pull) * u_rotationFromAsymmetry;

dAB += rotation_dir * rotation_strength;
```

**Effect**:
- Spirals emerge from asymmetric neighborhoods
- Vortices form at boundaries
- Pure consequence of directional adoption differences

**Pros**:
- Completely emergent - no hardcoded rotation
- Creates beautiful spiral patterns
- Simple rule

**Cons**:
- Needs directional sampling (4-8 extra samples)

---

## Recommended Implementation Order

### Phase 1: Quick Wins (No Architecture Changes)

1. **Strengthen Existing Mechanisms**
   - Increase `divergenceGain`: 0.3 → 0.6
   - Increase `flatBreakupGain`: 0.2 → 0.5
   - Increase `noiseGain`: 0.02 → 0.05
   - Tighten non-monotonic adoption thresholds

2. **Add Perpendicular Diversity Pressure**
   - When `|ab_now - ab_mean| < threshold`, push perpendicular
   - Simple addition to transition shader
   - No new state needed

### Phase 2: Spatial Structure (Modest Changes)

3. **Laplacian-Based Anti-Consensus**
   - Compute chroma Laplacian in transition (4 extra samples)
   - Push perpendicular in flat regions
   - OR: Pack curvature into convolution output

4. **Directional Gradient Exploration**
   - Compute gradient on-the-fly
   - Bias exploration toward gradient direction
   - Creates emergent flow

### Phase 3: Advanced Mechanisms (Bigger Changes)

5. **Multi-Scale Momentum** (if mipmap trick works)
   - Enable mipmaps on state texture
   - Sample M at different LOD levels
   - Detect scale divergence

6. **Rotation from Asymmetry**
   - Sample 4-8 neighbors directionally
   - Compute net asymmetric pull
   - Rotate perpendicular

---

## What NOT to Do

### ❌ Phase Coupling
```glsl
float phase = atan(dL_dt, L - M);
// This feels artificial - phases don't emerge, they're imposed
```

**Why avoid**: Phase is a mathematical construct we're imposing. The system doesn't "know" about phases - we're detecting cycles and then hardcoding interaction rules based on cycle position. This is external coordination, not emergence.

### ❌ Predetermined Wave Directions
```glsl
vec2 wave_direction = vec2(cos(time), sin(time));
// This is literally hardcoding motion
```

**Why avoid**: Real waves should emerge from local interactions and propagate based on the medium's properties, not because we drew an arrow.

### ❌ Global Clocks/Synchronization
```glsl
float global_phase = u_time * frequency;
// All cells referencing external time
```

**Why avoid**: CA cells shouldn't share a global clock beyond the discrete time step itself. Synchronization should emerge from local coupling.

---

## Philosophy: Emergence Test

**Question**: "Could this behavior arise in a physical/chemical system?"

**Emergent** ✅:
- Variance tracking → yes (concentrations have history)
- Directional flow → yes (diffusion has momentum)
- Laplacian response → yes (surface tension, curvature)
- Asymmetric rotation → yes (vortices from shear)

**Imposed** ❌:
- Phase locking to external clock → no
- Predetermined directions → no
- Global synchronization signals → no

---

## Concrete Next Steps

### Immediate (Next 30 minutes):

1. **Add Perpendicular Diversity Kick**
   ```glsl
   // In transition shader, after computing dAB
   float uniformity = length(ab_now - ab_mean);
   if (uniformity < 0.05) {
       vec2 perp = normalize(vec2(-ab_now.y, ab_now.x));
       dAB += perp * u_diversityKick * (0.05 - uniformity) * 20.0;
   }
   ```

2. **Increase Existing Gains**
   - Tune defaults in tunableParams.js
   - Test if stronger pressure solves diffusion

### Next Session:

3. **Add Chroma Laplacian**
   - Compute in transition shader (or pack in convolution)
   - Anti-consensus force in flat regions

4. **Directional Gradient Sampling**
   - On-the-fly gradient computation
   - Exploration bias

### Future:

5. **Multi-scale (if needed)**
   - Mipmap experiment
   - Scale divergence detection

6. **Rotation from Asymmetry (if needed)**
   - Directional sampling
   - Perpendicular rotation rule

---

## Expected Emergent Behaviors

With these mechanisms, we should see:

- **Spontaneous diversity**: Uniform patches break up on their own
- **Persistent flows**: Color streams that maintain direction
- **Vortices and spirals**: At domain boundaries (from asymmetry)
- **Multi-scale structure**: Fine detail and large patterns coexisting
- **Turbulent mixing**: Chaotic but structured color evolution
- **Never settling**: Diversity pressure prevents equilibrium

All from **local rules** and **cell state**, with **no hardcoded patterns**.

---

## Parameters to Add

```javascript
// New params for diversity mechanisms
{ key: 'diversityKick', default: 0.5, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core V1 Diversity', label: 'Diversity Kick', 
  hint: 'Perpendicular push in uniform regions' },

{ key: 'antiConsensusGain', default: 0.3, min: 0.0, max: 1.0, step: 0.05,
  group: 'Core V1 Diversity', label: 'Anti-Consensus', 
  hint: 'Force against flat color fields (from Laplacian)' },

{ key: 'explorationGain', default: 0.4, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core V1 Diversity', label: 'Exploration Gain', 
  hint: 'Gradient-directed exploration in low-activity regions' },

{ key: 'rotationFromAsymmetry', default: 0.3, min: 0.0, max: 1.0, step: 0.05,
  group: 'Core V1 Diversity', label: 'Asymmetric Rotation', 
  hint: 'Rotation from imbalanced neighbor pulls (creates spirals)' },

{ key: 'noveltyGain', default: 0.5, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core V1 Diversity', label: 'Novelty Gain', 
  hint: 'Response to multi-scale momentum divergence' },
```

---

## Summary

**Problem**: Colors diffuse to uniformity despite L oscillation working.

**Solution**: Add diversity-maintaining mechanisms that are **purely emergent**:
1. Perpendicular kicks in uniform regions (no extra state)
2. Laplacian anti-consensus (spatial geometry)
3. Gradient-directed exploration (flow emergence)
4. Rotation from asymmetry (vortices)
5. Multi-scale detection (temporal richness)

**Philosophy**: Everything emerges from local state + neighbor interactions. No phases, no global clocks, no predetermined patterns. Just rules that respond to local conditions in ways that prevent uniformity and create structure.

**Next Step**: Start with #1 (perpendicular diversity kick) - it's 5 lines of code and requires no architecture changes.
