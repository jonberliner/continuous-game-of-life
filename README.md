# Continuous Game of Life (WebGL Art Lab)

Image-driven continuous cellular dynamics with edge-aware regional behavior.
The simulation runs SmoothLife (Rafler 2011) for lightness wavefronts, coupled to
a unified 2D chromaticity field that treats hue and saturation as a single emergent
quantity rather than separate channels.

## Architecture Overview

```
Source Image
    │
    ├─ Edge Detection (Sobel) ─────────────── edgeTexture
    ├─ CPU Sectionizer (region hierarchy) ──── regionTexture + boundaryTargetTexture
    │
    │  ┌──────── per frame ────────┐
    │  │                           │
    │  │  Boundary Evolution ──────── evolving boundaryTexture (ping-pong)
    │  │  Convolution ─────────────── innerLum + outerRGB
    │  │  Structured Noise ────────── coherent noise field (ping-pong)
    │  │  Transition (L + ab) ─────── new state (ping-pong)
    │  │  Display ─────────────────── final render
    │  │                           │
    │  └───────────────────────────┘
```

Main orchestration: `src/main.js`
Spatial engine: `src/core/smoothlife.js`
Frequency engine: `src/core/frequencyEngine.js`
All shaders: `src/render/shaders.js`
Controls: `src/ui/controls.js`

## Color Representation: The (a, b) Chromaticity Disk

Instead of treating hue and saturation as separate channels with separate SmoothLife
rules, color is represented as a **single 2D vector** on a chromaticity disk:

```
a = S · cos(2πH)
b = S · sin(2πH)
```

- **Magnitude** `√(a² + b²)` = saturation (emerges, not ruled)
- **Angle** `atan2(b, a) / 2π` = hue (emerges, not ruled)

This eliminates circular-hue math, avoids arbitrary "hue does X, saturation does Y"
rules, and lets color dynamics be pure Euclidean vector operations. Hue and saturation
aren't controlled — they fall out of whatever (a, b) ends up being.

## Core Design: L SmoothLife + (a,b) Chromaticity Dynamics

### Convolution (unchanged, RGB domain)

The dual-kernel convolution computes two spatial averages per pixel:

- **Inner disk** (radius = 30–50% of kernel): average luminance → `m_L` (the "am I alive?" signal)
- **Outer ring** (the rest): average RGB color → `outerColor`

These are packed into a single RGBA texture: `vec4(innerLum, outerR, outerG, outerB)`.

The inner disk uses a **fixed fraction** of 0.38 (≈1/3 of kernel). This is the sweet spot for
both circular and elongated structures — adaptive fractions prevented stable stripes/labyrinths.

The outer ring RGB average is converted to (a, b) chromaticity in the transition shader.
This is an approximation (averaging RGB then converting ≠ averaging individual (a,b) vectors),
but for smooth SmoothLife neighborhoods the error is negligible.

### L Channel: SmoothLife Wavefront Engine

This is the core pattern generator — it creates traveling waves, spots, stripes, and labyrinths.
L is pure spatial dynamics with **no hue modulation** and **no diffusion feedback** — the
SmoothLife birth/survival rule is the only force acting on L.

**Base parameters** (spatially varying survival ceiling is the key design):
| Parameter | Base Value | Description |
|-----------|-----------|-------------|
| Birth interval | [0.25, 0.42] | Outer density range that triggers dead→alive (width 0.17) |
| Survival interval | [0.20, **0.49 + barrier×0.12**] | **Narrow in interior → pattern formation. Wide at edges → protection.** |
| Transition width | 0.030 (floor 0.020) | Sharp sigmoid — enables crisp structure edges for traveling waves |
| Alive threshold | 0.30–0.38 | Inner disk value at which cell is "alive" |
| Inner disk fraction | 0.38 (fixed) | ~1/3 of kernel radius — sweet spot for circles, stripes, and labyrinths |
| L update rate | 0.03 + activity × 1.8 | Gentle (~25%/step) — prevents overshoot past survival ceiling |

