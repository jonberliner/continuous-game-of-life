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
    //  KERNEL-ONLY CORE (kernel blend fixed to 1.0)
    // ================================================================
    
    { key: 'coreLRate',              default: 1.00, min: 0.0,   max: 10.0, step: 0.1,   group: 'Kernel Core', label: 'L Update Rate',         hint: 'Global L rate for kernel-driven dynamics',                                                shader: 'transition' },
    { key: 'coreMaxDeltaL',          default: 0.08, min: 0.01,  max: 0.30, step: 0.01,  group: 'Kernel Core', label: 'Max L Change/Step',    hint: 'Rate limiter for L updates',                                                              shader: 'transition' },
    { key: 'refractoryGain',         default: 0.00, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Core', label: 'Refractory Gain',      hint: 'Suppresses rapid re-activation after high local activity (0 = off)',                     shader: 'transition' },
    { key: 'refractoryThreshold',    default: 0.12, min: 0.0,   max: 0.50, step: 0.01,  group: 'Kernel Core', label: 'Refractory Threshold', hint: 'Activity level where refractory suppression starts',                                       shader: 'transition' },
    { key: 'refractoryWidth',        default: 0.10, min: 0.01,  max: 0.50, step: 0.01,  group: 'Kernel Core', label: 'Refractory Width',     hint: 'Smoothness of refractory onset region',                                                   shader: 'transition' },
    { key: 'excitabilityGain',       default: 0.00, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Core', label: 'Excitability Gain',    hint: 'Low-activity wake-up drive from local state gradients (0 = off)',                        shader: 'transition' },
    { key: 'refractoryColorDamp',    default: 0.00, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Core', label: 'Refractory Color Damp', hint: 'Damps chroma transport during refractory periods',                                        shader: 'transition' },
    { key: 'structureIdentityMix',   default: 0.00, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Kernel Core', label: 'Structure Identity Mix', hint: 'Blends local structural observable into value composition (0 = classic L-only display)',   shader: 'display' },
    { key: 'structureIdentityColor', default: 0.00, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Kernel Core', label: 'Identity Color Lift',   hint: 'Lets structured regions retain more chroma when identity mix is active (0 = off)',       shader: 'display' },
    { key: 'satRegimeGain',          default: 0.10, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Core', label: 'Saturation Regime Gain', hint: 'Emergent local sat-regime shaping in CA state update (0 = off)',                        shader: 'transition' },
    { key: 'satRegimeSpread',        default: 0.08, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Core', label: 'Saturation Regime Spread', hint: 'Broadens coexistence of low/mid/high saturation regimes (0 = off)',                     shader: 'transition' },
    { key: 'lumaChromaCoexistGain',  default: 0.20, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Core', label: 'Luma-Chroma Coexistence', hint: 'Couples L contrast/activity to chroma persistence and chroma->L feedback (0 = off)',     shader: 'transition' },
    { key: 'kernelGrowthGain',       default: 0.25, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Kernel Growth Gain', hint: '↑ Stronger SmoothLife growth/survival drive on L',                                         shader: 'transition' },
    { key: 'kernelInhibitGain',      default: 0.20, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Lateral Inhibition', hint: '↑ More mid-range suppression (helps discrete local regions)',                              shader: 'transition' },
    { key: 'kernelInnerRatio',       default: 0.50, min: 0.20,  max: 0.90, step: 0.02,  group: 'Kernel Hybrid', label: 'Inner Radius Ratio', hint: '↑ Larger inner disk relative to outer radius',                                                 shader: 'transition' },
    { key: 'kernelTransitionWidth',  default: 0.08, min: 0.01,  max: 0.30, step: 0.01,  group: 'Kernel Hybrid', label: 'Transition Width',  hint: '↑ Softer SmoothLife windows. ↓ Sharper, more step-like switching',                        shader: 'transition' },
    { key: 'kernelBirthCenter',      default: 0.30, min: 0.0,   max: 1.0,  step: 0.01,  group: 'Kernel Hybrid', label: 'Birth Center',      hint: 'Center of outer-ring density window that tends to activate cells',                        shader: 'transition' },
    { key: 'kernelBirthWidth',       default: 0.18, min: 0.01,  max: 0.60, step: 0.01,  group: 'Kernel Hybrid', label: 'Birth Width',       hint: 'Width of birth window. Narrower gives more selective activation',                         shader: 'transition' },
    { key: 'kernelSurvivalCenter',   default: 0.46, min: 0.0,   max: 1.0,  step: 0.01,  group: 'Kernel Hybrid', label: 'Survival Center',   hint: 'Center of outer-ring density window that sustains active cells',                          shader: 'transition' },
    { key: 'kernelSurvivalWidth',    default: 0.22, min: 0.01,  max: 0.60, step: 0.01,  group: 'Kernel Hybrid', label: 'Survival Width',    hint: 'Width of survival window. Narrower favors sharper persistent structures',                 shader: 'transition' },
    { key: 'kernelSecondaryGain',    default: 0.00, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Secondary Scale Gain', hint: 'Adds a second structural kernel scale (left=off, right=stronger multiscale competition)', shader: 'transition' },
    { key: 'kernelSecondaryRadius',  default: 2.00, min: 1.0,   max: 4.0,  step: 0.1,   group: 'Kernel Hybrid', label: 'Secondary Radius',    hint: 'Radius multiplier for the second structural scale',                                      shader: 'transition' },
    { key: 'kernelSecondaryInner',   default: 0.60, min: 0.20,  max: 0.90, step: 0.02,  group: 'Kernel Hybrid', label: 'Secondary Inner Ratio', hint: 'Inner/outer split for the second scale kernel',                                          shader: 'transition' },
    { key: 'kernelColorToLGain',     default: 0.20, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Color -> L Coupling', hint: '↑ Chroma mismatch pushes L structure more (color drives shape)',                            shader: 'transition' },
    { key: 'kernelLToColorGain',     default: 0.35, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'L -> Color Coupling', hint: '↑ Kernel activity drives color advection more (shape drives color motion)',                shader: 'transition' },
    { key: 'colorWaveDamping',       default: 0.00, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Color Wave Damping', hint: '↑ Suppresses broad non-local color waves; favors local transport',                           shader: 'transition' },
    { key: 'colorPocketGain',        default: 0.30, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Color Pocket Gain',  hint: '↑ Reinforces local chroma neighborhoods against global color averaging',                    shader: 'transition' },
    { key: 'fieldMomentCoupling',    default: 0.18, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Field Moment Coupling', hint: 'Couples L and chroma via local variance moments (implicit only)',                        shader: 'transition' },
    { key: 'crossMomentCoupling',    default: 0.14, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Cross Moment Coupling', hint: 'Couples updates via local L/chroma covariance around each cell',                         shader: 'transition' },
    { key: 'scaleMomentCoupling',    default: 0.12, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Kernel Hybrid', label: 'Scale Moment Coupling', hint: 'Couples updates through local vs neighborhood scale separation',                           shader: 'transition' },

    // ================================================================
    //  CHROMA TRANSPORT (still active in kernel-only mode)
    // ================================================================
    
    { key: 'coreColorRate',          default: 1.00, min: 0.0,   max: 10.0, step: 0.1,   group: 'Chroma Transport', label: 'Color Update Rate',  hint: 'Overall speed of chroma dynamics',                                                             shader: 'transition' },
    { key: 'coreAdoptGain',          default: 0.85, min: 0.0,   max: 4.0,  step: 0.1,   group: 'Chroma Transport', label: 'Color Adoption',     hint: 'Neighbor-driven chroma transport strength',                                                  shader: 'transition' },
    { key: 'coreGrowthHueCoupling',  default: 0.25, min: 0.0,   max: 2.0,  step: 0.1,   group: 'Chroma Transport', label: 'Momentum Hue Coupling', hint: 'How strongly L momentum rotates/transports chroma',                                          shader: 'transition' },
    { key: 'coreMaxDeltaAB',         default: 0.10, min: 0.01,  max: 0.30, step: 0.01,  group: 'Chroma Transport', label: 'Max Color Change/Step', hint: 'Rate limiter for chroma updates',                                                             shader: 'transition' },
    { key: 'noiseGain',              default: 0.01, min: 0.0,   max: 0.10, step: 0.005, group: 'Chroma Transport', label: 'Noise',              hint: 'Small stochastic forcing used by both L/chroma updates',                                    shader: 'transition' },
    { key: 'memoryDecay',            default: 0.05, min: 0.01,  max: 0.20, step: 0.01,  group: 'Chroma Transport', label: 'Memory Decay',       hint: 'Controls lag in the momentum memory channel M',                                              shader: 'transition' },

    // ================================================================
    //  GEOMETRIC CHROMA FLOW (legacy interactions worth preserving)
    // ================================================================
    
    { key: 'angleL',                 default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   group: 'Flow Geometry', label: 'L -> Angle',          hint: 'L contribution magnitude to chroma transport direction',                                     shader: 'transition' },
    { key: 'angleM',                 default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   group: 'Flow Geometry', label: 'Momentum -> Angle',   hint: 'Memory/momentum contribution magnitude to chroma transport direction',                      shader: 'transition' },
    { key: 'angleS',                 default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   group: 'Flow Geometry', label: 'Saturation -> Angle', hint: 'Saturation contribution magnitude to chroma transport direction',                           shader: 'transition' },
    { key: 'angleV',                 default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   group: 'Flow Geometry', label: 'Variance -> Angle',   hint: 'Variance contribution to chroma transport direction',                                       shader: 'transition' },
    { key: 'angleQuantization',      default: 1.0,  min: 1.0,   max: 16.0, step: 1.0,   group: 'Flow Geometry', label: 'Angle Quantization',  hint: 'Discrete direction bins for chroma flow',                                                   shader: 'transition' },
    { key: 'positionAngleBias',      default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   group: 'Flow Geometry', label: 'Position Bias',       hint: 'Spatial heterogeneity in local flow directions',                                            shader: 'transition' },
    { key: 'spatialFrequency',       default: 5.0,  min: 1.0,   max: 20.0, step: 1.0,   group: 'Flow Geometry', label: 'Spatial Frequency',   hint: 'Scale of position-dependent angular variation',                                             shader: 'transition' },
    { key: 'momentumThreshold',      default: 0.8,  min: 0.5,   max: 2.0,  step: 0.1,   group: 'Flow Geometry', label: 'Momentum Lock',       hint: 'Threshold for momentum-driven directional locking',                                         shader: 'transition' },
    { key: 'varianceThreshold',      default: 0.6,  min: 0.3,   max: 1.5,  step: 0.1,   group: 'Flow Geometry', label: 'Variance Lock',       hint: 'Threshold for variance-driven directional locking',                                         shader: 'transition' },
    { key: 'memoryFreqScale',        default: 10.0, min: 1.0,   max: 50.0, step: 1.0,   group: 'Flow Geometry', label: 'Memory Frequency',    hint: 'Spatial variation in memory decay frequency',                                               shader: 'transition' },
    { key: 'diversityKick',          default: 0.00, min: 0.0,   max: 2.0,  step: 0.1,   group: 'Flow Geometry', label: 'Diversity Kick',      hint: 'Amplifies intrinsic chroma anti-collapse and adds extra bursts in uniform regions',       shader: 'transition' },
    { key: 'antiConsensusGain',      default: 0.18, min: 0.0,   max: 1.5,  step: 0.05,  group: 'Flow Geometry', label: 'Anti-Consensus',      hint: 'Breakup force in flat chroma curvature regions',                                            shader: 'transition' },
    { key: 'vorticityGain',          default: 0.00, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Flow Geometry', label: 'Vorticity',           hint: 'Couples local L curl into chroma rotational flow',                                          shader: 'transition' },

    // ================================================================
    //  SOURCE GUIDANCE (STRUCTURAL BIAS, NO OVERLAY)
    // ================================================================
    
    { key: 'sourceGuidanceGain',     default: 0.25, min: 0.0,   max: 2.0,  step: 0.05,  group: 'Source Guidance', label: 'Guidance Gain',      hint: '↑ Stronger source-geometry influence on local rule coefficients',                        shader: 'transition' },
    { key: 'sourceAnisotropy',       default: 0.80, min: 0.0,   max: 4.0,  step: 0.1,   group: 'Source Guidance', label: 'Kernel Anisotropy',  hint: '↑ Kernel elongates more along source orientation where coherence is high',               shader: 'transition' },
    { key: 'sourceCoherenceFloor',   default: 0.20, min: 0.0,   max: 1.0,  step: 0.02,  group: 'Source Guidance', label: 'Coherence Floor',   hint: 'Minimum coherence required before orientation bias activates strongly',                   shader: 'transition' },
    { key: 'sourceRidgeBias',        default: 0.20, min: 0.0,   max: 1.0,  step: 0.05,  group: 'Source Guidance', label: 'Ridge Growth Bias', hint: 'Ridge-driven growth/inhibition modulation strength',                                      shader: 'transition' },
    { key: 'sourceEdgeFrequency',    default: 0.20, min: 0.0,   max: 1.0,  step: 0.02,  group: 'Source Guidance', label: 'Edge Frequency',    hint: '↑ Use finer details in source edges. ↓ Use broader/coarser structure',                  shader: 'existing' },
    { key: 'showGuidanceEdges',      default: false,                                   group: 'Source Guidance', label: 'Show Guidance Edges', hint: 'Overlay the source guidance edges used by the kernel',                                    shader: 'display', control: 'checkbox' },

    // ================================================================
    //  SYSTEM PARAMETERS
    // ================================================================
    
    { key: 'deltaTime',              default: 0.50, min: 0.01,  max: 5.0,  step: 0.05,  group: 'System', label: 'Simulation Speed',        hint: '↑ Faster evolution, larger timesteps. ↓ Slower, smaller steps, more stable',           shader: 'transition' },
    { key: 'radius',                 default: 0.03, min: 0.005, max: 0.10, step: 0.002, group: 'System', label: 'Convolution Radius',      hint: '↑ Larger neighborhood sampling, bigger features. ↓ Smaller neighborhoods, finer detail', shader: 'convolution' },

];
