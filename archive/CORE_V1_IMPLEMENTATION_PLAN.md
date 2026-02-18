# Core V1 Implementation Plan

## Executive Summary

**Problem**: CoreV1 engine degenerates to static, uniform state within seconds.

**Root Cause**: 
- No temporal memory (pure feedforward)
- All dynamics are stabilizing (diffusion + global attractor)
- Growth-dependent terms vanish at equilibrium

**Solution**: Add momentum channel (M) to cell state for oscillatory dynamics.

**Expected Result**: Sustained, non-degenerate patterns with continuous color flow.

---

## Design Documents Reference

### 1. [CORE_V1_FIX_DESIGN.md](./CORE_V1_FIX_DESIGN.md)
- Architecture overview
- State encoding scheme (L, a, b, M)
- Parameter definitions
- Success metrics

### 2. [CORE_V1_SHADER_PSEUDOCODE.md](./CORE_V1_SHADER_PSEUDOCODE.md)
- Complete shader implementations
- Helper functions
- Encoding/decoding details
- Testing checklist

### 3. [CORE_V1_MATHEMATICS.md](./CORE_V1_MATHEMATICS.md)
- Mathematical proof of why old system fails
- Phase space analysis of new system
- Non-monotonic function explanations
- Stability analysis

---

## Implementation Phases

### Phase 1: State Encoding Update
**Goal**: Change state texture to store (L, a, b, M) explicitly

**Files to modify**:
- `src/render/coreV1Shaders.js`
  - Update `coreV1TransitionShader` to output (L, a, b, M)
  - Update `coreV1DisplayShader` to convert L,a,b → RGB

**Changes**:
```javascript
// Transition shader output (line ~192)
// OLD:
gl_FragColor = vec4(abv2rgb(abNew, lNew), 1.0);

// NEW:
float a_encoded = abNew.x * 0.5 + 0.5;
float b_encoded = abNew.y * 0.5 + 0.5;
gl_FragColor = vec4(lNew, a_encoded, b_encoded, M_new);
```

```javascript
// Display shader (entire replacement)
export const coreV1DisplayShader = `
precision highp float;
uniform sampler2D u_texture;
varying vec2 v_texCoord;

vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
    vec4 state = texture2D(u_texture, v_texCoord);
    float L = state.r;
    float a = state.g * 2.0 - 1.0;
    float b = state.b * 2.0 - 1.0;
    
    float s = clamp(length(vec2(a, b)), 0.0, 1.0);
    float h = fract(atan(b, a) / 6.28318530718);
    
    vec3 rgb = hsv2rgb(vec3(h, s, clamp(L, 0.02, 0.98)));
    gl_FragColor = vec4(rgb, 1.0);
}
`;
```

**Test**: Verify display still shows colors (may be incorrect initially, but should render).

---

### Phase 2: Add Variance to Convolution
**Goal**: Compute L_variance in convolution shader

**File**: `src/render/coreV1Shaders.js` → `coreV1ConvolutionShader`

**Changes**:
```javascript
// Around line 72-93, modify main loop

void main() {
    // ... existing center read ...
    float lSum = lum(center.rgb);
    float lSqSum = lum(center.rgb) * lum(center.rgb);  // NEW
    vec2 abSum = rgb2ab(center.rgb);
    float wSum = 1.0;

    const int N = 12;
    const float GOLD = 2.39996323;
    for (int i = 0; i < N; i++) {
        // ... existing sampling ...
        float l = lum(c);
        lSum += l * w;
        lSqSum += l * l * w;  // NEW
        abSum += rgb2ab(c) * w;
        wSum += w;
    }

    float lMean = lSum / wSum;
    float lSqMean = lSqSum / wSum;  // NEW
    float lVariance = max(0.0, lSqMean - lMean * lMean);  // NEW
    float lStddev = sqrt(lVariance);  // NEW
    vec2 abMean = abSum / wSum;
    
    // Pack: (lMean, lStddev, abMean.x, abMean.y)
    // Need to encode abMean to [0,1]
    gl_FragColor = vec4(
        lMean, 
        lStddev, 
        abMean.x * 0.5 + 0.5,  // NEW encoding
        abMean.y * 0.5 + 0.5   // NEW encoding
    );
}
```

**Test**: Read convolution texture, verify lStddev is high near edges, low in flat regions.

---

### Phase 3: Implement Memory (M) Update
**Goal**: Add exponential moving average for M

**File**: `src/render/coreV1Shaders.js` → `coreV1TransitionShader`

**Add uniform**:
```javascript
uniform float u_memoryDecay;
```

**Add to engine** (`src/core/coreV1Engine.js` line ~119):
```javascript
gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_memoryDecay'), 
    params.memoryDecay ?? 0.05);
```

**In shader** (after computing L_new):
```javascript
float M = current.a;  // OLD: unused
// Update M to track L slowly
float M_new = M * (1.0 - u_memoryDecay) + lNew * u_memoryDecay;
```

