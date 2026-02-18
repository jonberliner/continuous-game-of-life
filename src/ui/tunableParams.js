/**
 * Tunable parameter definitions — the single source of truth for every
 * parameter in the Core V1 CA simulation.
 *
 * Each entry defines:
 *   key     – JS param name and GLSL uniform (u_<key>)
 *   default – current default value
 *   min/max/step – slider range
 *   group   – collapsible UI group heading
 *   label   – human-readable name
 *   hint    – functional description: what happens when you increase/decrease
 *   shader  – which shader uses it: 'transition' | 'convolution' | 'display'
 */

export const TUNABLE_PARAMS = [

    // ================================================================
    //  LUMINANCE (L) DYNAMICS
    // ================================================================
    
    { key: 'coreLRate',              default: 1.00, min: 0.0,   max: 10.0, step: 0.1,   group: 'Luminance (L)', label: 'L Update Rate',           hint: '↑ Faster L changes, more responsive. ↓ Slower, more inertial',      shader: 'transition' },
    { key: 'coreLDiffGain',          default: 0.50, min: 0.0,   max: 2.0,  step: 0.1,   group: 'Luminance (L)', label: 'L Diffusion',             hint: '↑ More smoothing, larger bright/dark regions. ↓ More isolated',     shader: 'transition' },
    { key: 'memoryDecay',            default: 0.05, min: 0.01,  max: 0.20, step: 0.01,  group: 'Luminance (L)', label: 'Memory Decay',            hint: '↑ Faster momentum tracking, smaller oscillations. ↓ Slower, larger waves', shader: 'transition' },
    { key: 'historyOscillationGain', default: 0.80, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Luminance (L)', label: 'Oscillation Strength',    hint: '↑ Stronger anti-damping, perpetual motion. ↓ Can reach equilibrium', shader: 'transition' },
    { key: 'divergenceGain',         default: 0.60, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Luminance (L)', label: 'Divergence',              hint: '↑ Similar cells pushed apart more, prevents uniformity. ↓ Allows similarity', shader: 'transition' },
    { key: 'moderationGain',         default: 0.20, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Luminance (L)', label: 'Moderation',              hint: '↑ Very different cells pulled together. ↓ Allows extreme differences', shader: 'transition' },
    { key: 'varianceAmplifyGain',    default: 0.50, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Luminance (L)', label: 'Variance Boost',          hint: '↑ Amplifies changes at borders more. ↓ Uniform change rate',        shader: 'transition' },
    { key: 'flatBreakupGain',        default: 0.50, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Luminance (L)', label: 'Flat Breakup',            hint: '↑ Destabilizes flat regions more, adds texture. ↓ Flat more stable', shader: 'transition' },
    { key: 'noiseGain',              default: 0.05, min: 0.0,   max: 0.10, step: 0.005, group: 'Luminance (L)', label: 'Noise',                   hint: '↑ More random perturbation, less predictable. ↓ More deterministic', shader: 'transition' },
    { key: 'contrastGain',           default: 0.50, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Luminance (L)', label: 'Contrast',                hint: '↑ Sharper L boundaries, crisper edges. ↓ Softer gradients',         shader: 'transition' },
    { key: 'coreMaxDeltaL',          default: 0.08, min: 0.01,  max: 0.30, step: 0.01,  group: 'Luminance (L)', label: 'Max L Change/Step',       hint: '↑ Allows faster L jumps per frame. ↓ Slower, smoother evolution',   shader: 'transition' },

    // ================================================================
    //  CHROMA (COLOR) DYNAMICS
    // ================================================================
    
    { key: 'coreColorRate',          default: 1.00, min: 0.0,   max: 10.0, step: 0.1,   group: 'Chroma (Color)', label: 'Color Update Rate',       hint: '↑ Faster color changes, dynamic hues. ↓ Slower, more stable colors', shader: 'transition' },
    { key: 'coreAdoptGain',          default: 1.00, min: 0.0,   max: 4.0,  step: 0.1,   group: 'Chroma (Color)', label: 'Color Adoption',          hint: '↑ Stronger color mixing from neighbors. ↓ More isolated colors',      shader: 'transition' },
    { key: 'coreGrowthHueCoupling',  default: 0.40, min: 0.0,   max: 2.0,  step: 0.1,   group: 'Chroma (Color)', label: 'Momentum Hue Coupling',   hint: '↑ L momentum drives more hue rotation. ↓ Less rotation',              shader: 'transition' },
    { key: 'coreMaxDeltaAB',         default: 0.08, min: 0.01,  max: 0.30, step: 0.01,  group: 'Chroma (Color)', label: 'Max Color Change/Step',   hint: '↑ Faster color jumps per frame. ↓ Slower, smoother transitions',      shader: 'transition' },

    // ================================================================
    //  DIVERSITY & ANTI-DEGENERACY
    // ================================================================
    
    { key: 'diversityKick',          default: 0.50, min: 0.0,   max: 2.0,  step: 0.1,   group: 'Diversity', label: 'Diversity Kick',         hint: '↑ Stronger push when colors uniform, more variety. ↓ Allows uniformity', shader: 'transition' },
    { key: 'antiConsensusGain',      default: 0.40, min: 0.0,   max: 1.5,  step: 0.05,  group: 'Diversity', label: 'Anti-Consensus',         hint: '↑ Flat color fields break up more. ↓ Flat patches more stable',       shader: 'transition' },
    { key: 'vorticityGain',          default: 0.15, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Diversity', label: 'Vorticity',              hint: '↑ L field circulation drives color spirals more. ↓ Less spirals',     shader: 'transition' },

    // ================================================================
    //  STATE-DEPENDENT ANGLES
    // ================================================================
    
    { key: 'angleL',                 default: 0.5,  min: -2.0,  max: 2.0,  step: 0.1,   group: 'State Angles', label: 'L → Angle',        hint: '↑ Bright/dark regions rotate more differently. ↓ Less L effect. Negative reverses',    shader: 'transition' },
    { key: 'angleM',                 default: 1.0,  min: -2.0,  max: 2.0,  step: 0.1,   group: 'State Angles', label: 'Momentum → Angle', hint: '↑ Oscillation phase determines rotation more (vortex pairs). ↓ Less phase effect. Negative reverses', shader: 'transition' },
    { key: 'angleS',                 default: 0.3,  min: -2.0,  max: 2.0,  step: 0.1,   group: 'State Angles', label: 'Saturation → Angle', hint: '↑ Vivid vs gray colors behave more differently. ↓ Less saturation effect. Negative reverses',  shader: 'transition' },
    { key: 'angleV',                 default: 0.8,  min: 0.0,   max: 2.0,  step: 0.1,   group: 'State Angles', label: 'Variance → Angle', hint: '↑ Borders have stronger tangential flow (around obstacles). ↓ More direct flow. Always positive', shader: 'transition' },

    // ================================================================
    //  ANGLE DEGENERACY FIXES
    // ================================================================
    
    { key: 'angleQuantization',      default: 4.0,  min: 1.0,   max: 16.0, step: 1.0,   group: 'Angle Fixes', label: 'Angle Quantization',   hint: '↑ More discrete rotation directions (16=fine). ↓ Fewer (4=quadrants). 1=continuous smooth spirals', shader: 'transition' },
    { key: 'spatialFrequency',       default: 5.0,  min: 1.0,   max: 20.0, step: 1.0,   group: 'Angle Fixes', label: 'Spatial Frequency',    hint: '↑ Finer spatial variation in angles, smaller domains. ↓ Coarser, larger domains',        shader: 'transition' },
    { key: 'positionAngleBias',      default: 0.5,  min: 0.0,   max: 2.0,  step: 0.1,   group: 'Angle Fixes', label: 'Position Bias',        hint: '↑ Stronger position-dependent rotation, breaks sync. ↓ More uniform angles',            shader: 'transition' },
    { key: 'momentumThreshold',      default: 0.8,  min: 0.5,   max: 2.0,  step: 0.1,   group: 'Angle Fixes', label: 'Momentum Lock',        hint: '↑ Higher momentum needed for perpendicular lock. ↓ Locks easier (more vortex cores)',   shader: 'transition' },
    { key: 'varianceThreshold',      default: 0.6,  min: 0.3,   max: 1.5,  step: 0.1,   group: 'Angle Fixes', label: 'Variance Lock',        hint: '↑ Higher variance needed for tangent lock. ↓ Tangent flow triggers easier at borders',  shader: 'transition' },
    { key: 'memoryFreqScale',        default: 10.0, min: 1.0,   max: 50.0, step: 1.0,   group: 'Angle Fixes', label: 'Memory Frequency',     hint: '↑ More spatial variation in oscillation rate. ↓ More uniform oscillation',              shader: 'transition' },

    // ================================================================
    //  MULTI-STABLE ATTRACTORS
    // ================================================================
    
    { key: 'attractorGain',          default: 0.30, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Attractors', label: 'Attractor Strength',  hint: '↑ Stronger pull to discrete L levels, more clustering. ↓ More continuous brightness',    shader: 'transition' },
    { key: 'attractor1',             default: 0.15, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Attractors', label: 'Dark Level',          hint: 'Position of dark attractor (0=black, 1=white). Cells cluster near this value',          shader: 'transition' },
    { key: 'attractor2',             default: 0.50, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Attractors', label: 'Mid Level',           hint: 'Position of mid attractor. Cells cluster near this value',                              shader: 'transition' },
    { key: 'attractor3',             default: 0.85, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Attractors', label: 'Bright Level',        hint: 'Position of bright attractor. Cells cluster near this value',                           shader: 'transition' },

    // ================================================================
    //  BOUNDARY SHARPENING
    // ================================================================
    
    { key: 'boundaryAmplify',        default: 0.50, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Boundaries', label: 'Amplification',      hint: '↑ Sharper state transitions, snappier changes. ↓ Smoother gradual transitions',          shader: 'transition' },
    { key: 'hysteresisGain',         default: 0.30, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Boundaries', label: 'Hysteresis',         hint: '↑ More resistance to mid-range changes, more stable. ↓ Easier to transition',           shader: 'transition' },
    { key: 'competitionGain',        default: 0.40, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Boundaries', label: 'Competition',        hint: '↑ Stronger winner-take-all, larger differences. ↓ More egalitarian, smaller differences', shader: 'transition' },

    // ================================================================
    //  HYBRID SMOOTHLIFE KERNEL (PHASE A)
    // ================================================================
    
    { key: 'kernelBlend',            default: 0.00, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Kernel Blend',      hint: '↑ Blend in SmoothLife core dynamics. 0 keeps legacy behavior',                           shader: 'transition' },
    { key: 'kernelGrowthGain',       default: 0.25, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Kernel Growth Gain', hint: '↑ Stronger SmoothLife growth/survival drive on L',                                         shader: 'transition' },
    { key: 'kernelInhibitGain',      default: 0.20, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Lateral Inhibition', hint: '↑ More mid-range suppression (helps discrete local regions)',                              shader: 'transition' },
    { key: 'kernelInnerRatio',       default: 0.50, min: 0.20,  max: 0.90, step: 0.02,  group: 'Kernel Hybrid', label: 'Inner Radius Ratio', hint: '↑ Larger inner disk relative to outer radius',                                                 shader: 'transition' },
    { key: 'kernelTransitionWidth',  default: 0.08, min: 0.01,  max: 0.30, step: 0.01,  group: 'Kernel Hybrid', label: 'Transition Width',  hint: '↑ Softer SmoothLife windows. ↓ Sharper, more step-like switching',                        shader: 'transition' },
    { key: 'kernelBirthCenter',      default: 0.30, min: 0.0,   max: 1.0,  step: 0.01,  group: 'Kernel Hybrid', label: 'Birth Center',      hint: 'Center of outer-ring density window that tends to activate cells',                        shader: 'transition' },
    { key: 'kernelBirthWidth',       default: 0.18, min: 0.01,  max: 0.60, step: 0.01,  group: 'Kernel Hybrid', label: 'Birth Width',       hint: 'Width of birth window. Narrower gives more selective activation',                         shader: 'transition' },
    { key: 'kernelSurvivalCenter',   default: 0.46, min: 0.0,   max: 1.0,  step: 0.01,  group: 'Kernel Hybrid', label: 'Survival Center',   hint: 'Center of outer-ring density window that sustains active cells',                          shader: 'transition' },
    { key: 'kernelSurvivalWidth',    default: 0.22, min: 0.01,  max: 0.60, step: 0.01,  group: 'Kernel Hybrid', label: 'Survival Width',    hint: 'Width of survival window. Narrower favors sharper persistent structures',                 shader: 'transition' },
    { key: 'kernelColorToLGain',     default: 0.15, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Color -> L Coupling', hint: '↑ Chroma mismatch pushes L structure more (color drives shape)',                            shader: 'transition' },
    { key: 'kernelLToColorGain',     default: 0.25, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'L -> Color Coupling', hint: '↑ Kernel activity drives color advection more (shape drives color motion)',                shader: 'transition' },
    { key: 'colorWaveDamping',       default: 0.75, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Color Wave Damping', hint: '↑ Suppresses broad non-local color waves; favors local transport',                           shader: 'transition' },
    { key: 'colorPocketGain',        default: 0.35, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Color Pocket Gain',  hint: '↑ Reinforces local chroma neighborhoods against global color averaging',                    shader: 'transition' },

    // ================================================================
    //  SOURCE GUIDANCE (STRUCTURAL BIAS, NO OVERLAY)
    // ================================================================

    { key: 'sourceGuidanceGain',     default: 0.55, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Source Guidance', label: 'Guidance Gain',      hint: '↑ Stronger source-geometry influence on local rule coefficients',                        shader: 'transition' },
    { key: 'sourceAnisotropy',       default: 1.20, min: 0.0,   max: 4.0,  step: 0.1,   group: 'Source Guidance', label: 'Kernel Anisotropy',  hint: '↑ Kernel elongates more along source orientation where coherence is high',               shader: 'transition' },
    { key: 'sourceCoherenceFloor',   default: 0.20, min: 0.0,   max: 1.0,  step: 0.02,  group: 'Source Guidance', label: 'Coherence Floor',   hint: 'Minimum coherence required before orientation bias activates strongly',                   shader: 'transition' },
    { key: 'sourceRidgeBias',        default: 0.35, min: -1.0,  max: 1.0,  step: 0.05,  group: 'Source Guidance', label: 'Ridge Growth Bias', hint: 'Positive: ridges favor growth; negative: ridges favor inhibition',                        shader: 'transition' },
    { key: 'sourceEdgeFrequency',    default: 0.55, min: 0.0,   max: 1.0,  step: 0.02,  group: 'Source Guidance', label: 'Edge Frequency',    hint: '↑ Use finer details in source edges. ↓ Use broader/coarser structure',                  shader: 'existing' },
    { key: 'showGuidanceEdges',      default: false,                                   group: 'Source Guidance', label: 'Show Guidance Edges', hint: 'Overlay the source guidance edges used by the kernel',                                    shader: 'display', control: 'checkbox' },

    // ================================================================
    //  SYSTEM PARAMETERS
    // ================================================================
    
    { key: 'deltaTime',              default: 0.50, min: 0.01,  max: 5.0,  step: 0.05,  group: 'System', label: 'Simulation Speed',        hint: '↑ Faster evolution, larger timesteps. ↓ Slower, smaller steps, more stable',           shader: 'transition' },
    { key: 'radius',                 default: 0.03, min: 0.005, max: 0.10, step: 0.002, group: 'System', label: 'Convolution Radius',      hint: '↑ Larger neighborhood sampling, bigger features. ↓ Smaller neighborhoods, finer detail', shader: 'convolution' },

];
