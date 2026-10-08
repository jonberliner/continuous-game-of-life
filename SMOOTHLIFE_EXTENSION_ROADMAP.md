# SmoothLife Extension Roadmap

This roadmap preserves the existing Core V1 dynamics while introducing a stronger SmoothLife-style kernel core for local, discrete, persistent structures.

## Guiding Principle

- Do not delete existing behavior.
- Introduce a new kernel core in parallel, then blend it in.
- Keep current Phase 1-3 mechanisms as style modulators.
- Current working mode: kernel blend is fixed to `1.0` during tuning to reduce UI ambiguity.

## Phase A - Parallel Kernel Foundation (implemented, then superseded)

Goal: add SmoothLife-style inner/outer neighborhood measurements and growth windows without breaking existing presets.

Planned work:
- Add transition parameters for:
  - kernel blending
  - inner/outer radius split
  - birth/survival windows
  - kernel growth gain
  - mid-range inhibition
- Compute local inner mass `m` and outer ring mass `n` in transition shader.
- Add SmoothLife signal contribution:
  - `S = sigma_n(n, sigma_m(...), sigma_m(...))`
  - `dL += kernelBlend * kernelGrowthGain * (2*S - 1)`
- Add optional lateral inhibition term from `(n - m)`.
- Keep defaults conservative (`kernelBlend = 0`) so behavior is unchanged until enabled.

Success criteria:
- Existing presets still run and look familiar at default values.
- Turning up kernel blend creates clearer local region formation.

Current status note:
- This phase was implemented first as a blend path, then superseded by the current tuning regime:
  - `kernelBlend` is now fixed to `1.0`
  - kernel-only tuning is the active workflow.

## Phase B - Hybrid Engine Tuning

Goal: stabilize mixed behavior and create practical tuning recipes.

Planned work:
- Add 2-3 curated presets for:
  - structure-first
  - balanced hybrid
  - chaotic exploration
- Tune old terms to avoid overpowering kernel dynamics when blend is high.
- Add simple diagnostics in status docs:
  - collapse detector
  - repetition detector
  - local-structure score

Success criteria:
- A reproducible parameter region with discrete structures and persistence.
- Reduced global lockstep synchronization.

## Phase C - Refractory / Excitable Extension

Goal: break global phase locking and increase local motif persistence.

Planned work:
- Add a refractory scalar channel (`R`) or derive equivalent gating from memory.
- Gate activation by local recent activity.
- Tune for pulse-like and particle-like behavior.

Success criteria:
- More glider-like, filament-like, or pulse-like localized structures.
- Fewer globally synchronized oscillation modes.

## Phase D - Source Image Integration 2.0

Goal: integrate source content as structure guidance, not continuous attractor pull.

Planned work:
- Keep source as initial condition.
- Build source guidance fields (orientation, coherence, ridge strength).
- Use guidance fields to modulate kernel geometry and local rule coefficients.
- Keep hard constraint: never blend CA state back toward source pixel values.
- Optional sparse anchor regions instead of per-pixel pull.

Success criteria:
- Stylization remains free-running while preserving useful source geometry cues.
- No frozen source-outline bias.

### Phase D1 - Implemented (current)

Implemented in Core V1:
- Precompute a static source guidance texture from source luminance:
  - `RG`: local tangent orientation vector
  - `B`: local coherence (structure confidence)
  - `A`: ridge strength
- Added source-debug visualization controls:
  - Guidance edge overlay checkbox
  - Edge frequency slider (coarse to fine guidance extraction)
- Replaced raw gradient edge extraction with XDoG-style contour abstraction:
  - superseded by Canny-style contour extraction (Gaussian + Sobel + NMS + hysteresis)
  - gives thin binary contour lines instead of soft grayscale ridges
  - `Edge Frequency` controls contour density via threshold and smoothing scale.
- Feed guidance texture to transition shader every frame.
- Add anisotropic SmoothLife neighborhood sampling:
  - kernel stretches along source orientation where coherence is high
  - isotropic behavior remains in low-coherence regions
- Add local kernel gain modulation from ridge/coherence fields.

Non-negotiable guardrail preserved:
- No source-state attraction terms (`state <- mix(state, source)`), overlays, or pixel pull-back.

### Phase E1 - Implemented (implicit cross-channel coupling)