**Initialize M** on reset (`src/core/coreV1Engine.js` → `reset()` method):
```javascript
reset() {
    const gl = this.gl;
    // Create temporary canvas to set initial state with M = L
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.originalImageData, 0, 0);
    const imgData = tempCtx.getImageData(0, 0, this.width, this.height);
    
    // Set A channel (M) to R channel (L from luminance)
    for (let i = 0; i < imgData.data.length; i += 4) {
        const L = (imgData.data[i] * 0.299 + 
                   imgData.data[i+1] * 0.587 + 
                   imgData.data[i+2] * 0.114) / 255.0;
        imgData.data[i+3] = Math.floor(L * 255);  // M = L initially
    }
    
    gl.bindTexture(gl.TEXTURE_2D, this.stateTexture0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgData);
    // ... same for stateTexture1 ...
    this.currentStateIndex = 0;
    this.frameCount = 0;
}
```

**Test**: Log M and L values, verify M lags L over time.

---

### Phase 4: Implement Oscillatory L Dynamics
**Goal**: Replace stabilizing terms with oscillation + non-monotonic terms

**File**: `src/render/coreV1Shaders.js` → `coreV1TransitionShader`

**Add uniforms**:
```javascript
uniform float u_historyOscillationGain;
uniform float u_divergenceGain;
uniform float u_moderationGain;
uniform float u_varianceAmplifyGain;
uniform float u_flatBreakupGain;
```

**Replace L update** (lines ~165-171):
```javascript
// Decode convolution with variance
float lMean = conv.r;
float lStddev = conv.g;
vec2 abMean = vec2(conv.b * 2.0 - 1.0, conv.a * 2.0 - 1.0);

float dL = 0.0;

// (A) Diffusion
dL += (lMean - lNow) * u_coreLDiffGain;

// (B) History oscillation - NEW
float deviation = lNow - M;
dL += -deviation * u_historyOscillationGain;

// (C) Non-monotonic conformity - NEW
float diff = lNow - lMean;
float absDiff = abs(diff);
if (absDiff < 0.15) {
    dL += -sign(diff) * u_divergenceGain;
} else if (absDiff > 0.4) {
    dL += -sign(diff) * u_moderationGain;
}

// (D) Variance-driven - NEW
float varianceBoost = lStddev * u_varianceAmplifyGain;
float flatness = 1.0 - lStddev;
float flatPenalty = flatness * u_flatBreakupGain;
dL += (varianceBoost - flatPenalty) * sign(dL);

// OLD: Remove these lines
// lTarget += (0.5 - lNow) * u_coreLReactionGain;
// lTarget += (satNow - 0.25) * u_coreColorToLGain;

// Apply with rate limiting
float dLClamped = clamp(dL, -u_coreMaxDeltaL, u_coreMaxDeltaL);
float lNew = clamp(lNow + dLClamped * u_coreLRate * u_deltaTime * (1.0 - 0.6 * barrier), 0.0, 1.0);
float growth = lNew - lNow;
```

**Add to engine uniforms**:
```javascript
gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_historyOscillationGain'), 
    params.historyOscillationGain ?? 0.8);
gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_divergenceGain'), 
    params.divergenceGain ?? 0.3);
// ... etc for all new params
```

**Test**: Run simulation, verify L oscillates around M (plot time series).

---

### Phase 5: Fix Chroma Dynamics
**Goal**: Non-monotonic adoption + momentum-driven rotation

**File**: `src/render/coreV1Shaders.js` → `coreV1TransitionShader`

**Replace chroma update** (lines ~173-184):
```javascript
vec2 d = abMean - abNow;
float dMag = length(d);
vec2 dAB = vec2(0.0);

// (A) Non-monotonic adoption
float adoptStrength = 0.0;
if (dMag < 0.1) {
    adoptStrength = 0.2;
} else if (dMag < 0.4) {
    adoptStrength = 1.5;
} else {
    adoptStrength = 0.4;
}
dAB += d * adoptStrength * u_coreAdoptGain;

// (B) Rotation driven by L momentum (not growth)
vec2 tangent = dMag > 1.0e-5 ? normalize(vec2(-d.y, d.x)) : vec2(0.0);
float L_momentum = lNew - M;  // CHANGED: use M not lNow
dAB += tangent * L_momentum * u_coreGrowthHueCoupling;

// (C) Saturation coupling
float s = length(abNow);
float s_target = 0.3 + 0.5 * lNew;
vec2 s_dir = s > 1.0e-5 ? abNow / s : vec2(0.0);
dAB += s_dir * (s_target - s) * 0.3;  // New param later

// (D) Subtle noise
vec2 noiseVec = hash22(v_texCoord * 1000.0 + float(frameCount) * 0.01) * 2.0 - 1.0;
float noiseScale = 0.02 * (1.0 - abs(L_momentum * 5.0));
dAB += noiseVec * noiseScale;

// OLD: Remove repel term entirely
```

**Add hash function** to shader:
```javascript
vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
}
```