**Why the spatially varying survival ceiling creates patterns:** In the interior (barrier≈0),
s2 ≈ 0.49–0.52 — typical image luminance (~0.50) sits RIGHT at the survival edge. Small density
fluctuations push pixels in and out of survival, forming SmoothLife spots, stripes, and labyrinths.
At edges (barrier≈1), s2 ≈ 0.61–0.64 — this protects edge pixels from cross-boundary outer ring
values that can reach ~0.60. The survival window is narrow where you need dynamics (interior) and
wide where you need stability (edges). This is principled SmoothLife — the rule parameters vary
spatially based on local topology.

**Anti-flicker mechanisms:**
- Structured noise: spatially coherent ±0.045 offset on n_L (not multiplied by deltaTime — it's a
  measurement offset, not an increment). Prevents all pixels from being on the same side of the
  survival boundary simultaneously.
- Barrier mixing: n_L = 60% outer ring + 40% self at edges. Preserves inner/outer contrast while
  preventing extreme cross-boundary values.
- Stepped hash perturbation: changes 4×/sec instead of every frame (temporal coherence).
- Transition width floor at 0.020: prevents sub-pattern noise-scale fragmentation.

**No diffusion feedback:** Standard SmoothLife has no diffusion term. Adding `newL += (n - m) * rate`
(as in previous versions) destroys the sharp inner-vs-outer density contrast that makes structures
move. The birth/survival sigmoid is the ONLY force on L.

**Cross-channel modulation of L:**

| Input | Effect on L | Magnitude | Mechanism |
|-------|------------|-----------|-----------|
| **Saturation (|ab|)** | Sharpens transition width | −0.006 at max S | Colorful → crisper wavefront edges |
| **Saturation (|ab|)** | Raises alive threshold | +0.03 at max S | Colorful pixels have clearer alive/dead identity |
| **Confinement** | Tightens transition | ×0.80 at max | Small regions get crisper patterns (reduced from ×0.65) |
| **Barrier** | Widens survival ceiling | +0.12 at max | Edge protection without global compromise |
| **Barrier** | Softens transition width | +0.018 at max | Prevents noise-scale fragmentation at edges |

**Activity feedback (the equilibrium breaker):**

The `actBias = 0.5 − preActivity` term adjusts BIRTH only — survival is never narrowed:

| Condition | actBias | Birth window change | Net effect |
|-----------|---------|--------------------|---------------------------------|
| **Dead still** (preActivity ≈ 0.15) | +0.35 | Widens by ~15% | More spontaneous births break stasis |
| **Hyperactive** (preActivity ≈ 0.85) | −0.35 | Narrows by ~15% | Fewer new births, calming |

### (a, b) Chromaticity Dynamics: Unified Color Engine

Color is driven by spatial disagreement with neighbors — one rule set governs both
hue and saturation simultaneously.

**Disagreement vector:** `d = (ā − a, b̄ − b)` points from the pixel toward its
neighborhood's mean chromaticity. Its magnitude `|d|` measures how different the pixel
is from its surroundings.

**Three-regime response to |d|:**

```
  adoption
  strength
     ↑    ╱‾‾‾‾‾╲
     │   ╱       ╲        fortify
     │  ╱         ╲      ╱‾‾‾‾‾‾
     │ ╱           ╲____╱
     └──────────────────────→ |d|
     0    0.07  0.15  0.35  0.55
        survive  adopt  fortify
```

| Regime | |d| Range | Behavior |
|--------|----------|----------|
| **Survive** | < 0.07 | Color matches neighbors — resist change, stable |
| **Adopt** | 0.07–0.35 | Moderate disagreement — move toward neighborhood color. This is the **propagation** regime: color spreads from pixel to pixel. |
| **Fortify** | > 0.30 | High disagreement — resist AND slightly push own color **away** from neighbors. Creates vivid, emergent color borders like stained glass edges. Bounded by S ≤ 1.0, so no blow-up. |

**Adoption parameters (activity-modulated):**
| Parameter | At rest (actBias = 0.5) | At high activity (actBias = -0.5) |
|-----------|------------------------|----------------------------------|
| Adoption onset | 0.04 | 0.10 |
| Adoption falloff | 0.43 | 0.28 |
| Window width | Wide — easily adopt | Narrow — resist change |

