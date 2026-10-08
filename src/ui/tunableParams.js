/**
 * Tunable parameter definitions — the single source of truth for every
 * parameter in the Core V1 CA simulation.
 *
 * Each entry defines:
 *   key      – JS param name and GLSL uniform (u_<key>). Keys are stable so saved configs keep loading.
 *   default  – default value
 *   min/max/step – slider range
 *   drawer   – which UI drawer it lives in (see DRAWERS)
 *   advanced – tucked under the drawer's "fine print" fold
 *   label    – artist-facing name
 *   hint     – one plain sentence about what you'll see
 *   lo / hi  – what the left and right ends of the slider look like
 *   shader   – which shader uses it: 'transition' | 'convolution' | 'display' | 'existing'
 */

export const DRAWERS = [
    { id: 'palette', glyph: '▚', title: 'Palette',          blurb: 'Pick the colors. The simulation only ever paints with these.' },
    { id: 'shape',   glyph: '▞', title: 'Life + Growth',    blurb: 'The Game of Life rules: how blobs are born, survive and die.' },
    { id: 'color',   glyph: '▙', title: 'Color Behavior',   blurb: 'How color spreads, clumps and travels between cells.' },
    { id: 'swirl',   glyph: '▟', title: 'Swirl + Flow',     blurb: 'Twist color into currents, whirlpools and crystal facets.' },
    { id: 'rhythm',  glyph: '▛', title: 'Rhythm + Fatigue', blurb: 'Make cells tire out after firing, which turns blobs into travelling waves.' },
    { id: 'image',   glyph: '▜', title: 'Image Influence',  blurb: 'How much the outlines of your image steer the growth.' },
    { id: 'lab',     glyph: '░', title: 'Deep Lab',          blurb: 'Subtle, weird couplings. Push them to extremes to hear what they do.' },
];

