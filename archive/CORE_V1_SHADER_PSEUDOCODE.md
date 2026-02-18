# Core V1 Shader Pseudocode

Detailed implementation guide for the fixed cellular automaton shaders.

---

## State Format

```
State Texture (RGBA):
  R = L     ∈ [0, 1]      luminance/density
  G = a     ∈ [0, 1]      chroma x (remapped from [-1, 1])
  B = b     ∈ [0, 1]      chroma y (remapped from [-1, 1])
  A = M     ∈ [0, 1]      momentum/memory (slow EMA of L)

Encoding:
  a_stored = (a_real + 1.0) / 2.0
  b_stored = (b_real + 1.0) / 2.0

Decoding:
  a_real = a_stored * 2.0 - 1.0
  b_real = b_stored * 2.0 - 1.0
```

---

## 1. Convolution Shader (Neighborhood Statistics)

```glsl
// INPUT: u_currentState (RGBA with L,a,b,M)
// OUTPUT: neighborhood stats

void main() {
    vec4 center = texture2D(u_currentState, v_texCoord);
    float L = center.r;
    float a = center.g * 2.0 - 1.0;  // Decode
    float b = center.b * 2.0 - 1.0;
    float M = center.a;
    
    // Accumulators
    float L_sum = L;
    float L_sqSum = L * L;
    vec2 ab_sum = vec2(a, b);
    float w_sum = 1.0;
    
    // Sample neighborhood (golden angle spiral)
    for (int i = 0; i < N_SAMPLES; i++) {
        vec2 offset = spiralSample(i, u_radius);
        vec4 neighbor = texture2D(u_currentState, v_texCoord + offset);
        
        float nL = neighbor.r;
        float na = neighbor.g * 2.0 - 1.0;
        float nb = neighbor.b * 2.0 - 1.0;
        
        float weight = distanceWeight(i);
        
        L_sum += nL * weight;
        L_sqSum += nL * nL * weight;
        ab_sum += vec2(na, nb) * weight;
        w_sum += weight;
    }
    
    // Compute stats
    float L_mean = L_sum / w_sum;
    float L_sq_mean = L_sqSum / w_sum;
    float L_variance = max(0.0, L_sq_mean - L_mean * L_mean);
    float L_stddev = sqrt(L_variance);
    vec2 ab_mean = ab_sum / w_sum;
    
    // Output (need to pack 5 values into RGBA)
    // Option: use two convolution passes, or pack creatively
    // For now: (L_mean, L_stddev, ab_mean.x, ab_mean.y)
    gl_FragColor = vec4(
        L_mean,
        L_stddev,
        ab_mean.x * 0.5 + 0.5,  // Encode to [0,1]
        ab_mean.y * 0.5 + 0.5
    );
}
```

**Key points**:
- Variance computation requires E[L²] - (E[L])²
- Need to encode/decode chroma properly
- Output stats for use in transition shader

---

## 2. Transition Shader (State Update)