This means **static regions become more susceptible** to color change (the adoption window
widens), while **volatile regions stabilize** (the window narrows). This prevents both
permanent stasis and permanent chaos.

**Fortification strength:** 0.20 × saturation. Gray pixels can't fortify (nothing to
intensify). Saturated pixels at color boundaries dig in. The fortification force pushes
in the direction `-d/|d|` (away from the neighborhood mean).

**Gating and modulation:**

| Factor | Effect | Value |
|--------|--------|-------|
| L-gating | Dead pixels can't hold color | `smoothstep(0.15, 0.45, newL)` |
| Wavefront boost | Active L fronts accelerate color change | `1.0 + growthAbs × 2.0` |
| Barrier dampening | Boundaries reduce cross-region color flow | `× (1 − barrier × 0.80)` |
| Confinement boost | Small regions have faster color dynamics | `× (1 + confinement × 0.50)` |
| Color Flow slider | User control over overall color rate | `× u_patternCoupling` |

**Dead pixel desaturation:** After all dynamics and pumping, `ab *= mix(0.93, 1.0, aliveMask)`
with aliveMask over `smoothstep(0.15, 0.55, newL)` — wide transition prevents flicker from
L oscillations near the threshold. 0.93× is gentler than the previous 0.85×.

**Structured noise in chromaticity:** A small perturbation in a random direction on the (a,b)
disk breaks chromaticity symmetry. Magnitude scaled by chaos, gated by L.

### Source Image Anchor: Relative Chromaticity

Instead of pulling toward the source's **absolute** color (which pins everything to the original
palette), the anchor preserves the source's **relative color offset from its neighborhood**:

```
ab_src_offset = ab_src − ab_regionSrc        // source's offset from its local region avg
ab_target     = ab_neigh + ab_src_offset      // where I should be relative to my CURRENT neighbors
Δab          += srcAdh × (ab_target − ab_new) × 0.04 × (0.3 + 0.7 × (1 − barrier))
```

**Example:** If the source pixel was red among blue neighbors:
- `ab_src_offset` = reddish direction
- If the current neighborhood has drifted to green: `ab_target` = green + reddish = yellow-green
- The anchor pulls toward yellow-green, NOT toward the original red

This preserves the source image's **color structure** (which regions are warmer/cooler/more vivid
than their neighbors) while letting the **entire palette drift freely** over time. Relative
relationships persist, absolute colors evolve.

### Cross-Channel Feedback Summary

```
  ┌─────────────────────────────────────────┐
  │                                         │
  │   |ab| ──(sharpens transitions)──→ L    │
  │   L ────(gates all color dynamics)──→ ab│
  │   L ────(wavefronts boost color)───→ ab │
  │                                         │
  │   All ←──(activity feedback)──→ All     │
  │                                         │
  └─────────────────────────────────────────┘
```

The feedback loop: L creates spatial structure → wavefronts carry and mix color →
color magnitude sharpens L's wavefront edges → different pattern crispness by region →
perpetual evolution. No hue-dependent pattern rules — color diversity emerges from
spatial propagation, fortification, and the pump system.

## Spatial Scaling

All spatial radii in the shaders are expressed as fractions of `min(width, height)`,
ensuring consistent behavior across image resolutions (512px to 4000px+).

| Operation | Fraction of minDim | Example at 512px | Example at 4000px |
|-----------|-------------------|-------------------|-------------------|
| Confinement sensing | 8% | 41px | 320px |
| Boundary diffusion | 0.6% | 3px | 24px |
| Boundary activity sensing | 1% | 5px | 40px |
| Section coarse sampling | 0.4%–5.5% | 2–28px | 16–220px |
| Section closure | 0.2%–2% | 1–10px | 8–80px |
| Section merge | 0.4%–4.7% | 2–24px | 16–188px |
| Region seed pooling | 0.6%–4% | 3–20px | 24–160px |
| Structured noise radius | 0.2%–18% | 1–90px | 8–720px |
| Convolution kernel | User-controlled | Logarithmic 0.1%–100% | Same fraction |