export const PALETTE_PRESETS = [
    { name: 'Riso',      colors: ['#ff48b0', '#0078bf', '#ffe800', '#00a95c'],             background: '#f2ead8' },
    { name: 'Acid',      colors: ['#00ff9f', '#ff00c8', '#00b8ff', '#fffb00'],             background: '#07000f' },
    { name: 'Bruise',    colors: ['#2b0f54', '#ab1f65', '#ff4f69', '#ffd2a8'],             background: '#0b0614' },
    { name: 'Ember',     colors: ['#1a0000', '#8f1d00', '#ff6a00', '#ffd23f'],             background: '#050000' },
    { name: 'Deep Sea',  colors: ['#001d3d', '#00708a', '#5ef2c9', '#e0fbfc'],             background: '#000814' },
    { name: 'Vapor',     colors: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'],  background: '#1a0933' },
    { name: 'Moss',      colors: ['#283618', '#606c38', '#dda15e', '#fefae0'],             background: '#11140b' },
    { name: 'Terminal',  colors: ['#00ff41', '#008f11'],                                    background: '#000000' },
    { name: 'Ink',       colors: ['#111111', '#e63946'],                                    background: '#f1faee' },
];

export const DEFAULT_PALETTE = PALETTE_PRESETS[0];
export const MAX_PALETTE_COLORS = 8;

export const TUNABLE_PARAMS = [

    // ================================================================
    //  PALETTE (display only — never changes the simulation itself)
    // ================================================================

    { key: 'paletteOn',              default: true,                                    drawer: 'palette', label: 'Use My Palette',     hint: 'Off brings back the original full-rainbow look.',                               shader: 'display', control: 'checkbox' },
    { key: 'paletteFill',            default: 0.55, min: 0.0,   max: 1.0,  step: 0.01,  drawer: 'palette', label: 'Color Fill',         hint: 'How much of the canvas is palette color vs. background.', lo: 'mostly background', hi: 'solid color',        shader: 'display' },
    { key: 'paletteBands',           default: 0.25, min: 0.0,   max: 1.0,  step: 0.01,  drawer: 'palette', label: 'Color Edges',        hint: 'How neighbouring palette colors meet.',                     lo: 'smooth blends',     hi: 'hard poster bands',  shader: 'display' },
    { key: 'paletteShading',         default: 0.70, min: 0.0,   max: 1.0,  step: 0.01,  drawer: 'palette', label: 'Light & Shadow',     hint: 'How much brightness in the simulation shades the colors.', lo: 'flat graphic',      hi: 'deep shadow + glow', shader: 'display' },
    { key: 'paletteShift',           default: 0.00, min: 0.0,   max: 1.0,  step: 0.01,  drawer: 'palette', label: 'Palette Spin',       hint: 'Reshuffles which palette color lands on which region.',     lo: 'as picked',         hi: 'full turn',          shader: 'display' },
    { key: 'paletteCycle',           default: 0.00, min: -1.0,  max: 1.0,  step: 0.01,  drawer: 'palette', label: 'Palette Drift',      hint: 'Keeps the colors slowly rotating on their own. Center = still.', lo: '◀ backwards',    hi: 'forwards ▶',         shader: 'display' },
    { key: 'structureIdentityMix',   default: 0.00, min: 0.0,   max: 1.0,  step: 0.05,  drawer: 'palette', advanced: true, label: 'Edge Glow',  hint: 'Brightens busy, textured areas and dims flat ones.',        lo: 'off',               hi: 'busy areas glow',    shader: 'display' },
    { key: 'structureIdentityColor', default: 0.00, min: 0.0,   max: 1.0,  step: 0.05,  drawer: 'palette', advanced: true, label: 'Edge Color Boost', hint: 'With Edge Glow on, busy areas also get more vivid.', lo: 'off',             hi: 'vivid edges',        shader: 'display' },

    // ================================================================
    //  LIFE & GROWTH (SmoothLife kernel on brightness)
    // ================================================================

    { key: 'radius',                 default: 0.03, min: 0.005, max: 0.10, step: 0.002, drawer: 'shape', label: 'Pattern Scale',      hint: 'How far each cell looks to find its neighbours. The single biggest knob.', lo: 'fine grain',  hi: 'giant blobs',     shader: 'convolution' },
    { key: 'kernelGrowthGain',       default: 0.25, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'shape', label: 'Life Force',         hint: 'How decisively cells switch on and off.',                    lo: 'sleepy, faint',      hi: 'punchy, decisive',   shader: 'transition' },
    { key: 'kernelBirthCenter',      default: 0.30, min: 0.0,   max: 1.0,  step: 0.01,  drawer: 'shape', label: 'Birth Crowd',        hint: 'How many lit neighbours a dark spot needs before it lights up.', lo: 'spreads like fire', hi: 'needs a crowd',   shader: 'transition' },
    { key: 'kernelBirthWidth',       default: 0.18, min: 0.01,  max: 0.60, step: 0.01,  drawer: 'shape', label: 'Birth Tolerance',    hint: 'How picky birth is about that crowd size.',                  lo: 'picky',              hi: 'anything goes',      shader: 'transition' },
    { key: 'kernelSurvivalCenter',   default: 0.46, min: 0.0,   max: 1.0,  step: 0.01,  drawer: 'shape', label: 'Survival Crowd',     hint: 'How many lit neighbours a lit cell needs to stay alive.',    lo: 'loners survive',     hi: 'needs company',      shader: 'transition' },
    { key: 'kernelSurvivalWidth',    default: 0.22, min: 0.01,  max: 0.60, step: 0.01,  drawer: 'shape', label: 'Survival Tolerance', hint: 'How forgiving survival is. Narrow = sharper, more fragile shapes.', lo: 'fragile',      hi: 'hardy',              shader: 'transition' },
    { key: 'kernelInhibitGain',      default: 0.20, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'shape', label: 'Elbow Room',         hint: 'Shapes push each other apart, leaving dark gaps. Makes spots and stripes.', lo: 'shapes merge', hi: 'shapes keep apart', shader: 'transition' },
    { key: 'kernelTransitionWidth',  default: 0.08, min: 0.01,  max: 0.30, step: 0.01,  drawer: 'shape', label: 'Rule Softness',      hint: 'How abrupt the on/off decision is.',                          lo: 'crisp, glitchy',     hi: 'soft, mushy',        shader: 'transition' },
    { key: 'kernelInnerRatio',       default: 0.50, min: 0.20,  max: 0.90, step: 0.02,  drawer: 'shape', advanced: true, label: 'Body vs. Halo', hint: 'Each cell has a body and a ring it senses around it. This sets the split.', lo: 'small body, wide ring', hi: 'big body, thin ring', shader: 'transition' },
    { key: 'kernelSecondaryGain',    default: 0.00, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'shape', advanced: true, label: 'Echo Pattern',  hint: 'Adds a second, larger pattern layered over the first.',     lo: 'off',                hi: 'strong echo',        shader: 'transition' },
    { key: 'kernelSecondaryRadius',  default: 2.00, min: 1.0,   max: 4.0,  step: 0.1,   drawer: 'shape', advanced: true, label: 'Echo Size',     hint: 'How much bigger the echo pattern is (needs Echo Pattern up).', lo: 'close to main',   hi: '4× bigger',          shader: 'transition' },
    { key: 'kernelSecondaryInner',   default: 0.60, min: 0.20,  max: 0.90, step: 0.02,  drawer: 'shape', advanced: true, label: 'Echo Body vs. Halo', hint: 'Body/ring split for the echo pattern.',                 lo: 'small body',         hi: 'big body',           shader: 'transition' },

    // ================================================================
    //  COLOR BEHAVIOR (chroma transport)
    // ================================================================

    { key: 'coreColorRate',          default: 1.00, min: 0.0,   max: 10.0, step: 0.1,   drawer: 'color', label: 'Color Speed',        hint: 'How fast color moves around at all. 0 freezes color in place.', lo: 'frozen',          hi: 'restless',           shader: 'transition' },
    { key: 'coreAdoptGain',          default: 0.85, min: 0.0,   max: 4.0,  step: 0.1,   drawer: 'color', label: 'Color Contagion',    hint: 'How readily cells catch their neighbours\' color.',          lo: 'stubborn',           hi: 'infectious',         shader: 'transition' },
    { key: 'colorPocketGain',        default: 0.30, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'color', label: 'Color Clumping',     hint: 'Small patches of one color hold together instead of blending away.', lo: 'blends out',  hi: 'tight clumps',       shader: 'transition' },
    { key: 'colorWaveDamping',       default: 0.00, min: 0.0,   max: 1.0,  step: 0.05,  drawer: 'color', label: 'Calm the Washes',    hint: 'Stops huge waves of one color sweeping the whole canvas.',   lo: 'big sweeping washes', hi: 'local patches',     shader: 'transition' },
    { key: 'satRegimeGain',          default: 0.10, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'color', label: 'Vivid / Faded Zones', hint: 'Sorts the canvas into strongly colored and washed-out territories.', lo: 'even',        hi: 'distinct zones',     shader: 'transition' },
    { key: 'satRegimeSpread',        default: 0.08, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'color', label: 'Zone Variety',       hint: 'Lets in-between intensities coexist with the vivid and faded zones.', lo: 'two extremes', hi: 'full range',        shader: 'transition' },
    { key: 'noiseGain',              default: 0.01, min: 0.0,   max: 0.10, step: 0.005, drawer: 'color', label: 'Static',             hint: 'Random grain that keeps things from ever fully settling.',  lo: 'clean',              hi: 'fizzy',              shader: 'transition' },
    { key: 'coreMaxDeltaAB',         default: 0.10, min: 0.01,  max: 0.30, step: 0.01,  drawer: 'color', advanced: true, label: 'Color Jump Limit', hint: 'Caps how much a cell\'s color can change in one step.', lo: 'gradual',            hi: 'sudden jumps',       shader: 'transition' },
    { key: 'lumaChromaCoexistGain',  default: 0.20, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'color', advanced: true, label: 'Color Survives Contrast', hint: 'Keeps color alive where light and dark meet, instead of it draining to gray.', lo: 'drains', hi: 'holds',       shader: 'transition' },

    // ================================================================
    //  SWIRL & FLOW (direction of chroma transport)
    // ================================================================

    { key: 'coreGrowthHueCoupling',  default: 0.25, min: 0.0,   max: 2.0,  step: 0.1,   drawer: 'swirl', label: 'Pulse Pushes Color', hint: 'When a spot brightens or dims, it shoves color sideways.',   lo: 'still',              hi: 'churning',           shader: 'transition' },
    { key: 'kernelLToColorGain',     default: 0.35, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'swirl', label: 'Life Stirs Color',   hint: 'Busy Game-of-Life activity amplifies that shove.',           lo: 'independent',        hi: 'tightly linked',     shader: 'transition' },
    { key: 'vorticityGain',          default: 0.00, min: 0.0,   max: 1.0,  step: 0.05,  drawer: 'swirl', label: 'Whirlpools',         hint: 'Curling bright shapes spin the color around them.',          lo: 'off',                hi: 'whirlpools',         shader: 'transition' },
    { key: 'antiConsensusGain',      default: 0.18, min: 0.0,   max: 1.5,  step: 0.05,  drawer: 'swirl', label: 'Break Up Flat Color', hint: 'Large single-color areas crack into new structure.',        lo: 'let them sit',       hi: 'shatter them',       shader: 'transition' },
    { key: 'diversityKick',          default: 0.00, min: 0.0,   max: 2.0,  step: 0.1,   drawer: 'swirl', label: 'Color Shake-Up',     hint: 'Throws fresh color into areas that have gone uniform.',      lo: 'off',                hi: 'constant surprises', shader: 'transition' },
    { key: 'angleQuantization',      default: 1.0,  min: 1.0,   max: 16.0, step: 1.0,   drawer: 'swirl', label: 'Facets',             hint: 'Snaps color flow to a few fixed directions, for crystalline shards.', lo: 'free-flowing', hi: '16 directions',     shader: 'transition' },
    { key: 'angleL',                 default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   drawer: 'swirl', advanced: true, label: 'Twist by Brightness', hint: 'Bright and dark areas bend color flow in opposite directions.', lo: 'none', hi: 'strong',            shader: 'transition' },
    { key: 'angleM',                 default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   drawer: 'swirl', advanced: true, label: 'Twist by Change',     hint: 'Areas that are brightening vs. fading bend flow apart.',  lo: 'none',               hi: 'strong',             shader: 'transition' },
    { key: 'angleS',                 default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   drawer: 'swirl', advanced: true, label: 'Twist by Vividness',  hint: 'Vivid and faded areas bend flow apart.',                  lo: 'none',               hi: 'strong',             shader: 'transition' },
    { key: 'angleV',                 default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   drawer: 'swirl', advanced: true, label: 'Twist by Texture',    hint: 'Busy, textured areas bend flow.',                         lo: 'none',               hi: 'strong',             shader: 'transition' },
    { key: 'positionAngleBias',      default: 0.0,  min: 0.0,   max: 2.0,  step: 0.1,   drawer: 'swirl', advanced: true, label: 'Scatter',             hint: 'Every spot on the canvas gets its own random twist.',     lo: 'uniform',            hi: 'scattered',          shader: 'transition' },
    { key: 'spatialFrequency',       default: 5.0,  min: 1.0,   max: 20.0, step: 1.0,   drawer: 'swirl', advanced: true, label: 'Scatter Seed',        hint: 'Rerolls the Scatter pattern (needs Scatter up).',         lo: 'seed 1',             hi: 'seed 20',            shader: 'transition' },
    { key: 'momentumThreshold',      default: 0.8,  min: 0.5,   max: 2.0,  step: 0.1,   drawer: 'swirl', advanced: true, label: 'Change Lock',         hint: 'With Twist by Change up: fast-changing areas lock flow sideways.', lo: 'locks often', hi: 'rarely locks',     shader: 'transition' },
    { key: 'varianceThreshold',      default: 0.6,  min: 0.3,   max: 1.5,  step: 0.1,   drawer: 'swirl', advanced: true, label: 'Texture Lock',        hint: 'With Twist by Texture up: busy areas lock flow to one direction.', lo: 'locks often', hi: 'rarely locks',     shader: 'transition' },

    // ================================================================
    //  RHYTHM & FATIGUE (refractory / excitable media)
    // ================================================================

    { key: 'refractoryGain',         default: 0.00, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'rhythm', label: 'Fatigue',           hint: 'After firing, cells need rest before lighting up again. Turns blobs into waves.', lo: 'off', hi: 'exhausted',      shader: 'transition' },
    { key: 'refractoryThreshold',    default: 0.12, min: 0.0,   max: 0.50, step: 0.01,  drawer: 'rhythm', label: 'Tires After',       hint: 'How much activity it takes before a cell gets tired.',      lo: 'tires instantly',    hi: 'lots of stamina',    shader: 'transition' },
    { key: 'refractoryWidth',        default: 0.10, min: 0.01,  max: 0.50, step: 0.01,  drawer: 'rhythm', label: 'Fatigue Onset',     hint: 'Whether tiredness kicks in suddenly or gradually.',          lo: 'sudden',             hi: 'gradual',            shader: 'transition' },
    { key: 'excitabilityGain',       default: 0.00, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'rhythm', label: 'Wake-Up Spread',    hint: 'Rested, quiet cells catch the brightness of their neighbours.', lo: 'off',            hi: 'catches easily',     shader: 'transition' },
    { key: 'refractoryColorDamp',    default: 0.00, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'rhythm', label: 'Tired Cells Hold Color', hint: 'Tired cells stop changing color, leaving color trails behind waves.', lo: 'off',      hi: 'trails',             shader: 'transition' },
    { key: 'memoryDecay',            default: 0.05, min: 0.01,  max: 0.20, step: 0.01,  drawer: 'rhythm', label: 'Memory',            hint: 'How quickly cells forget what they just did. Feeds fatigue and the color shove.', lo: 'long memory', hi: 'forgets fast', shader: 'transition' },

    // ================================================================
    //  IMAGE INFLUENCE (source guidance)
    // ================================================================

    { key: 'sourceGuidanceGain',     default: 0.25, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'image', label: 'Image Pull',        hint: 'How much the outlines in your image steer the growth.',      lo: 'ignore image',       hi: 'follow the image',   shader: 'transition' },
    { key: 'sourceEdgeFrequency',    default: 0.20, min: 0.0,   max: 1.0,  step: 0.02,  drawer: 'image', label: 'Outline Detail',    hint: 'Which outlines count: just the big shapes, or every little detail.', lo: 'big shapes only', hi: 'every detail',    shader: 'existing' },
    { key: 'sourceAnisotropy',       default: 0.80, min: 0.0,   max: 4.0,  step: 0.1,   drawer: 'image', label: 'Stretch Along Lines', hint: 'Growth stretches out along the image\'s lines, like brush strokes.', lo: 'round',       hi: 'long strokes',       shader: 'transition' },
    { key: 'sourceRidgeBias',        default: 0.20, min: 0.0,   max: 1.0,  step: 0.05,  drawer: 'image', label: 'Grow on Outlines',  hint: 'Life thrives on the outlines and struggles between them.',   lo: 'no preference',      hi: 'clings to lines',    shader: 'transition' },
    { key: 'sourceCoherenceFloor',   default: 0.20, min: 0.0,   max: 1.0,  step: 0.02,  drawer: 'image', advanced: true, label: 'Line Confidence', hint: 'How clean a line must be before it steers anything.', lo: 'any scribble',       hi: 'only clean lines',   shader: 'transition' },
    { key: 'showGuidanceEdges',      default: false,                                   drawer: 'image', label: 'Show Outlines',     hint: 'Overlay the outlines the simulation is following.',          shader: 'display', control: 'checkbox' },

    // ================================================================
    //  DEEP LAB (implicit couplings, rate limits)
    // ================================================================

    { key: 'kernelColorToLGain',     default: 0.20, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'lab', label: 'Color Clash Shapes Light', hint: 'Where colors clash, brightness gets pushed around too.', lo: 'independent',        hi: 'color drives shape', shader: 'transition' },
    { key: 'fieldMomentCoupling',    default: 0.18, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'lab', label: 'Texture Tension',   hint: 'Textured areas couple light and color more tightly.',        lo: 'off',                hi: 'tense',              shader: 'transition' },
    { key: 'crossMomentCoupling',    default: 0.14, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'lab', label: 'Light–Color Sympathy', hint: 'Brighter-than-neighbours and more-vivid-than-neighbours reinforce each other.', lo: 'off', hi: 'in sync',       shader: 'transition' },
    { key: 'scaleMomentCoupling',    default: 0.12, min: 0.0,   max: 2.0,  step: 0.05,  drawer: 'lab', label: 'Near vs. Far',      hint: 'Reacts to the difference between immediate neighbours and the wider area.', lo: 'off', hi: 'strong',          shader: 'transition' },
    { key: 'coreLRate',              default: 1.00, min: 0.0,   max: 10.0, step: 0.1,   drawer: 'lab', label: 'Brightness Speed',  hint: 'How fast the light/dark pattern evolves, separate from color.', lo: 'frozen',           hi: 'frantic',            shader: 'transition' },
    { key: 'coreMaxDeltaL',          default: 0.08, min: 0.01,  max: 0.30, step: 0.01,  drawer: 'lab', label: 'Brightness Jump Limit', hint: 'Caps how much brightness can change in one step.',       lo: 'gradual',            hi: 'flicker-prone',      shader: 'transition' },
    { key: 'memoryFreqScale',        default: 10.0, min: 1.0,   max: 50.0, step: 1.0,   drawer: 'lab', label: 'Memory Patchiness Seed', hint: 'Rerolls where cells have longer vs. shorter memories.', lo: 'seed 1',            hi: 'seed 50',            shader: 'transition' },

    // ================================================================
    //  TRANSPORT (shown in the top bar, not a drawer)
    // ================================================================

    { key: 'deltaTime',              default: 0.50, min: 0.0,   max: 1.0,  step: 0.01,  drawer: 'transport', label: 'Speed',         hint: 'Simulation speed. Far left watches single steps.',          lo: 'crawl',              hi: 'warp',               shader: 'transition' },
];