```glsl
// INPUTS:
//   u_currentState - (L, a, b, M)
//   u_convolution - (L_mean, L_stddev, ab_mean.x, ab_mean.y)
//   u_originalImage - source (optional bias)
//   u_edgeTexture - structure (optional bias)
//   uniforms - all parameters

void main() {
    // ===== DECODE INPUTS =====
    vec4 state = texture2D(u_currentState, v_texCoord);
    vec4 conv = texture2D(u_convolution, v_texCoord);
    
    float L = state.r;
    float a = state.g * 2.0 - 1.0;
    float b = state.b * 2.0 - 1.0;
    float M = state.a;
    
    float L_mean = conv.r;
    float L_stddev = conv.g;
    float a_mean = conv.b * 2.0 - 1.0;
    float b_mean = conv.a * 2.0 - 1.0;
    vec2 ab = vec2(a, b);
    vec2 ab_mean = vec2(a_mean, b_mean);
    
    // ===== L UPDATE =====
    float dL = 0.0;
    
    // (A) Diffusion - smooth toward neighbors
    float diffusionTerm = (L_mean - L) * u_diffusionGain;
    dL += diffusionTerm;
    
    // (B) History oscillation - anti-damping
    // L wants to oscillate around M (the slow-moving trend)
    float deviation = L - M;
    float oscillationTerm = -deviation * u_historyOscillationGain;
    dL += oscillationTerm;
    
    // (C) Non-monotonic conformity
    float diff = L - L_mean;
    float absDiff = abs(diff);
    float conformityTerm = 0.0;
    
    if (absDiff < 0.15) {
        // Too similar to neighbors - diverge
        conformityTerm = -sign(diff) * u_divergenceGain;
    } else if (absDiff > 0.4) {
        // Too different from neighbors - moderate
        conformityTerm = -sign(diff) * u_moderationGain;
    }
    // else: sweet spot - no conformity pressure
    
    dL += conformityTerm;
    
    // (D) Variance-driven dynamics
    // High variance (borders/features) - amplify changes
    float varianceBoost = L_stddev * u_varianceAmplifyGain;
    // Low variance (flat regions) - destabilize
    float flatness = 1.0 - L_stddev;
    float flatPenalty = flatness * u_flatBreakupGain;
    // Apply boost/penalty in direction of current change
    float varianceTerm = (varianceBoost - flatPenalty) * sign(dL);
    dL += varianceTerm;
    
    // Apply rate and clamp
    float L_new = L + dL * u_L_rate * u_deltaTime;
    L_new = clamp(L_new, 0.0, 1.0);
    float L_change = L_new - L;
    
    // ===== CHROMA UPDATE =====
    vec2 d = ab_mean - ab;
    float d_mag = length(d);
    vec2 d_norm = d_mag > 1e-5 ? d / d_mag : vec2(0.0);
    
    vec2 dAB = vec2(0.0);
    
    // (A) Non-monotonic adoption
    float adoptStrength = 0.0;
    if (d_mag < 0.1) {
        adoptStrength = 0.2;  // Preserve local diversity
    } else if (d_mag < 0.4) {
        adoptStrength = 1.5;  // Propagate color waves
    } else {
        adoptStrength = 0.4;  // Maintain sharp boundaries
    }
    vec2 adoptTerm = d * adoptStrength * u_adoptGain;
    dAB += adoptTerm;
    
    // (B) Tangential rotation (hue flow)
    // Rotate perpendicular to gradient direction
    // Speed proportional to L momentum
    vec2 tangent = d_mag > 1e-5 ? vec2(-d.y, d.x) / d_mag : vec2(0.0);
    float L_momentum = L_new - M;  // Positive if growing
    vec2 rotationTerm = tangent * L_momentum * u_rotationGain;
    dAB += rotationTerm;
    
    // (C) Saturation coupling to L
    // High L should push toward higher saturation
    // Low L should reduce saturation
    float s = length(ab);
    float s_target = 0.3 + 0.5 * L_new;
    vec2 s_direction = s > 1e-5 ? ab / s : vec2(0.0);
    vec2 saturationTerm = s_direction * (s_target - s) * u_saturationGain;
    dAB += saturationTerm;
    
    // (D) Subtle noise (position-based deterministic)
    // Use hash function for pseudorandom per-pixel noise
    // Stronger when M is far from flow (stable regions)
    vec2 noise = hash22(v_texCoord * 1000.0 + u_time * 0.01) * 2.0 - 1.0;
    float noiseStrength = (1.0 - abs(L_momentum * 5.0));  // Less noise in active regions
    vec2 noiseTerm = noise * u_noiseGain * noiseStrength;
    dAB += noiseTerm;
    
    // Apply rate and clamp
    vec2 ab_new = ab + dAB * u_color_rate * u_deltaTime;
    // Clamp saturation to [0, 1]
    float s_new = length(ab_new);
    if (s_new > 1.0) {
        ab_new = ab_new / s_new;
    }
    
    // ===== MEMORY UPDATE =====
    // Exponential moving average - M slowly tracks L
    float M_new = M * (1.0 - u_memoryDecay) + L_new * u_memoryDecay;
    
    // ===== OPTIONAL SOURCE BIAS =====
    // Only if params are non-zero
    if (u_sourceColorAdherence > 0.0) {
        vec3 srcRGB = texture2D(u_originalImage, v_texCoord).rgb;
        vec2 ab_src = rgb2ab(srcRGB);
        float srcRate = u_sourceColorAdherence * 0.1 * u_deltaTime;
        ab_new = mix(ab_new, ab_src, srcRate);
    }
    
    if (u_sourceStructureInfluence > 0.0) {
        float edge = texture2D(u_edgeTexture, v_texCoord).r;
        float barrier = edge * u_boundaryStrength * u_sourceStructureInfluence;
        // Reduce changes near edges
        L_new = mix(L_new, L, barrier * 0.5);
        ab_new = mix(ab_new, ab, barrier * 0.5);
    }
    
    // ===== ENCODE OUTPUT =====
    float a_encoded = ab_new.x * 0.5 + 0.5;
    float b_encoded = ab_new.y * 0.5 + 0.5;
    
    // For display, convert L,a,b to RGB
    vec3 displayRGB = lab2rgb(L_new, ab_new);
    
    // But STATE stores (L, a, b, M) encoded
    gl_FragColor = vec4(L_new, a_encoded, b_encoded, M_new);
}
```

