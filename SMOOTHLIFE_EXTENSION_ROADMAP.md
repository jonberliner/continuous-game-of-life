# SmoothLife Extension Roadmap

This roadmap preserves the existing Core V1 dynamics while introducing a stronger SmoothLife-style kernel core for local, discrete, persistent structures.

## Guiding Principle

- Do not delete existing behavior.
- Introduce a new kernel core in parallel, then blend it in.
- Keep current Phase 1-3 mechanisms as style modulators.

## Phase A - Parallel Kernel Foundation (in progress)

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
- Optional weak, decaying anisotropy from source edges.
- Optional sparse anchor regions instead of per-pixel pull.

Success criteria:
- Stylization remains free-running while preserving useful source geometry cues.
- No frozen source-outline bias.

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
