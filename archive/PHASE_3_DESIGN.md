# Phase 3: Multi-Stability & Local Structure Formation

**Problem Analysis**: Current system is degenerate in saturation/brightness, only forms large global patterns

---

## 🔴 CURRENT DEGENERACIES

### 1. Saturation Degeneracy
**Problem**: `s_target = 0.1 + 0.7 * abs(L - M)`

If all cells oscillate with similar amplitude (which they will due to diffusion):
- `abs(L - M)` becomes uniform everywhere
- All cells converge to same saturation
- **No spatial heterogeneity in vividness**

### 2. Brightness Degeneracy
**Problem**: 
- L oscillates around local mean
- Diffusion (`coreLDiffGain`) smooths everything
- No multi-stable states → all L values drift toward global average
- **Everything becomes same brightness**

### 3. No Local Structures
**Problem**: All forces are smooth and continuous
- Diffusion smooths
- Adoption propagates
- No discrete boundaries
- No "alive vs dead" or "bright vs dark" domains
- **Only large-scale gradients, no isolated features**

---

## 💡 SOLUTION CATEGORIES

### Option A: Multi-Stable Attractors (Recommended - Pure & Powerful)

**Concept**: L has discrete preferred values (like 0.2, 0.5, 0.8) that act as "energy wells"

**Implementation**:
```glsl
// After computing dL, before clamping:

// Define attractor positions
float attractor1 = 0.15;  // Dark state
float attractor2 = 0.50;  // Mid state  
float attractor3 = 0.85;  // Bright state

// Find nearest attractor
float dist1 = abs(lNow - attractor1);
float dist2 = abs(lNow - attractor2);
float dist3 = abs(lNow - attractor3);
float minDist = min(dist1, min(dist2, dist3));

// Pull toward nearest attractor (weak pull, doesn't override other forces)
if (minDist == dist1) {
    dL += (attractor1 - lNow) * u_attractorGain;
} else if (minDist == dist2) {
    dL += (attractor2 - lNow) * u_attractorGain;
} else {
    dL += (attractor3 - lNow) * u_attractorGain;
}

// OR continuous formulation:
float pull1 = smoothstep(0.3, 0.05, dist1) * (attractor1 - lNow);
float pull2 = smoothstep(0.3, 0.05, dist2) * (attractor2 - lNow);
float pull3 = smoothstep(0.3, 0.05, dist3) * (attractor3 - lNow);
dL += (pull1 + pull2 + pull3) * u_attractorGain;
```

**Effect**:
- L naturally clusters around 0.15, 0.5, 0.85
- Creates **bright, mid, dark domains**
- Boundaries between attractors → localized structures
- Still allows oscillation within attractor basin

**Parameters**:
- `attractorGain` (0.3, range 0-2): Strength of pull
- `attractor1`, `attractor2`, `attractor3`: Positions (could be tunable)

**Pure?** ✅ Yes - like chemical potential wells, phase transitions

---

### Option B: Saturation Heterogeneity (Spatial, Not Temporal)

**Problem**: Saturation tied only to activity → becomes uniform

**Solution**: Tie saturation to spatial structure, not just oscillation

```glsl
// Replace current saturation coupling
float s = length(abNow);
float L_activity = abs(L_momentum);

// NEW: Multiple factors determine target saturation
float s_from_activity = 0.1 + 0.5 * L_activity;          // Still use activity
float s_from_variance = 0.2 + 0.6 * lStddev;             // High variance = vivid
float s_from_isolation = 0.3 + 0.7 * (1.0 - uniformity); // Isolated colors = vivid
float s_from_L = 0.2 + 0.4 * abs(lNow - 0.5);           // Extremes = vivid

// Weighted combination
float s_target = (s_from_activity * u_satActivityWeight + 
                  s_from_variance * u_satVarianceWeight +
                  s_from_isolation * u_satIsolationWeight +
                  s_from_L * u_satLWeight) / 
                 (u_satActivityWeight + u_satVarianceWeight + 
                  u_satIsolationWeight + u_satLWeight);

vec2 s_dir = s > 1.0e-5 ? abNow / s : vec2(0.0);
dAB += s_dir * (s_target - s) * u_saturationGain;
```

**Effect**:
- Different regions have different saturation
- Borders vivid, flat regions muted
- Creates spatial variety

**Parameters**: 4 weights for mixing factors

---

### Option C: Step-Function Boundaries (Discrete State Transitions)

**Concept**: Sharp transitions between states, not smooth gradients

