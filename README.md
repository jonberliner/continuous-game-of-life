# Continuous Game of Life - RGBA

A WebGL-based implementation of SmoothLife (continuous Game of Life) for RGBA images with restoration forces.

## Features

- **Continuous Cellular Automata**: Extends Conway's Game of Life to continuous space using the SmoothLife algorithm
- **RGBA Evolution**: All four color channels evolve independently with luminance-based birth/death rules
- **Color Bleeding**: Neighboring colors influence each other during transitions
- **Restoration Force**: Original image continuously "pumps back in" creating trippy warping effects
- **Real-time WebGL**: Fast GPU-accelerated computation using fragment shaders
- **Interactive Controls**: Adjust all parameters in real-time

## How It Works

### SmoothLife Algorithm

Based on the paper ["Generalization of Conway's Game of Life to a Continuous Domain"](https://arxiv.org/abs/1111.1567):

1. **Inner Disk (m)**: Average luminance of pixels within inner radius
2. **Outer Ring (n)**: Average luminance of pixels between inner and outer radius
3. **Transition Function**: Smooth sigmoid-based birth/death rules
4. **Color Bleeding**: RGB values blend with neighbors during transitions
5. **Restoration**: Continuously pulls image back toward original state

### RGBA Extension

- **Luminance-based decisions**: Birth/death determined by luminance (weighted RGB average)
- **Color bleeding**: RGB values from neighbors blend in during active transitions
- **Alpha evolution**: Alpha channel evolves along with RGB
- **Restoration force**: Prevents total divergence from original image

## Usage

1. Open `index.html` in a modern web browser
2. Upload an image (automatically resized to max 1080px on longest axis)
3. Adjust parameters:
   - **Radii**: Inner and outer neighborhood sizes
   - **Birth Interval**: When cells are "born"
   - **Death Interval**: When cells "die"
   - **Smoothness**: Transition sharpness (alpha)
   - **Time Step**: Evolution speed
   - **Restoration**: How strongly original image pulls back (0-0.5)
4. Try presets for different effects

## Parameters Explained

- **Inner/Outer Radius**: Defines the neighborhood size for computing averages
- **Birth Min/Max**: Cells with neighbor luminance in this range will brighten
- **Death Min/Max**: Cells with neighbor luminance in this range will darken
- **Smoothness (alphaM)**: Lower = sharper transitions, higher = smoother
- **Time Step (deltaTime)**: How fast the simulation evolves
- **Restoration**: Strength of pull back to original image (0 = none, 0.5 = strong)

## Project Structure

```
continuous-game-of-life/
├── index.html              # Main HTML entry point
├── styles/
│   └── main.css           # All styling
├── src/
│   ├── main.js            # Application orchestration
│   ├── core/
│   │   └── smoothlife.js  # WebGL SmoothLife engine
│   ├── render/
│   │   ├── shaders.js     # WebGL shaders (vertex, convolution, transition)
│   │   ├── webglUtils.js  # WebGL utilities
│   │   └── imageLoader.js # Image loading and resizing
│   └── ui/
│       └── controls.js    # UI parameter controls
└── README.md
```

## Technical Details

### Two-Pass Rendering

1. **Convolution Pass**: Computes inner disk and outer ring averages
2. **Transition Pass**: Applies SmoothLife rules, color bleeding, and restoration

### Shader Architecture

- **Convolution Shader**: Samples circular neighborhoods, computes weighted averages
- **Transition Shader**: Implements sigmoid birth/death, color blending, restoration
- **Vertex Shader**: Simple fullscreen quad

### Performance

WebGL fragment shaders enable real-time computation for large images. The convolution pass samples in circular patterns optimized for typical radii (3-40 pixels).

## Browser Compatibility

Requires WebGL support. Tested on:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Credits

Based on the SmoothLife paper by Stephan Rafler:
- Paper: https://arxiv.org/abs/1111.1567
- Inspired by: https://github.com/breadloafsky/fuzzy-life

## License

MIT License - Feel free to use and modify!
