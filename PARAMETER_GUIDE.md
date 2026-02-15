# Parameter Guide

## Effect Strength

### Mix to Original (0.0 - 1.0)
**What it does:** Blends between the transformed result and the original image.
- **1.0** = Shows only the original image (no effect)
- **0.5** = 50/50 blend between original and transformation
- **0.0** = Full transformation effect

**Use this to:** Control how much of the effect you see. Great for subtle effects or comparison with the original!

---

## Radii

### Inner Radius (1 - 30 pixels)
**What it does:** Defines the size of the "cell" itself - the inner disk used for calculating local averages.
- **Small (1-5)**: Sharp, detailed local patterns
- **Medium (5-10)**: Balanced detail and smoothness
- **Large (10-30)**: Smooth, flowing patterns

**Use this to:** Control local vs global effects. Larger = smoother, more averaged behavior.

### Outer Radius (2 - 45 pixels)
**What it does:** Defines the size of the neighborhood ring around each cell.
- **Small (2-10)**: Local, cellular-like patterns
- **Medium (10-20)**: Regional flowing patterns
- **Large (20-45)**: Global, wave-like movements

**Use this to:** Control the scale of patterns. Larger = bigger features, more connected behavior.

---

## Birth Interval

Cells with **neighbor luminance** (brightness) in this range will **brighten** (be "born").

### Birth Min (0.0 - 1.0)
Lower bound of the birth threshold. Neighbors brighter than this...

### Birth Max (0.0 - 1.0)
...and dimmer than this will cause the cell to brighten.

**Example:**
- Birth Min = 0.278, Birth Max = 0.365
- If neighbors have luminance between 0.278 and 0.365, cell brightens
- Like "comfortable" conditions for life!

---

## Death Interval

Cells with **neighbor luminance** in this range will **darken** (experience "death").

### Death Min (0.0 - 1.0)
Lower bound of the death threshold.

### Death Max (0.0 - 1.0)
Upper bound of the death threshold.

**Example:**
- Death Min = 0.267, Death Max = 0.445
- If neighbors are too dim or too bright (in this range), cell darkens
- Like "harsh" conditions for life!

---

## Dynamics

### Smoothness (0.01 - 0.5)
**What it does:** Controls the sharpness of birth/death transitions (sigmoid steepness).
- **Low (0.01-0.1)**: Sharp, sudden transitions (crisp edges)
- **Medium (0.1-0.2)**: Balanced smoothness
- **High (0.2-0.5)**: Very smooth, gradual transitions (fuzzy)

**Technical:** This is the alpha parameter in the sigmoid function. Lower = steeper slope.

### Time Step (0.01 - 1.0)
**What it does:** How much the image changes per frame.
- **Slow (0.01-0.05)**: Gentle, slow evolution
- **Medium (0.05-0.15)**: Visible but controlled changes
- **Fast (0.15-1.0)**: Rapid, chaotic transformations

**Use this to:** Speed up or slow down the simulation. Like a "speed multiplier."

### Restoration (0.0 - 0.5)
**What it does:** How strongly the original image "pulls back" each frame.
- **None (0.0)**: Image can warp away completely
- **Low (0.01-0.1)**: Gentle pull back - creates the "trippy but returns" effect
- **Medium (0.1-0.2)**: Stronger pull - stays closer to original
- **High (0.2-0.5)**: Very strong pull - subtle warping only

**This is key!** This creates the "warping but always coming back" effect you wanted.

---

## How They Work Together

1. **Radii** define the neighborhood size for sampling
2. **Birth/Death intervals** determine when pixels brighten or darken based on their neighbors
3. **Smoothness** controls how sharp those transitions are
4. **Time Step** controls how fast it evolves
5. **Restoration** pulls it back toward the original over time
6. **Mix to Original** lets you fade between full effect and original image

---

## Quick Tips

- **For trippy warping:** Restoration = 0.05-0.1, Time Step = 0.1-0.15
- **For stable breathing:** Restoration = 0.15-0.3, Time Step = 0.05-0.08
- **For chaos:** Low restoration (0.01), high time step (0.2+)
- **For comparison:** Adjust "Mix to Original" to see before/after
- **Birth/Death overlapping:** More overlap = more active transitions
- **Birth/Death separated:** Less overlap = more stable states

---

## The Math (for nerds)

The algorithm computes:
1. **m** = average luminance in inner disk (radius r_i)
2. **n** = average luminance in outer ring (radius r_a)
3. **s(n,m)** = transition function using double sigmoid
   - If n is in birth interval and m is low → brighten
   - If n is in death interval and m is high → darken
4. **Color bleeding** = RGB values blend from neighbors during transitions
5. **Restoration** = exponential decay toward original
6. **Mix** = final blend control

Based on: https://arxiv.org/abs/1111.1567 (SmoothLife paper)
