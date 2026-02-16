# Continuous Game of Life (WebGL Art Lab)

Image-driven continuous cellular dynamics with edge-aware regional behavior.
The app runs two modes:

- `Spatial` mode: main mode, edge/section aware, GoL-like luminance + GoL-like RGB channel updates.
- `Frequency` mode: simplified multi-scale RGB evolution (experimental, not true FFT).

## What The App Currently Does

1. Loads an image and resizes it (max long side 1080) in `src/render/imageLoader.js`.
2. Builds an edge map from the source image.
3. Builds a section/barrier map from edges (soft barriers).
4. Computes neighborhood convolution with edge barrier attenuation.
5. Evolves structured noise texture.
6. Evolves state with continuous GoL-like rules and region-aware pumping.
7. Renders either final color or section debug view.

Main orchestration: `src/main.js`  
Spatial engine: `src/core/smoothlife.js`  
Frequency engine: `src/core/frequencyEngine.js`  
Spatial shaders: `src/render/shaders.js`

## UI Surface (Current)

### Core controls

- `Edge Fineness`: edge detector detail level.
- `Edge Pump`: source-color pull near section boundaries.
- `Edge Merge`: coarse/fine section merge behavior.
- `Kernel Width`: GoL neighborhood width (slider is log-mapped to percent-of-image radius).
- `Color Hazard`: per-region color pump event frequency.
- `Palette Stability`: how long region palette targets persist.
- `Source Color Adherence`: source-region color influence on pumped palette.
- `Simulation Speed`: simulation rate (not rule amplitude).
- `Evolution Energy`: maps to activity + chaos internals.

### Advanced controls

- `Micro Detail Influence`
- `Texture Persistence`
- `Boundary Leakage`
- `Show Sections` (debug render toggle)

### Other UI

- Image upload
- Mode switch (`Spatial` / `Frequency`)
- Preset buttons (`Organic`, `Regional`, `Dreamy`, `Wild`, `Source Memory`)
- Pause / Reset

## Parameter Mapping Notes

The UI is artist-facing and maps to multiple internal uniforms in `src/ui/controls.js`:

- `Evolution Energy` drives both `activity` and `chaos`.
- `Kernel Width` slider position `t in [0,1]` maps logarithmically:
  - `radius = 0.001 * (1000 ^ t)` (as fraction of average image dimension).
- `Simulation Speed` controls how many fixed-delta sim steps are processed per frame.
  - Rule delta remains fixed (`0.2`) for stability.

## Spatial Mode Model (Current)

- Luminance evolves via continuous GoL-like birth/survival windows.
- RGB channels also evolve with channel-wise GoL-like targets.
- Section barriers attenuate neighborhood influence across strong boundaries.
- Hazard drives region-keyed stochastic pump events (frequency from slider).
- Pump colors blend free palette vs source-region palette via source adherence.
- Edge pump and image pump then pull toward source in controlled ways.

## Frequency Mode (Current)

This mode is currently a simplified multi-scale RGB system:

- Convolution uses different radii per channel (`R > G > B`).
- Evolution uses continuous GoL-like channel updates plus optional random noise and image restore.
- It is not a formal Fourier transform / FFT pipeline.

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

## FIXME (Current Known Issues / Next Work)

- `UI duplicate IDs`: `index.html` includes duplicate `pauseBtn` and `resetBtn` elements. Keep one canonical pair to avoid ambiguous event binding.
- `Region separation`: some images still over-merge sections, causing globally cohesive color fields instead of clearly distinct pocket palettes.
- `Section control coupling`: `Edge Merge`, `Boundary Leakage`, and `Micro Detail Influence` remain perceptually coupled in ways that are hard to predict.
- `Hazard semantics`: hazard now controls region pump event frequency, but perceived effect still depends on section quality and palette stability.
- `Frequency mode naming`: current "Frequency" implementation is multi-scale spatial approximation, not FFT-domain evolution; rename or implement true spectral pipeline.
- `Debug observability`: add live diagnostics (effective hazard rate, section count estimate, mean section area) to verify slider intent numerically.
- `Performance scaling`: very large radii and high step rates can still create heavy GPU load on lower-end devices.
- `Test coverage`: no automated regression tests for shader behavior, slider mappings, or mode switching.

## Credits

- Inspired by SmoothLife (Stephan Rafler): https://arxiv.org/abs/1111.1567
- Related inspiration: fuzzy-life and continuous cellular automata art systems.

## License

MIT
