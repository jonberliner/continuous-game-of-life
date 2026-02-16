# Continuous Game of Life (Art Build)

An image-driven, edge-aware, continuous Game-of-Life experiment focused on **regional evolution**, **section behavior**, and **palette drift** rather than binary cells.

## Artistic Goals

This project is aimed at a specific look:

- Keep the feeling that "a life-like rule" is running underneath the visuals.
- Infer or construct **sections/pockets** that evolve semi-independently.
- Let color evolve in meaningful region-level ways (not pure static noise).
- Preserve a memory of the source image without snapping back too hard.
- Support exploratory, artist-friendly control rather than exposing raw math.

The intended result over time is: **coherent local ecosystems**, occasional discrete color shifts, and a slow return pressure toward the source structure.

## Current Modes

- **Spatial**: Main mode for section-based local evolution.
- **Frequency**: Alternate harmonic-style mode (experimental).

## Current Slider Surface (What Exists Now)

### Core controls

- **Evolution Energy**  
  Overall "how alive" the simulation feels (speed + instability mapped together).

- **Pattern Size**  
  Small local motifs <-> broad, larger-scale structures.

- **Section Strength**  
  How independently pockets evolve versus blending across boundaries.

- **Tile Granularity**  
  Size/density of synthetic section tiling used to encourage closed compartments.

- **Natural Edge Adherence**  
  How much section boundaries follow image edges vs synthetic sectioning.

- **Color Novelty**  
  How far colors are allowed to drift from source-like palettes.

- **Memory**  
  Long-term pull back toward the source image.

### Advanced controls (optional)

- **Edge Detail**
- **Micro Detail Influence**
- **Texture Persistence**

## Honest Critique of Current Controls

This build is still in transition. The controls are better than raw technical sliders, but there are still UX issues:

- **Concept overlap**: `Section Strength`, `Tile Granularity`, and `Natural Edge Adherence` can feel coupled in non-obvious ways.
- **Name ambiguity**: `Color Novelty` currently influences multiple hidden internals (noise, mutation, saturation behavior), so outcomes can feel broader than expected.
- **Mode mismatch**: same top-level UI drives both spatial and frequency internals, but not every control has equally clear meaning in both.
- **Hidden mapping opacity**: macro sliders map to several engine params; this is useful, but hard to reason about without visible feedback.

## Suggested Improvement Direction (More Succinct + More Expressive)

If we optimize for clarity, the ideal default set is likely:

- `Energy`
- `Pattern Size`
- `Sectioning`
- `Edge Fidelity`
- `Palette Change`
- `Memory`

with everything else under Advanced.

Also strongly recommended:

- Live descriptor text per slider position (`Calm / Balanced / Wild`, etc.).
- A debug overlay toggle for section boundaries (`Show Sections`).
- Better preset coverage (`Organic`, `Regional`, `Dreamy`, `Wild`, `Source Memory`).

## Technical Sketch (Current Pipeline)

1. Source image upload / resize
2. Edge map generation
3. Section map synthesis (edge-informed + synthetic closure)
4. Neighborhood convolution (edge/section aware)
5. Structured texture update (section-aware)
6. Transition step (continuous life-like luminance + coupled color evolution + mutation)
7. Render

## Running Locally

Use a local server (modules will fail under `file://`).

```bash
npm install
npm run dev
```

or:

```bash
./start-server.sh
```

Then open the local URL shown in terminal.

## Credits

- Inspired by **SmoothLife** (Stephan Rafler): https://arxiv.org/abs/1111.1567
- Related inspiration: fuzzy-life and other continuous CA visual systems

## License

MIT