```glsl
// Add to L dynamics
// When L crosses thresholds, amplify the crossing (hysteresis)

float threshold_low = 0.35;
float threshold_high = 0.65;

// If near threshold and moving toward it, amplify
if (lNow < threshold_low && dL < 0.0) {
    // Crossing down - amplify
    dL *= (1.0 + u_boundaryAmplify * (threshold_low - lNow) * 2.0);
}
if (lNow > threshold_high && dL > 0.0) {
    // Crossing up - amplify
    dL *= (1.0 + u_boundaryAmplify * (lNow - threshold_high) * 2.0);
}

// Within threshold band - resist (hysteresis)
if (lNow > threshold_low && lNow < threshold_high) {
    dL *= (1.0 - u_hysteresisGain * (1.0 - abs(lNow - 0.5) * 2.0));
}
```

**Effect**:
- L tends to snap to high or low values
- Creates discrete "on/off" regions
- Sharp boundaries between states

**Parameters**:
- `boundaryAmplify` (0.5, range 0-2): Amplification of threshold crossing
- `hysteresisGain` (0.3, range 0-1): Resistance in middle band

---

### Option D: Pure Black Conditions

**Current**: `lNew = max(0.001, lNew)` prevents true black

**Solution**: Allow black but with recovery mechanism

```glsl
// Remove floor, but add recovery force
lNew = max(0.0, lNew);  // Can go to true zero

// But if L gets very low and stays there, add recovery pressure
if (lNew < 0.05 && lMean < 0.1) {
    // Both self and neighborhood very dark - add recovery
    float darkness = 1.0 - (lNew + lMean) * 0.5 / 0.1;
    dL += darkness * u_darknessRecovery * (hash22(v_texCoord).x - 0.3);
}
```

**Effect**:
- Can have true black regions
- But they don't stay black forever (stochastic recovery)
- Creates "extinction and rebirth" dynamics

**Parameters**:
- `darknessRecovery` (0.1, range 0-0.5): Recovery force strength
- Black floor removed (0.0 instead of 0.001)

---

### Option E: Local Competition (Winner-Take-All)

**Concept**: Strengthen differences, not smooth them

```glsl
// Add to L dynamics
// If L is higher than mean, push it even higher (positive feedback)
// If lower, push lower

float competitionZone = 0.15;  // How far from mean triggers competition

if (abs(diff) > competitionZone) {
    // Outside neutral zone - amplify difference
    float competitionForce = sign(diff) * (abs(diff) - competitionZone) * u_competitionGain;
    dL += competitionForce;
}
```

**Effect**:
- Regions differentiate more strongly
- Creates winners and losers
- Local structure formation

**Parameters**:
- `competitionGain` (0.4, range 0-2): Strength of amplification

---

## 🎯 RECOMMENDED IMPLEMENTATION PLAN

### Phase 3A: Multi-Stable Attractors + Saturation Heterogeneity (HIGH IMPACT)

**Why**: Addresses core degeneracies directly

**Add to shader**:
1. Multi-stable L attractors (3 attractors)
2. Saturation heterogeneity (4 factors)
3. Pure black with recovery

**New parameters**: 8 total
- `attractorGain` (0.3)
- `attractor1`, `attractor2`, `attractor3` (0.15, 0.5, 0.85)
- `satActivityWeight`, `satVarianceWeight`, `satIsolationWeight`, `satLWeight` (1.0 each, for tuning)
- `darknessRecovery` (0.1)

**Expected**:
- Discrete brightness levels (bright/mid/dark domains)
- Spatial variety in saturation
- True blacks possible
- Local isolated structures

**Time**: 45 minutes

---

### Phase 3B: Boundary Sharpening (MEDIUM IMPACT)

**Add**:
1. Step-function amplification at thresholds
2. Local competition

**New parameters**: 3 total
- `boundaryAmplify` (0.5)
- `hysteresisGain` (0.3)
- `competitionGain` (0.4)

**Expected**:
- Sharper boundaries between regions
- Discrete state transitions
- Stronger local features

**Time**: 25 minutes

---

### Phase 3C: Test & Tune

**After 3A + 3B**:
- 11 new parameters total
- Should see:
  - ✅ Saturation varying spatially
  - ✅ Brightness clustering around attractors
  - ✅ Local isolated structures
  - ✅ Both small and large scale features
  - ✅ True blacks in some regions
  - ✅ Constant surprising dynamics (not boring attractors)

---

## 🤔 DYNAMICS ANALYSIS

### Will This Be Constantly Surprising?

**YES**, if:
1. ✅ Attractors create discrete states (bright/mid/dark)
2. ✅ BUT oscillation continues within each basin (not static)
3. ✅ Boundaries between attractors are unstable → migrate
4. ✅ State angle mechanisms create heterogeneous rotation
5. ✅ Competition creates local winners → domains form and dissolve
6. ✅ Darkness recovery prevents total death

