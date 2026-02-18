# Source Blend Correction

## ❌ WRONG UNDERSTANDING
I initially placed source blend in the **display shader** (post-processing).
This would make it a visual overlay only, not affecting CA dynamics.

## ✅ CORRECT UNDERSTANDING  
Source blend must be in the **transition shader** (CA dynamics).

### Why This Matters

**At 0% sourceBlend**:
- CA evolves purely from its own rules
- Source image is just initial condition
- Eventually may diverge completely from source

**At 50% sourceBlend**:
- Each timestep: CA computes new state
- Then: `state = mix(ca_result, source, 0.5)`
- Creates **TENSION**: CA wants to evolve, source pulls back
- Result: CA dynamics "fight" the source structure
- Creates interesting stylization/warping of source

**At 100% sourceBlend**:
- State locked to source every frame
- CA has no effect (everything resets to source)
- Just displays the source image

---

## 🔧 IMPLEMENTATION

### Transition Shader (coreV1TransitionShader)
```glsl
// At end of shader, AFTER CA dynamics computed lNew, abNew:

vec3 src = texture2D(u_originalImage, v_texCoord).rgb;
float src_L = lum(src);
vec2 src_ab = rgb2ab(src);

// Blend CA result with source (this affects next timestep!)
lNew = mix(lNew, src_L, u_sourceBlend);
abNew = mix(abNew, src_ab, u_sourceBlend);

// Then encode and output
gl_FragColor = vec4(lNew, a_encoded, b_encoded, M_new);
```

### Display Shader (coreV1DisplayShader)
```glsl
// NO SOURCE BLENDING HERE
// Just display the state texture as-is
vec3 rgb = hsv2rgb(...);
gl_FragColor = vec4(rgb, 1.0);
```

---

## 🎨 EXPECTED BEHAVIOR

### sourceBlend = 0% (Pure CA)
- Source sets initial colors
- CA evolves freely
- Over time, may become completely different from source
- Pure emergent dynamics

### sourceBlend = 10-30% (Gentle Anchor)
- CA mostly free to evolve
- Slight pull back toward source each frame
- Creates "remembering" of source structure
- Interesting middle ground

### sourceBlend = 50-70% (Strong Tension)
- CA and source fight equally
- Creates warping/stylization effect
- Source structure persists but CA adds texture/dynamics
- Good for "living photo" effect

### sourceBlend = 90-100% (Source Lock)
- CA barely affects result
- Mostly displays source
- At 100%: CA has no visible effect

---

## 🧪 TESTING

Try with an image:
1. Start at `sourceBlend = 0%`: Watch pure CA from source colors
2. Increase to `30%`: Notice source structure persists more
3. Increase to `70%`: CA creates stylized version of source
4. Set to `100%`: Should see original image (CA locked out)

---

## 📝 KEY INSIGHT

**Source blend is NOT post-processing overlay.**  
**It's a FEEDBACK term in the CA dynamics.**

At each timestep:
1. CA computes what it "wants" to do
2. Source says "no, stay like me"  
3. Blend determines who wins
4. Result feeds into NEXT timestep

This creates emergent interaction between:
- CA's desire to evolve (local rules)
- Source's desire to persist (global structure)

Beautiful tension! 🎨
