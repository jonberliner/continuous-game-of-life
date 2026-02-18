/**
 * Tunable parameter definitions — CORE V1 ONLY
 * 
 * This is a cleaned version showing only implemented Core V1 mechanisms.
 * Legacy SmoothLife parameters have been removed.
 *
 * Each entry defines:
 *   key     – JS param name, HTML slider id, and GLSL uniform (u_<key>)
 *   default – current default value
 *   min/max/step – slider range
 *   group   – collapsible UI group heading
 *   label   – human-readable name
 *   hint    – one-line tooltip / description
 *   shader  – which shader program uses it: 'transition' | 'convolution' | 'existing'
 */

export const TUNABLE_PARAMS = [

    // ================================================================
    //  CORE V1: LUMINANCE DYNAMICS (Phase 1)
    // ================================================================
    { key: 'coreLRate',              default: 1.00, min: 0.0,   max: 10.0, step: 0.1,   group: 'Luminance (L)', label: 'L Update Rate',           hint: 'Overall speed of L dynamics',                                                         shader: 'transition' },
    { key: 'coreLDiffGain',          default: 0.50, min: 0.0,   max: 2.0,  step: 0.1,   group: 'Luminance (L)', label: 'L Diffusion',             hint: 'Spatial smoothing strength. Higher = larger coherent patterns',                       shader: 'transition' },
    { key: 'memoryDecay',            default: 0.05, min: 0.01,  max: 0.20, step: 0.01,  group: 'Luminance (L)', label: 'Memory Decay',            hint: 'How fast momentum (M) tracks L. Lower = slower oscillations, larger amplitude',      shader: 'transition' },
    { key: 'historyOscillationGain', default: 0.80, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Luminance (L)', label: 'Oscillation Strength',    hint: 'Anti-damping force from L-M deviation. Creates sustained oscillation',               shader: 'transition' },
    { key: 'divergenceGain',         default: 0.60, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Luminance (L)', label: 'Divergence Pressure',     hint: 'Pushes similar cells apart. Prevents uniformity',                                     shader: 'transition' },
    { key: 'moderationGain',         default: 0.20, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Luminance (L)', label: 'Moderation',              hint: 'Pulls very different cells together. Limits extremes',                                shader: 'transition' },
    { key: 'varianceAmplifyGain',    default: 0.50, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Luminance (L)', label: 'Variance Boost',          hint: 'Amplifies changes in high-variance (border) regions',                                 shader: 'transition' },
    { key: 'flatBreakupGain',        default: 0.50, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Luminance (L)', label: 'Flat Breakup',            hint: 'Destabilizes uniform/flat regions. Prevents static patches',                          shader: 'transition' },
    { key: 'noiseGain',              default: 0.05, min: 0.0,   max: 0.10, step: 0.005, group: 'Luminance (L)', label: 'Noise Strength',          hint: 'Subtle stochastic perturbation. Breaks symmetry in stable regions',                   shader: 'transition' },
    { key: 'coreMaxDeltaL',          default: 0.08, min: 0.01,  max: 0.30, step: 0.01,  group: 'Luminance (L)', label: 'Max L Change',            hint: 'Rate limiter for L updates. Prevents numerical instability',                          shader: 'transition' },

    // ================================================================
    //  CORE V1: CHROMA DYNAMICS (Phase 1)
    // ================================================================
    { key: 'coreColorRate',          default: 1.00, min: 0.0,   max: 10.0, step: 0.1,   group: 'Chroma (Color)', label: 'Color Update Rate',       hint: 'Overall speed of chroma dynamics',                                                    shader: 'transition' },
    { key: 'coreAdoptGain',          default: 1.00, min: 0.0,   max: 4.0,  step: 0.1,   group: 'Chroma (Color)', label: 'Color Adoption',          hint: 'Non-monotonic adoption strength. Controls color propagation',                         shader: 'transition' },
    { key: 'coreGrowthHueCoupling',  default: 0.80, min: 0.0,   max: 2.0,  step: 0.1,   group: 'Chroma (Color)', label: 'Momentum Hue Coupling',   hint: 'L-momentum drives hue rotation. Creates continuous color flow',                       shader: 'transition' },
    { key: 'saturationGain',         default: 0.30, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Chroma (Color)', label: 'Saturation Coupling',     hint: 'How strongly L activity influences saturation (active = vivid)',                      shader: 'transition' },
    { key: 'coreMaxDeltaAB',         default: 0.08, min: 0.01,  max: 0.30, step: 0.01,  group: 'Chroma (Color)', label: 'Max Chroma Change',       hint: 'Rate limiter for chroma updates. Prevents numerical instability',                     shader: 'transition' },

    // ================================================================
    //  CORE V1: DIVERSITY MECHANISMS (Phase 1 + 2)
    // ================================================================
    { key: 'diversityKick',          default: 0.50, min: 0.0,   max: 2.0,  step: 0.1,   group: 'Diversity & Anti-Degeneracy', label: 'Diversity Kick',         hint: 'Perpendicular push when colors too uniform. Creates hue rotation',                    shader: 'transition' },
    { key: 'antiConsensusGain',      default: 0.40, min: 0.0,   max: 1.5,  step: 0.05,  group: 'Diversity & Anti-Degeneracy', label: 'Anti-Consensus',         hint: 'Perpendicular force in flat color fields (Laplacian). Prevents uniform patches',      shader: 'transition' },
    { key: 'vorticityGain',          default: 0.30, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Diversity & Anti-Degeneracy', label: 'Vorticity',              hint: 'L field circulation rotates colors. Creates spirals and waves from L structure',      shader: 'transition' },

    // ================================================================
    //  SYSTEM PARAMETERS
    // ================================================================
    { key: 'deltaTime',              default: 0.20, min: 0.01,  max: 1.0,  step: 0.01,  group: 'System', label: 'Timestep',                  hint: 'Simulation timestep. Higher = faster evolution',                                      shader: 'existing' },
    { key: 'radius',                 default: 0.03, min: 0.005, max: 0.10, step: 0.002, group: 'System', label: 'Convolution Radius',        hint: 'Neighborhood sampling radius (fraction of canvas size)',                              shader: 'convolution' },
    { key: 'edgeDetail',             default: 0.50, min: 0.0,   max: 1.0,  step: 0.05,  group: 'System', label: 'Edge Detection',            hint: 'Edge detector sensitivity (currently minimal effect on Core V1)',                    shader: 'existing' },
    { key: 'boundaryStrength',       default: 0.10, min: 0.0,   max: 1.0,  step: 0.05,  group: 'System', label: 'Boundary Dampening',        hint: 'How much detected edges slow down dynamics',                                          shader: 'transition' },
];