Implemented generic, motif-agnostic L<->chroma feedback:
- Field-moment coupling from local L/chroma variance products.
- Cross-moment coupling from local L/chroma covariance.
- Scale-moment coupling from local-vs-neighborhood mismatch separation.

Design constraint preserved:
- No explicit pattern detectors (`stripe/blob/glider` logic) and no lookup tables.
- Coupling uses only local continuous operators and smooth modulation.

### Current State Snapshot (now)

- Kernel-only mode is active (`kernelBlend = 1.0`) to reduce mixed-regime ambiguity.
- Source guidance is integrated as field bias only (orientation/coherence/ridge), with debug overlay.
- Chroma has intrinsic anti-collapse dynamics; `Diversity Kick` now amplifies rather than exclusively injects variation.
- New coupling controls are additive: when their value is zero, their incremental terms are zero.
- UI is reduced to kernel-relevant controls for this stage.

## Diagnosis (why behavior still feels imbalanced)

- Chroma currently has higher effective update energy and more active forcing modes than structure.
- L-structure still has fewer morphology classes (mostly cell/strip/merge families), so shape diversity lags color diversity.
- Blob identity is still strongly tied to luminance minima in perception, so many persistent structures appear dark.
- The system has local emergent coupling, but channel timescales and morphology generators are not yet balanced.

## Phase F - Morphology Diversity and Timescale Parity (next build)

Goal: increase continuously changing, diverse blob morphology while keeping implicit dynamics and source-guided emergence.

Planned implementation order:
- F1. **Timescale parity instrumentation** ✅ implemented
  - Add runtime metrics for `|dL|`, `|dAB|`, local variance drift, and persistence spread.
  - Tune toward parity windows where structure and chroma evolve at comparable energy scales.
- F2. **Competing structural scales**
  - Introduce a second structural interaction scale for L (activator/inhibitor style) using generic kernels.
  - Modulate local scale-mix by moments/coherence (no explicit motif logic).
- F3. **Refractory/excitability layer**
  - Add a lightweight refractory channel (or equivalent memory-derived gate) to reduce repetitive cycles.
  - Promote split/merge/reform dynamics and direction changes.
- F4. **Color-structure identity expansion**
  - Add a secondary structural observable for display/composition so blob identity is not only low-L.
  - Enable bright/saturated structural blobs as an emergent possibility.
- F5. **Controlled structural advection**
  - Add weak, bounded, state-dependent drift for structure using source-guidance + local moments.
  - Preserve autonomy: guidance biases motion geometry, never targets source pixel values.
- F6. **Control-surface simplification**
  - Introduce intention-level knobs (structure diversity, plasticity, coupling, source guidance) mapped to internals.
  - Keep advanced controls available but secondary.

Success criteria:
- Increased diversity in blob size, shape, lifetime, and direction without explicit pattern coding.
- Reduced gap between chroma dynamism and structure dynamism.
- Colored structural blobs emerge naturally (not as overlays or lookup mappings).
- Source-guided stylization remains loose, autonomous, and non-attractor to source pixels.

F1 implementation note:
- Added live diagnostics readout in UI for:
  - `|dAB|/|dL|` parity ratio
  - `|dL|`, `|dAB|` magnitudes
  - `varL`, `varS` (luminance/saturation variance)

F2 implementation note:
- Added secondary structural scale controls:
  - `kernelSecondaryGain` (additive, zero = off)
  - `kernelSecondaryRadius`
  - `kernelSecondaryInner`
- Transition shader now evaluates a second SmoothLife `(m2,n2)` kernel at larger radius and adds its contribution to `dL`.
- The second scale uses the same implicit source-guided anisotropy and gain modulation pipeline.

F3 implementation note:
- Implemented a memory-derived refractory/excitability layer without adding a new state texture channel:
  - Refractory gate from `abs(L-M)` and local `L` variance.
  - Positive `dL` drive is suppressed during refractory periods.
  - Low-variance regions receive excitability drive via local state differences.
  - Chroma transport is damped during refractory periods.
- New controls:
  - `refractoryGain`, `refractoryThreshold`, `refractoryWidth`
  - `excitabilityGain`
  - `refractoryColorDamp`

F4 implementation note (safe additive pass):
- Added display/composition identity expansion without changing simulation state equations:
  - local structural observable from neighborhood L variance and local activity proxy
  - additive composition controls:
    - `structureIdentityMix`
    - `structureIdentityColor`