## Dynamic Boundaries

Boundaries are not fixed — they evolve through a GPU ping-pong pass each frame:

- **Reassertion**: gently pulled back toward CPU-computed region boundaries
- **Erosion**: high local activity (spatial gradients in the simulation) erodes boundaries
- **Diffusion**: boundaries blur softly to prevent sharp pixel-level lines

The `Boundary Strength` slider controls reassertion vs erosion strength.

## Color Pump System

Operates exclusively on (a, b) chromaticity (never overrides L from the GoL):

- **Base pump**: steady-state color pressure from region palette, applied as `mix(ab_cur, ab_base, rate)`
- **Hazard pump**: Poisson-like per-region events that change the target chromaticity
- **Patch uniformity**: only active when hazard > 0 — nudges pixels toward regional base color
- **Source color adherence**: blends free palette toward source image colors
- **Chromatic floor**: ensures alive pixels maintain minimum saturation

All pump operations work in (a, b) space, meaning they blend chromaticity vectors
naturally without circular-hue artifacts. Dead pixel desaturation is applied **after**
pumping, so the pump can't override the "dead = gray" principle.

## UI Controls

### Core
| Slider | Internal mapping | Effect |
|--------|-----------------|--------|
| Boundary Simplification | CPU sectionizer parameters | How much the source image's edges are simplified into regions |
| Boundary Strength | Reassertion rate, erosion strength | How strongly boundaries persist vs erode from activity |
| Kernel Width | Log-mapped convolution radius | Spatial scale of SmoothLife patterns (bigger = larger, slower patterns) |
| Color Hazard | Pump event frequency, noise scale | Rate of color injection into regions |
| Palette Stability | Palette persistence, noise dampening | How long region colors persist before changing |
| Source Color Adherence | Pump palette mix, anchor strength | How much colors track the original image |
| Simulation Speed | Logarithmic timestep | Left = single-step viewing, right = 10× current max |
| Energy | activity + chaos uniforms | Low = calmer/cleaner dynamics, High = more active and chaotic |
| Color Flow | (a,b) dynamics rate | Low = color stays local, High = color flows and propagates |

### Advanced
| Control | Effect |
|---------|--------|
| Edge Fineness | Sobel edge detector detail level |
| Texture Persistence | How quickly structured noise field evolves |
| Show Boundaries | Debug render: displays the evolving boundary field |

### Presets
| Preset | Character |
|--------|-----------|
| Organic | Calm, natural-looking evolution |
| Regional | Strong regional color separation |
| Dreamy | Soft, flowing, low-contrast |
| Wild | High energy, rapid color changes |
| Source Memory | Strong adherence to original image colors |

## Running Locally

Do not open with `file://` (module/CORS restrictions). Use a local server.

```bash
npm install
npm run dev
```

or

```bash
./start-server.sh
```

## Known Issues / Future Work

- **Inner disk chromaticity precision**: Currently uses center pixel for inner disk (a,b).
  A second convolution texture would provide properly averaged inner RGB for all channels.
- **Color momentum**: The current system approximates momentum through adoption dynamics.
  A dedicated previous-state texture would enable explicit velocity tracking for color
  currents that persist across frames.
- **Directional gradients**: A Sobel gradient on the (a,b) field could distinguish
  "at a color front" from "isolated island" scenarios, enabling anisotropic color flow
  (color rivers along boundaries). Deferred as an enhancement if dynamics feel too isotropic.
- **Frequency mode**: Current "Frequency" implementation is multi-scale spatial approximation,
  not true spectral evolution. May be removed or replaced with true FFT pipeline.
- **Performance**: Large images (4000px+) with 128-sample convolution can be heavy on lower-end GPUs.
- **UI duplicate IDs**: `index.html` has duplicate `pauseBtn` / `resetBtn` elements.

## Credits

- Inspired by SmoothLife (Stephan Rafler): https://arxiv.org/abs/1111.1567
- Related inspiration: Lenia, fuzzy-life, and continuous cellular automata art systems.

## License

MIT
