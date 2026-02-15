# Continuous Game of Life - RGBA (v2.0)

A WebGL-based implementation of SmoothLife with **edge-guided constraints**, **momentum-based flow**, and **smart patch injection**.

## What Makes This Special

This isn't just a trippy image filter - it's **Game of Life running on a continuous domain**, constrained by the edges of your image. The cellular automata rules create organic patterns, while edges keep the structure recognizable.

### The Core Idea

1. **Game of Life at the heart**: SmoothLife rules determine how pixels brighten/darken based on neighbors
2. **Edges as anchors**: Edge detection keeps the structure tethered
3. **Patches warp freely**: Areas between edges evolve under GoL rules
4. **Smart injection**: Patches "remember" their original colors and inject them back
5. **Momentum creates flow**: Changes accumulate, creating flowing, never-settling motion

## How It Works

### The Pipeline

```
Original Image
    ↓
Edge Detection (Sobel) → Identifies structure
    ↓
Patch Statistics → Learns dominant colors per region
    ↓
Convolution → Computes GoL neighborhoods (inner/outer)
    ↓
Transition → Applies GoL rules + momentum + injection
    ↓
Velocity Update → Tracks momentum for continuous flow
    ↓
Render → Beautiful warping constrained by edges
```

### Artist-Friendly Controls

Gone are the cryptic birth/death intervals! New controls:

- **Chaos** (0-1): How unstable the GoL gets
  - Low = stable, orderly patterns
  - High = wild, overlapping birth/death creating perpetual motion
  
- **Flow** (0-1): How much momentum accumulates
  - Low = changes happen locally, stop quickly
  - High = changes ripple outward, create waves
  
- **Edge Anchor** (0-1): How strongly edges constrain
  - Low = edges blur and warp
  - High = edges stay sharp and fixed
  
- **Edge Detail** (0.05-0.8): Edge detection sensitivity
  - Low = only major edges (simplified structure)
  - High = fine details (intricate edge network)
  
- **Patch Memory** (0-1): How much patches remember original
  - Low = patches diverge completely in color
  - High = patches stay close to original palette
  
- **Turbulence** (0-1): Amount of smart disturbance
  - Injects patch-characteristic colors over time
  - Not random - respects original color distribution!

## The Game of Life Connection

Behind the scenes, it's still SmoothLife:
- **Inner/Outer Radii**: Define the cellular neighborhoods
- **Birth/Death Rules**: Determined by Chaos parameter
- **Sigmoid Transitions**: Smooth, continuous birth/death
- **Luminance-Based**: Brightness drives the rules
- **Color Bleeding**: RGB follows the luminance decisions

The beauty: **It's disguised Game of Life with artistic constraints!**

## What's Different from v1

### v1.0 (Original):
- Full image restoration (boring stability)
- Manual birth/death sliders (confusing)
- No momentum (settled into equilibrium)
- Random noise injection (no structure)

### v2.0 (This Version):
- ✅ Edge-only anchoring (structure preserved, interiors warp)
- ✅ Artist-friendly controls (describes outcomes, not math)
- ✅ Momentum/velocity field (perpetual motion)
- ✅ Smart patch injection (respects original colors/texture)
- ✅ Local variation in inertia (textured areas flow more)

## Technical Details

### Edge Detection
- Sobel operator for gradient magnitude and direction
- Adjustable sensitivity threshold
- Stores: edge strength, edge direction (cos/sin), luminance

### Patch Statistics
- Computes per-patch dominant colors
- Avoids edges (weights by 1 - edge strength)
- Stores: dominant RGB, color variance

### Momentum System
- Tracks velocity per pixel (stored in separate texture)
- Inertia varies by:
  - Distance from edges (center of patches = more inertia)
  - Texture variance (textured areas = more momentum)
  - Edge strength (edges = less momentum)
- Creates naturally flowing behavior!

### Smart Injection
- Uses Perlin noise for timing
- Injects dominant patch colors with variance
- Respects patch boundaries (edges block injection)
- Strength controlled by Turbulence × Patch Memory

## Usage Tips

1. **For continuous warping**: Chaos = 0.5+, Flow = 0.7+, Edge Anchor = 0.5-0.7
2. **For stable breathing**: Chaos = 0.2, Flow = 0.3, Edge Anchor = 0.8+
3. **For edge-locked chaos**: Chaos = 0.8, Flow = 0.9, Edge Anchor = 0.9
4. **High-contrast images work best** - more defined edges = better anchoring
5. **Experiment with Edge Detail** - simplify or complexify the structure

## Browser Compatibility

Requires WebGL 1.0. Tested on:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Credits

Based on:
- **SmoothLife** by Stephan Rafler (https://arxiv.org/abs/1111.1567)
- Inspired by fuzzy-life (https://github.com/breadloafsky/fuzzy-life)

## License

MIT - Use and modify freely!
