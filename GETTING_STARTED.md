# Getting Started

## Quick Start

**⚠️ IMPORTANT: You must run a local web server** (can't open index.html directly due to CORS restrictions with ES6 modules)

### Easiest Method (macOS/Linux):

1. **Open Terminal** in this folder
2. **Run the start script:**
   ```bash
   ./start-server.sh
   ```
3. **Open your browser** to: http://localhost:8080
4. **Upload an image** and watch it evolve!

### Alternative Methods:

**Option 1: Python (most compatible)**
```bash
python3 -m http.server 8080
# Then open: http://localhost:8080
```

**Option 2: Using VS Code**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

**Option 3: Using Node.js**
```bash
npx serve -l 8080
# Then open: http://localhost:8080
```

**Option 4: Using PHP**
```bash
php -S localhost:8080
# Then open: http://localhost:8080
```

## Controls

### Image Controls
- **Choose File**: Upload any image (JPG, PNG, GIF, etc.)
- **Pause/Play**: Stop or resume the simulation
- **Reset**: Go back to the original image

### Parameter Sliders

**Radii** - Define the neighborhood size
- Inner Radius: The "cell" itself (default: 3)
- Outer Radius: The neighborhood ring (default: 9)

**Birth Interval** - When cells brighten
- Birth Min: Lower threshold (default: 0.278)
- Birth Max: Upper threshold (default: 0.365)

**Death Interval** - When cells darken
- Death Min: Lower threshold (default: 0.267)
- Death Max: Upper threshold (default: 0.445)

**Dynamics** - Control the evolution
- Smoothness: Transition sharpness (default: 0.147)
- Time Step: Evolution speed (default: 0.1)
- **Restoration: How strongly the original image pulls back (default: 0.05)**
  - 0 = no restoration, image will warp away completely
  - 0.5 = strong restoration, always close to original

### Presets

Try these for different effects:
- **Default**: Balanced evolution with organic patterns
- **Chaotic**: Wild, rapidly changing patterns
- **Stable**: Gentle, slow-moving patterns
- **Waves**: Flowing, wave-like movements

## Tips for Best Results

1. **Start with restoration around 0.05-0.15** - This creates the "trippy warping but always coming back" effect

2. **High-contrast images work best** - Photos with distinct features, patterns, or colors

3. **Experiment with radii** - Larger outer radius = more global patterns, smaller = more local detail

4. **Adjust time step** - Lower for slow-motion effects, higher for faster evolution

5. **Watch for stability** - Some parameter combinations create stable patterns, others create chaos!

## What's Happening?

The algorithm:

1. **Calculates luminance** from RGB for each pixel
2. **Computes neighborhood averages** (inner disk and outer ring)
3. **Applies birth/death rules** based on luminance using smooth sigmoid functions
4. **Blends colors** from neighbors during transitions (color bleeding)
5. **Pulls back toward original** image by the restoration amount
6. **All 4 channels (RGBA) evolve** including transparency!

The result is a continuous, smooth version of Conway's Game of Life that creates mesmerizing warping effects while maintaining the essence of your image.

## Troubleshooting

**Black screen or no image?**
- Check browser console (F12) for WebGL errors
- Try a different browser
- Ensure WebGL is enabled in your browser

**Image not uploading?**
- Check file format (use JPG, PNG, GIF)
- Try a smaller image first
- Check browser console for errors

**Too slow?**
- Try smaller images
- Reduce outer radius
- Close other browser tabs

**Nothing is changing?**
- Make sure you clicked Play (not paused)
- Try increasing Time Step
- Try the "Chaotic" preset

## Have Fun!

Experiment with different images and parameters. Some combinations create stable, breathing patterns. Others create chaotic storms of color. The restoration parameter is key to keeping it "tethered" to your original image while still allowing wild transformations!
