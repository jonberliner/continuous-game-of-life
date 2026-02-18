# CRITICAL BUG FIX: Source Image Structure Persistence

## The Problem

**User reported**: "The structure is still there and fixed... is it a ghosted structure of the source image?"

**Answer**: YES! And it was my fault for removing the toggle without understanding the full system.

---

## Root Cause

### What I Thought I Removed
In Phase 3.6, I removed the **source influence** code that was pulling L and colors toward source values:
```glsl
// REMOVED:
float source_pull_L = (src_L - lNew) * u_sourceBlend;
lNew += source_pull_L;
```

### What I Missed
**Edge detection was STILL using the original image!**

```javascript
// In coreV1Engine.js, line 77:
computeEdges(detail) {
    // ...
    gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);  // ← ALWAYS source image!
    // ...
}
```

**The edge texture was computed ONCE at startup from the source image and NEVER UPDATED.**

---

## How This Created Fixed Structure

### The Chain of Causality

1. **Source image loaded** → Edge detection runs on original RGB
2. **Edge texture created** → Stored permanently (never recomputed)
3. **Transition shader uses edges**:
   ```glsl
   float barrier = clamp(edge * u_boundaryStrength, 0.0, 1.0);
   float lNew = lNow + dL * rate * (1.0 - 0.6 * barrier);  // Edges slow dynamics!
   ```
4. **Original image edges become permanent "slow zones"**
5. **Structure locked** → Can't evolve because source edges resist change

### Why User's Config Made It Worse

With their parameters:
- `radius: 0.009` (9px kernel)
- `boundaryStrength: 0.35` (moderate edge dampening)
- `deltaTime: 4.26` (very fast)

**Result**:
- Fast dynamics everywhere EXCEPT at source edges
- Source edges act as **permanent barriers**
- Pattern between edges evolves but **edge locations never move**
- Creates "fixed structure with swirling colors on top"

---

## The Fix

### 1. Added Toggle for Edge Source
New parameter in `tunableParams.js`:
```javascript
{ 
  key: 'useSourceEdges',
  default: 0.0,  // OFF by default = dynamic edges
  min: 0.0,
  max: 1.0,
  step: 1.0,  // Boolean toggle
  group: 'System',
  label: 'Use Source Image Edges',
  hint: '↑ Original image edges create barriers (causes fixed structure). ↓ Dynamic edges from current state'
}
```

### 2. Modified Edge Computation
```javascript
computeEdges(detail, useSourceEdges = false) {
    // ...
    const textureToBind = useSourceEdges 
        ? this.originalTexture      // Static source edges
        : this.stateTexture0;       // Dynamic current-state edges
    gl.bindTexture(gl.TEXTURE_2D, textureToBind);
    // ...
}
```

### 3. Pass Toggle from Step Function
```javascript
step(params) {
    // ...
    const useSourceEdges = (params.useSourceEdges ?? 0.0) > 0.5;
    this.computeEdges(params.edgeDetail ?? 0.0, useSourceEdges);
    // ...
}
```

---

## Behavior Now

### With "Use Source Image Edges" = OFF (0.0, default)
- ✅ Edges computed from **current CA state** each frame
- ✅ Edge barriers move and evolve with the pattern
- ✅ No fixed structure from source
- ✅ Pure CA dynamics

### With "Use Source Image Edges" = ON (1.0)
- Edges computed from **original source image** (static)
- Source structure creates permanent barriers
- Useful for "guided evolution" where you want source boundaries preserved
- Colors/patterns respect original image structure

---

## Why This Was Hard to Catch

1. **Edge detection happens in separate pass** (before convolution/transition)
2. **Edge shader is simple** - just Sobel operator, seemed innocuous
3. **Source image sampling happens** but result unused in transition
4. **The bug was in WHICH TEXTURE was bound** to edge shader, not in shader code itself
5. **I removed source influence from transition** but didn't check edge pass

---

## Testing Recommendations

### To Verify Fix Works

**Test 1**: Load any image, set "Use Source Image Edges" = OFF
- Should see NO persistent source structure
- Patterns evolve freely

**Test 2**: Same image, set "Use Source Image Edges" = ON
- Should see source boundaries persist
- Colors change but structure follows original

**Test 3**: User's config with toggle OFF
```json
{
  "radius": 0.009 → 0.03,  // Also increase kernel!
  "useSourceEdges": 0.0,   // Dynamic edges
  "boundaryStrength": 0.35
}
```
Should see:
- No fixed structure
- Patterns evolve freely
- Larger features (from bigger kernel)

---

## Answer to User's Questions

### Q: "Is delta time exposed? Which toggle is that?"
**A**: Yes! It's **"Simulation Speed"** slider (0.01 - 5.0, default 0.50)

### Q: "Is it a ghosted structure of the source image?"
**A**: YES! Source image edges were creating permanent barriers. Now you can toggle this with **"Use Source Image Edges"** (set to 0 for dynamic edges).

### Q: "How can I get these structures to actually interact with the colors?"
**A**: 
1. Set "Use Source Image Edges" = 0 (OFF)
2. Increase kernel: `radius: 0.009 → 0.03-0.04`
3. Reduce adoption: `coreAdoptGain: 2.5 → 1.0`
4. Increase L-color coupling: `coreGrowthHueCoupling: 0.4 → 1.2`

This will create:
- Dynamic edges that evolve
- Larger coherent structures
- Colors coupled to luminance dynamics
- No fixed source pattern

---

## Files Modified

- `src/ui/tunableParams.js`: Added `useSourceEdges` toggle
- `src/core/coreV1Engine.js`: Modified `computeEdges()` to accept `useSourceEdges` parameter
- `IMPLEMENTATION_STATUS.md`: (should update to document this parameter)
- `KERNEL_SPEED_ANALYSIS.md`: (still valid - explains WHY tiny kernel + fast time = decoupling)
