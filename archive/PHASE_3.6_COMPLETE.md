# Phase 3.6 Complete: Config System + Source Removal

## ✅ What Changed

### 1. Source Image Influence REMOVED
**Problem**: Even at 0.01, source luminance persisted as unchanging greyscale outline
**Root Cause**: Continuous attractor pull accumulates over time (60 FPS → locked after ~100 frames)
**Solution**: Source is now **ONLY initial condition**, not a continuous force
**Files Modified**:
- `src/render/coreV1Shaders.js`: Removed source influence code
- `src/core/coreV1Engine.js`: Removed `u_sourceBlend` uniform
- `src/ui/tunableParams.js`: Removed `sourceBlend` parameter

**Effect**: CA now evolves completely freely from initial image state

---

### 2. Config Save/Load System
**New Features**:
- ✅ Save named parameter configurations
- ✅ Load saved configs with one click
- ✅ Delete unwanted configs
- ✅ Export configs as JSON files
- ✅ Import configs from JSON files
- ✅ Persists in browser localStorage

**Files Modified**:
- `src/ui/controls.js`: Added config management methods
- `styles/main.css`: Added config UI styles

**Example Presets**:
- `presets/interesting-spirals.json`: User's structured cyclic pattern config
- `presets/chaotic-exploration.json`: Modified for more chaos (↑ noise, ↓ attractors, continuous angles)

---

## 📊 System Analysis: Why Predictable/Cyclic?

### Current System Characteristics
**Creates LIMIT CYCLES (attracting periodic orbits), not true chaos**

| Feature | Effect on Dynamics |
|---------|-------------------|
| Strong attractors (1.85) | L clusters at 0.15, 0.50, 0.85 → discrete levels |
| Quantized angles (10 dirs) | Reduces degrees of freedom → periodic patterns |
| Low noise (0.025) | Deterministic → predictable |
| Boundary sharpening | Bistable switches → snaps between states |
| Oscillation (L-M) | Periodic motion around attractors |

**Result**: Complex-looking but PREDICTABLE patterns (cyclic spirals, structured waves)

---

### Requirements for TRUE CHAOS

| Requirement | Current State | What's Needed |
|------------|---------------|---------------|
| **Sensitive to initial conditions** | ✅ Partial | More nonlinearity |
| **Aperiodic (never repeats)** | ❌ Limit cycles | Weaken attractors |
| **Bounded** | ✅ Yes | Already satisfied |
| **High-dimensional** | ❌ Too structured | Continuous angles |
| **Strong noise** | ❌ Too weak | 10× increase |

---

### How to Increase Chaos

**Quick Tweaks** (try "Chaotic Exploration" preset):
```
noiseGain:          0.025 → 0.12       (10× increase!)
attractorGain:      1.85  → 0.10       (weaken clustering)
angleQuantization:  10    → 1          (continuous angles)
historyOscillationGain: 0.20 → 1.50   (stronger oscillation)
flatBreakupGain:    0.80  → 2.00       (aggressive destabilization)
```

**Advanced Additions** (not yet implemented):
- Stochastic resets (random pixels occasionally reset)
- Time-varying attractors (move around)
- Multi-scale coupling (fast + slow timescales)
- True random events (not pseudo-random)

---

## 🎯 Discrete Shapes Problem

### Why No Isolated Structures?

Our mechanisms PREVENT localized features:
- **Diffusion** → smooths boundaries
- **Color adoption** → spreads uniformly
- **Vorticity** → creates extended spirals
- **Anti-consensus** → breaks uniformity globally, not locally

### What's Missing?

| Mechanism | Effect |
|-----------|--------|
| **Reaction-diffusion** | Creates spots/stripes (Turing patterns) |
| **Lateral inhibition** | "Peaks suppress surroundings" → isolated features |
| **Threshold growth** | Binary on/off → discrete domains |
| **Surface tension** | Minimizes boundary length → round objects |
| **Growth rules** | "If bright AND isolated → expand" |

**These would require NEW dynamics**, not just parameter tweaks!

---

## 📁 Files Changed

### Core Engine
- `src/render/coreV1Shaders.js`: Removed source influence
- `src/core/coreV1Engine.js`: Removed `u_sourceBlend` uniform
- `src/ui/tunableParams.js`: Removed sourceBlend parameter (40 params now)

### UI
- `src/ui/controls.js`: Added config save/load/export/import
- `styles/main.css`: Added config section styles

### Documentation
- `IMPLEMENTATION_STATUS.md`: Updated for Phase 3.6
- `SOURCE_AND_CHAOS_ANALYSIS.md`: Deep dive on chaos vs predictability
- `presets/interesting-spirals.json`: User's config saved
- `presets/chaotic-exploration.json`: Chaos-optimized config

---

## 🎨 Usage

### To Save Current Config:
1. Type name in "Config name..." input
2. Click "💾 Save"
3. Appears in list below

### To Load Config:
- Click "Load" button next to config name

### To Export/Import:
- **Export**: Downloads current params as JSON
- **Import**: Click "📥 Import" and select JSON file

### To Compare Cyclic vs Chaotic:
1. Load "Interesting Spirals" → structured, predictable, beautiful spirals
2. Load "Chaotic Exploration" → much less predictable, more varied

---

## 🔬 Next Steps?

### For Image Stylization:
- Source now works as intended (initial condition only)
- Upload image → CA evolves freely from those colors
- Try both presets to see different evolution styles

### For More Chaos:
- Use "Chaotic Exploration" preset
- Or tweak: ↑ noise, ↓ attractors, ↓ quantization

### For Discrete Shapes:
- Would need NEW mechanisms (reaction-diffusion, lateral inhibition)
- These are architecturally different from current system
- Let me know if you want to explore this direction!