---

## 3. Display Shader

```glsl
// INPUT: u_currentState (L, a_encoded, b_encoded, M)
// OUTPUT: RGB for display

void main() {
    vec4 state = texture2D(u_currentState, v_texCoord);
    float L = state.r;
    float a = state.g * 2.0 - 1.0;
    float b = state.b * 2.0 - 1.0;
    
    // Convert (L, a, b) to RGB for visualization
    vec3 rgb = lab2rgb(L, vec2(a, b));
    
    gl_FragColor = vec4(rgb, 1.0);
}

// Helper: convert (L, a, b) to RGB via HSV
vec3 lab2rgb(float L, vec2 ab) {
    float s = clamp(length(ab), 0.0, 1.0);
    float h = fract(atan(ab.y, ab.x) / 6.28318530718);
    
    // Convert HSV to RGB
    vec3 hsv = vec3(h, s, clamp(L, 0.02, 0.98));
    vec3 p = abs(fract(hsv.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    vec3 rgb = hsv.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), hsv.y);
    
    return rgb;
}
```

---

## 4. Hash Function for Noise

```glsl
// Deterministic pseudorandom based on position
vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
}
```

---

## Parameter Defaults

```javascript
{
    // Spatial
    radius: 0.03,
    deltaTime: 0.016,
    
    // L dynamics
    diffusionGain: 0.5,
    historyOscillationGain: 0.8,
    divergenceGain: 0.3,
    moderationGain: 0.2,
    varianceAmplifyGain: 0.5,
    flatBreakupGain: 0.2,
    L_rate: 1.0,
    
    // Chroma dynamics
    adoptGain: 1.0,
    rotationGain: 0.8,
    saturationGain: 0.3,
    noiseGain: 0.02,
    color_rate: 1.0,
    
    // Memory
    memoryDecay: 0.05,
    
    // Optional bias (default off)
    sourceColorAdherence: 0.0,
    sourceStructureInfluence: 0.0,
    boundaryStrength: 0.0
}
```

---

## Key Implementation Details

### 1. Chroma Encoding/Decoding
Always remap properly:
```glsl
// Store: [-1, 1] → [0, 1]
stored = (real + 1.0) * 0.5;

// Load: [0, 1] → [-1, 1]
real = stored * 2.0 - 1.0;
```

### 2. Variance Computation
Need second moment:
```glsl
L_mean = sum(L * w) / sum(w)
L_sq_mean = sum(L*L * w) / sum(w)
variance = L_sq_mean - L_mean * L_mean
```

### 3. Sign Function Safety
```glsl
// Always check for zero before sign()
sign_safe = x == 0.0 ? 0.0 : sign(x);
```

### 4. Memory Initialization
On reset, set M = L initially:
```glsl
// First frame
state.a = state.r;  // M = L
```

### 5. Time for Noise
Pass frame counter or time uniform:
```glsl
uniform float u_time;  // Increments each frame
```

---

## Testing Checklist

After implementation:

1. **State encoding**: Verify pixels store (L, a, b, M) correctly
2. **M tracks L**: Check that M lags behind L changes
3. **Variance computed**: Flat regions show low L_stddev
4. **Oscillations**: L should bounce around M, not converge
5. **Color flow**: Hues should rotate/propagate continuously
6. **No freeze**: Run 1000 frames, verify activity never stops
7. **Parameter sweep**: Test various param combinations for robustness

---

## Why This Works

1. **M lags L** (memoryDecay = 0.05)
   - Creates delayed restoring force
   - L overshoots M, then undershoots → oscillation

2. **Non-monotonic adoption**
   - Allows waves AND boundaries to coexist
   - Medium differences propagate strongly
   - Small and large differences resist

3. **Variance drives instability**
   - Flat regions get broken up (flatBreakupGain)
   - Features get amplified (varianceAmplifyGain)

4. **Tangential rotation**
   - Colors flow perpendicular to gradients
   - Coupled to L_momentum (never stops if L oscillates)

5. **Divergence pressure**
   - Prevents total uniformity
   - Similar neighbors repel slightly

This creates a **limit cycle** rather than a fixed point.
