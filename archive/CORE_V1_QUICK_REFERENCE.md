# Core V1 Quick Reference

## What Changed

**Before**: Degenerate system → uniform static state  
**After**: Oscillatory system → sustained rich dynamics

## Key Mechanism

```
State: (L, a, b, M)
       ↑         ↑
    density   momentum

M = slow_average(L)
L oscillates around M → never stops
Colors flow via L_momentum = L - M
```

## Critical Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| `memoryDecay` | 0.05 | Oscillation speed (lower = slower) |
| `historyOscillationGain` | 0.8 | Anti-damping strength |
| `divergenceGain` | 0.3 | Anti-uniformity pressure |
| `flatBreakupGain` | 0.2 | Destabilize flat regions |
| `coreGrowthHueCoupling` | 0.8 | Color flow speed |

## Quick Fixes

**Still freezing?**
```
historyOscillationGain: 0.8 → 1.2
flatBreakupGain: 0.2 → 0.4
```

**Too chaotic?**
```
historyOscillationGain: 0.8 → 0.5
coreLDiffGain: 0.5 → 0.8
```

**No color flow?**
```
coreGrowthHueCoupling: 0.8 → 1.5
noiseGain: 0.02 → 0.05
```

## Why It Works

1. **M lags L** → creates restoring force → oscillation
2. **Non-monotonic adoption** → waves + boundaries coexist
3. **Variance terms** → flat regions unstable
4. **Momentum rotation** → colors flow continuously
5. **No global attractors** → no fixed points

## State Encoding

```
R = L     (luminance)
G = a     (chroma x, encoded)
B = b     (chroma y, encoded)
A = M     (momentum)
```

Display converts (L,a,b) → RGB via HSV.

## Files Modified

- `src/render/coreV1Shaders.js` - All shaders
- `src/core/coreV1Engine.js` - Reset + uniforms
- `src/ui/tunableParams.js` - 16 new params

## Test It

```bash
# Run the app
open index.html

# Watch for:
- Continuous motion ✓
- Color flow ✓
- No freeze ✓
- Pulsing patterns ✓
```

## Success Metrics

After 500+ frames:
- Activity > 0.001 ✓
- Color variance > 0.1 ✓
- Spatial variance > 0.05 ✓
- No static regions ✓