**Pass frame counter**:
In engine, add uniform:
```javascript
gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_frameCount'), 
    this.frameCount);
```

**Test**: Verify colors continue flowing even when L_mean is stable.

---

### Phase 6: Parameter Integration
**Goal**: Add new params to tunableParams and UI

**File**: `src/ui/tunableParams.js`

Add new parameters to the array (around line 100+):
```javascript
// Memory
{ key: 'memoryDecay', default: 0.05, min: 0.01, max: 0.2, step: 0.01, 
  group: 'Core Dynamics', label: 'Memory Decay', hint: 'How fast momentum tracks L' },

// L Dynamics
{ key: 'historyOscillationGain', default: 0.8, min: 0.0, max: 2.0, step: 0.1,
  group: 'Core Dynamics', label: 'Oscillation Strength', hint: 'Anti-damping force' },
{ key: 'divergenceGain', default: 0.3, min: 0.0, max: 1.0, step: 0.05,
  group: 'Core Dynamics', label: 'Divergence Pressure', hint: 'Break uniformity' },
{ key: 'moderationGain', default: 0.2, min: 0.0, max: 1.0, step: 0.05,
  group: 'Core Dynamics', label: 'Moderation', hint: 'Limit extremes' },
{ key: 'varianceAmplifyGain', default: 0.5, min: 0.0, max: 1.0, step: 0.05,
  group: 'Core Dynamics', label: 'Variance Boost', hint: 'Amplify features' },
{ key: 'flatBreakupGain', default: 0.2, min: 0.0, max: 1.0, step: 0.05,
  group: 'Core Dynamics', label: 'Flat Breakup', hint: 'Destabilize uniform areas' },
```

UI will auto-generate sliders from tunableParams.

**Test**: Verify sliders appear and can adjust parameters in real-time.

---

## Testing Protocol

### Test 1: State Encoding
1. Run for 10 frames
2. Read state texture pixels
3. Verify R channel ∈ [0,1] (L)
4. Verify G,B channels vary (a,b encoded)
5. Verify A channel ∈ [0,1] (M)

### Test 2: Memory Lag
1. Track single pixel (center)
2. Plot L(t) and M(t) over 100 frames
3. Verify M lags L (phase delay visible)
4. Verify M is smoother than L

### Test 3: Oscillation
1. Run 500 frames
2. Measure mean(|dL|) every 50 frames
3. Should NOT decay to zero
4. Should remain > 0.001

### Test 4: Color Persistence
1. Initialize with diverse image
2. Run 500 frames
3. Measure hue variance: stddev(H)
4. Should remain > 0.1 (not collapse to uniform)

### Test 5: No Freeze
1. Run 1000 frames
2. Every 100 frames, measure:
   - Activity: mean(|dL| + |dAB|)
   - Variance: stddev(L)
3. Both should oscillate but not trend to zero

---

## Rollback Plan

If new version fails:
1. Git revert to current coreV1 state
2. Create branch: `corev1-oscillatory-attempt`
3. Debug phase by phase using test protocol
4. Check each phase independently

---

## Expected Behavior After Fix

### Visual
- Continuous color flow and rotation
- Borders that pulse and move
- Patches that grow, shrink, merge, split
- Never settles into static state

### Metrics (at 1000 frames)
- Activity: mean(|dL|) ≈ 0.002-0.01 (sustained)
- Color diversity: stddev(H) ≈ 0.15-0.30 (maintained)
- Spatial structure: stddev(L) ≈ 0.08-0.20 (heterogeneous)
- Oscillation period: ≈ 20-80 frames (depending on params)

---

## Parameter Tuning Guide

After implementation, tune in this order:

1. **memoryDecay** (0.02-0.1)
   - Lower = slower oscillations, larger amplitude
   - Higher = faster oscillations, smaller amplitude
   - Start: 0.05

2. **historyOscillationGain** (0.5-1.5)
   - Strength of oscillation
   - Too low → converges
   - Too high → chaotic
   - Start: 0.8

3. **coreLDiffGain** (0.3-1.0)
   - Spatial smoothing
   - Higher = larger patterns
   - Lower = finer detail
   - Start: 0.5

4. **divergenceGain** (0.2-0.5)
   - Anti-uniformity
   - Higher = more diversity
   - Start: 0.3

5. **Chroma params** (adoptGain, rotationGain)
   - Tune after L dynamics stable
   - Balance propagation vs rotation

---

## Success Criteria

✅ System is **fixed** when:
1. No parameter combination leads to frozen state
2. Color diversity maintained for 1000+ frames
3. Visual output shows continuous motion
4. Math predictions match observed behavior
5. Passes all 5 tests in protocol

---

## Next Action

Begin Phase 1: Update state encoding in shaders.

Estimated time per phase:
- Phase 1: 30 min
- Phase 2: 20 min
- Phase 3: 30 min
- Phase 4: 45 min
- Phase 5: 45 min
- Phase 6: 30 min
- Testing/tuning: 60 min

**Total: ~4 hours** for complete fix.

Start with Phase 1 now?
