# Core CA Rebuild Plan

## Goal
Build a simple, modular continuous cellular automaton where `L` and chroma (`a,b` or `H,S`) interact through:

- cell state history
- neighbor cell state contrasts
- optional source biases (strictly optional, never required for motion)

The baseline must produce sustained, diverse motion without source, pump, or external fields.

---

## Recommendation: Refactor With Parallel Core (Not Full Rewrite)

Use a **parallel core path** instead of rewriting everything at once.

- Keep current engine/UI running.
- Add a new modular rule pipeline in parallel (feature flag / mode).
- Migrate once core behavior is proven.

Why:
- Lower risk than big-bang rewrite.
- Enables A/B comparison on the same renderer + UI.
- Lets us swap rule components quickly (mean/variance vs gradients, etc.).

---

## Architecture (Modular By Design)

Create a rule system with explicit modules and stable interfaces.

### Module boundaries

1. **Neighborhood Sampler**
   - Input: current state texture
   - Output per cell: reusable neighborhood stats
   - Pluggable features: mean, variance, gradient, Laplacian, directional moments

2. **Core L Update**
   - Input: cell state + neighborhood stats + local history
   - Output: `L_next`
   - No source, no external fields

3. **Core Chroma Update**
   - Input: cell chroma + neighborhood chroma stats + local history + `L` signals
   - Output: `ab_next` (or `H,S_next`)
   - No source, no external fields

4. **History Update**
   - Local EMA / hysteresis / stasis tracking per cell
   - Only depends on per-cell temporal state

5. **Optional Bias Modules**
   - Source color bias
   - Source structure bias
   - Must be 0-safe (at zero, identical behavior to core-only)

6. **Display Mapping**
   - Maps state to output color for visualization
   - Should not alter dynamics

---

## Implementation Strategy

## Phase 0: Freeze a Minimal Baseline

- Add a `Core Minimal Dynamics` mode/profile.
- Disable by default in this mode:
  - source color/structure bias
  - pump
  - structured noise injection
  - non-cell external fields
- Keep only core L/chroma/history interactions.

Exit criteria:
- Motion and color change persist for long runs without source.

## Phase 1: Factor Rule Code Into Composable Units

Refactor shader logic into clear function blocks:

- `sampleNeighborhood(...)`
- `computeLTarget(...)`
- `updateL(...)`
- `computeChromaDelta(...)`
- `updateHistory(...)`
- `applyOptionalBiases(...)`

Add compile-time or uniform-gated switches for:
- mean/variance feature set
- gradient feature set
- mixed feature set

Exit criteria:
- Can switch feature sets without touching unrelated rule logic.

## Phase 2: Build Feature Plug System (Mean/Variance vs Gradient)

For each channel (L and chroma), allow selecting feature inputs:

- **MV mode**: mean/variance
- **Grad mode**: directional gradients / Laplacian / anisotropy
- **Hybrid mode**

Implementation detail:
- Keep one sampler pass that computes a fixed feature vector.
- Core update functions read only features they need.

Exit criteria:
- Swapping MV <-> Grad is a param change, not a shader rewrite.

## Phase 3: Add Acceptance Metrics (Hard Gates)

Add a deterministic test profile and metrics:

- activity floor
- color change floor
- stasis ratio ceiling
- dead ratio ceiling
- topology-change floor (connected component change rate)

Use these as pass/fail gates before adding aesthetics.

Exit criteria:
- Core passes metrics at multiple resolutions and seeds.

## Phase 4: Reintroduce Source as Optional Bias

Add source modules only after core passes:

- source color bias (neighbor-relative)
- source structure bias (soft, bounded)

Rules:
- independent knobs
- both default off in core mode
- zero-safe identity behavior

Exit criteria:
- Source guides style without stopping motion.

## Phase 5: Reintroduce Aesthetic Extras (Optional)

Only after stability:

- mild deterministic diversity shaping
- optional stochastic seasoning

All extras must have:
- explicit knob
- default off in core mode
- documented purpose

---

## File/Code Refactor Plan

Suggested target files:

- `src/render/shaders_core_ca.js` (new modular core shader)
- `src/core/smoothlife_core.js` (new mode wiring)
- `src/ui/tunableParams_core.js` (core knobs only)
- `src/ui/presets/coreMinimal.json` (or equivalent preset constants)

Transition path:
- Keep existing `shaders.js` and `smoothlife.js`.
- Add a mode switch to run old vs core pipeline.
- Migrate proven modules back into main once validated.

---

## Knob Policy

Every nontrivial term should have:

- a named knob
- a documented range and default
- clear on/off semantics

Categories:

- **Core required knobs** (small set, always visible)
- **Advanced core knobs** (still core, less frequently touched)
- **Optional bias knobs** (source/extras, default off in core mode)

---

## What We Should Do First (Next Step)

1. Add `Core Minimal Dynamics` mode scaffold.
2. Implement modular function blocks in a new shader file.
3. Start with MV feature set only.
4. Add 6 core metrics overlay and verify sustained motion.
5. Then add gradient feature set as a pluggable alternative.

---

## Decision Log

- Chosen approach: **parallel modular refactor**.
- Avoided: big-bang rewrite.
- Reason: faster iteration, less regression risk, easy component swaps.