**Attractor State Check**:

| Mechanism | Prevents Boring Attractor? | How |
|-----------|---------------------------|-----|
| Multi-stable attractors | ⚠️ Could be boring | BUT combined with oscillation = perpetual motion within basin |
| Saturation heterogeneity | ✅ Yes | Spatial structure prevents uniform saturation |
| State angles | ✅ Yes | Different domains rotate differently |
| Competition | ✅ Yes | Winners and losers constantly shift |
| Darkness recovery | ✅ Yes | Prevents static black regions |
| Pure black allowed | ✅ Yes | Extinction events → rebirth creates novelty |

**Global vs Local Dynamics**:

- **Global**: Overall oscillation frequency, average brightness
- **Local**: Which attractor each region occupies, boundary positions, rotation directions
- **Multi-scale**: Small eddies within large domains

**Attractor Risk Mitigation**:
1. Attractors are WEAK (gain ~ 0.3) → other forces still dominate
2. Oscillation CONTINUES (historyOscillationGain still active)
3. Boundaries are UNSTABLE (contrast amplification creates churn)
4. State angles create HETEROGENEITY (not all regions behave same)

---

## 📊 COMPLETE MECHANISM COUNT

**After Phase 3A + 3B**:
- **Implemented**: 31 mechanisms (20 current + 11 new)
- **Parameters**: 38 total (27 current + 11 new)
- **Coverage**: Will address all core degeneracies

---

## ⚠️ ALTERNATIVE: Simpler Approach

If 11 new params is too much, **minimum viable fix**:

### Just Add Multi-Stable Attractors (2 params)

```glsl
// Simple 3-attractor system
float a1 = 0.2, a2 = 0.5, a3 = 0.8;
float pull = 0.0;
if (lNow < 0.35) pull = (a1 - lNow) * u_attractorGain;
else if (lNow > 0.65) pull = (a3 - lNow) * u_attractorGain;
else pull = (a2 - lNow) * u_attractorGain;
dL += pull;
```

**Parameters**: Just `attractorGain` (0.3)

**Effect**: Still creates discrete brightness levels, which should break up global uniformity

---

## 🎨 UI UPDATE PLAN

### New Parameter Groups

**Group: "Multi-Stability & Structure"** (8 params)
1. `attractorGain` - "↑ Stronger pull to discrete brightness levels. ↓ More continuous brightness"
2. `attractor1` - "Dark state target brightness (0-1)"
3. `attractor2` - "Mid state target brightness (0-1)"
4. `attractor3` - "Bright state target brightness (0-1)"
5. `satVarianceWeight` - "↑ Borders become more vivid. ↓ Borders less saturated"
6. `satIsolationWeight` - "↑ Unique colors more vivid. ↓ Unique colors muted"
7. `satLWeight` - "↑ Extreme brightness more vivid. ↓ Brightness less affects saturation"
8. `darknessRecovery` - "↑ Faster recovery from black. ↓ Black regions persist longer"

**Group: "Boundary Dynamics"** (3 params)
1. `boundaryAmplify` - "↑ Sharper state transitions. ↓ Smoother gradients"
2. `hysteresisGain` - "↑ More resistance to state change. ↓ Easier state flipping"
3. `competitionGain` - "↑ Differences amplified, winner-take-all. ↓ More egalitarian"

---

## 🔬 TESTING CRITERIA

### What to Look For

✅ **Success Indicators**:
- Saturation varies across space (not uniform)
- Brightness clusters around discrete levels (not continuous gradient)
- Small isolated structures form and persist
- Both local features AND large-scale patterns
- True black regions appear (but don't stay forever)
- Constant motion and change (not static)

❌ **Failure Indicators**:
- Still uniform saturation everywhere
- Still smooth brightness gradients
- Only large blobs, no small features
- System goes to single static state
- No blacks, or all black forever

---

## QUESTIONS FOR USER

Before implementing, please decide:

1. **Full implementation (3A + 3B) or minimal (just attractors)?**
   - Full: 11 new params, high impact, more tuning
   - Minimal: 1-2 params, simpler, less flexible

2. **Attractor positions fixed or tunable?**
   - Fixed: Hardcoded at 0.15, 0.5, 0.85
   - Tunable: User can adjust where attractors are

3. **Allow pure blacks (floor = 0.0)?**
   - Yes: More dramatic, risk of total death
   - No: Keep floor at 0.001, safer but less extreme

4. **Priority order if doing incremental?**
   - A: Attractors first, then saturation heterogeneity
   - B: Saturation first, then attractors
   - C: Both together (recommended)

Let me know your preference and I'll implement!