- Zero defaults preserve prior appearance exactly; increasing values allows non-black structural identities.

F4b implementation note (emergent CA-state pass):
- Added state-space distribution shaping in transition dynamics (not display-only):
  - local moment-derived saturation regime force (low/mid/high coexistence emerges from local state)
  - luma/chroma coexistence coupling from local contrast and activity
- New additive controls (all default 0, zero = no effect):
  - `satRegimeGain`
  - `satRegimeSpread`
  - `lumaChromaCoexistGain`
- Design constraint preserved:
  - no absolute hue targets, no color-wheel lookup tables, no motif-specific coding.

F4b tuning adjustment:
- Enabled nonzero defaults for F4/F4b controls so effects are visible without manual discovery.
- Added reciprocal chroma->L coexistence feedback in transition dynamics so chroma organization can participate in structural blob identity (not just background flow).

## Phase E - Search-Assisted Rule Discovery

Goal: systematically find parameter regions with beauty + structure.

Planned work:
- Add objective metrics for:
  - boundary richness
  - local persistence
  - temporal novelty
  - anti-collapse
- Use guided search to discover robust parameter sets.

Success criteria:
- Multiple reliable presets with distinct aesthetic regimes.
- Less dependence on manual trial-and-error.

## Phase F7 - Color Boundary Permeation (new)

Goal: make chroma behave like structure does now: boundaries should interact, congeal, permeate, and propagate without relying on an explicit diversity injection term.

### Dynamics review (current bottlenecks)

- Chroma dynamics currently over-rely on mismatch-gated adoption branches:
  - very small local mismatch (`dLocalMag < 0.04`) repels
  - small mismatch (`< 0.09`) is neutral
  - only a middle band strongly propagates
  - large mismatch gets weak adoption
- This creates "too-sticky" local color plateaus and weak cross-boundary flow in many seeded images.
- `Diversity Kick` can hide this by injecting extra directional movement in uniform zones, but this is a compensation layer, not the core transport mechanism.
- Several reciprocal L<->chroma couplings existed but were effectively disabled by zero defaults, so boundary interaction was underpowered at default startup.

### Default profile update (applied)

Updated default knobs to shift color interaction toward boundary-mediated exchange:

- Increased transport and flow coupling:
  - `coreAdoptGain`: `0.30 -> 0.85`
  - `coreGrowthHueCoupling`: `0.00 -> 0.25`
  - `coreMaxDeltaAB`: `0.06 -> 0.10`
- Enabled reciprocal channel coupling at moderate levels:
  - `kernelColorToLGain`: `0.00 -> 0.20`
  - `kernelLToColorGain`: `0.00 -> 0.35`
  - `colorPocketGain`: `0.00 -> 0.30`
  - `fieldMomentCoupling`: `0.00 -> 0.18`
  - `crossMomentCoupling`: `0.00 -> 0.14`
  - `scaleMomentCoupling`: `0.00 -> 0.12`
  - `lumaChromaCoexistGain`: `0.00 -> 0.20`
  - `satRegimeGain`: `0.00 -> 0.10`
  - `satRegimeSpread`: `0.00 -> 0.08`
- Reduced explicit crutch term and replaced it with structural breakup:
  - `diversityKick`: `0.10 -> 0.03`
  - `antiConsensusGain`: `0.00 -> 0.18`

Implementation note:
- Engine-side fallback defaults were aligned with UI defaults to avoid divergent behavior when params are missing.

### Next shader work (if default profile is still insufficient)

1. Re-shape adoption response from piecewise hard thresholds to a smooth, broad mid-band transfer function of local mismatch (`dLocalMag`) so there is no dead neutral plateau.
2. Add explicit cross-boundary transfer gain that increases when local chroma gradient and local L-gradient are both high (generic operator only, no motif detector).
3. Gate diversity burst by "transport stall" diagnostics (low `|dAB|` while high boundary contrast), then reduce burst when boundary flux recovers.
4. Add a live "boundary flux" metric:
   - average chroma flow across high-contrast local interfaces
   - target increasing flux without global color lock-in.

### Success criteria for F7

- With default startup settings, seeded color regions begin interacting without manually increasing `diversityKick`.
- Color boundaries exhibit persistent exchange fronts (not only static boundaries or random jitter).
- Long-run behavior shows congeal/permeate cycles comparable to current L-structure motion quality.
