// Simple vertex shader for all passes
export const vertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

// Simple display shader - just show the texture
export const displayShader = `
precision highp float;

uniform sampler2D u_texture;
varying vec2 v_texCoord;

void main() {
    gl_FragColor = texture2D(u_texture, v_texCoord);
}
`;

// Edge detection shader (Sobel operator)
export const edgeDetectionShader = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_edgeSensitivity;

varying vec2 v_texCoord;

// Calculate luminance
float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

void main() {
    vec2 pixelSize = 1.0 / u_resolution;
    
    // Sobel kernels
    float gx = 0.0;
    float gy = 0.0;
    
    // Sample 3x3 neighborhood
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 offset = vec2(float(x), float(y)) * pixelSize;
            float lum = getLuminance(texture2D(u_texture, v_texCoord + offset));
            
            // Sobel X
            if (x == -1) gx -= lum * (y == 0 ? 2.0 : 1.0);
            if (x == 1) gx += lum * (y == 0 ? 2.0 : 1.0);
            
            // Sobel Y
            if (y == -1) gy -= lum * (x == 0 ? 2.0 : 1.0);
            if (y == 1) gy += lum * (x == 0 ? 2.0 : 1.0);
        }
    }
    
    // Edge magnitude
    float edgeStrength = sqrt(gx * gx + gy * gy);
    
    // FIXED: Higher sensitivity = detect more edges (lower threshold)
    // Invert: sensitivity 0 = threshold 1.0 (only strong edges), sensitivity 1 = threshold 0.0 (all edges)
    float threshold = 1.0 - u_edgeSensitivity;
    edgeStrength = smoothstep(threshold - 0.1, threshold + 0.1, edgeStrength);
    
    // Edge direction (for later use)
    float edgeAngle = atan(gy, gx);
    
    // Store: R = edge strength, G = cos(angle), B = sin(angle), A = original luminance
    vec4 original = texture2D(u_texture, v_texCoord);
    gl_FragColor = vec4(
        edgeStrength,
        cos(edgeAngle) * 0.5 + 0.5,
        sin(edgeAngle) * 0.5 + 0.5,
        getLuminance(original)
    );
}
`;

// Patch statistics shader (compute local color statistics)
export const patchStatsShader = `
precision highp float;

uniform sampler2D u_originalImage;
uniform sampler2D u_edgeTexture;
uniform vec2 u_resolution;
uniform float u_patchRadius;

varying vec2 v_texCoord;

void main() {
    vec2 pixelSize = 1.0 / u_resolution;
    
    // Sample within local patch (avoiding edges)
    vec4 colorSum = vec4(0.0);
    vec4 colorSqSum = vec4(0.0);
    float count = 0.0;
    
    int radius = int(u_patchRadius);
    
    for (int x = -10; x <= 10; x++) {
        for (int y = -10; y <= 10; y++) {
            int absX = x < 0 ? -x : x;
            int absY = y < 0 ? -y : y;
            if (absX > radius || absY > radius) continue;
            
            vec2 offset = vec2(float(x), float(y)) * pixelSize;
            vec2 samplePos = v_texCoord + offset;
            
            // Check if we're crossing an edge
            float edgeStrength = texture2D(u_edgeTexture, samplePos).r;
            
            // Weight by distance from edge (sample more from non-edge areas)
            float weight = 1.0 - edgeStrength;
            
            if (weight > 0.1) {
                vec4 color = texture2D(u_originalImage, samplePos);
                colorSum += color * weight;
                colorSqSum += color * color * weight;
                count += weight;
            }
        }
    }
    
    if (count > 0.0) {
        // Store: RGB = dominant color, A = variance
        vec4 avgColor = colorSum / count;
        vec4 variance = colorSqSum / count - avgColor * avgColor;
        float totalVariance = (variance.r + variance.g + variance.b) / 3.0;
        
        gl_FragColor = vec4(avgColor.rgb, totalVariance);
    } else {
        // Fallback to original
        gl_FragColor = texture2D(u_originalImage, v_texCoord);
    }
}
`;

// Convolution shader (Game of Life neighborhoods)
export const convolutionShader = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_innerRadius;
uniform float u_outerRadius;

varying vec2 v_texCoord;

const float PI = 3.14159265359;

// Calculate luminance from RGB
float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

// Smooth kernel function for antialiasing
float smoothKernel(float r, float radius) {
    float smoothness = 1.0;
    return smoothstep(radius + smoothness, radius - smoothness, r);
}

void main() {
    vec2 pixelSize = 1.0 / u_resolution;
    vec4 centerColor = texture2D(u_texture, v_texCoord);
    
    // Accumulators for inner and outer rings
    vec4 innerSum = vec4(0.0);
    float innerCount = 0.0;
    float innerLumSum = 0.0;
    
    vec4 outerSum = vec4(0.0);
    float outerCount = 0.0;
    float outerLumSum = 0.0;
    
    // Sample in a circular pattern
    // Note: WebGL requires constant loop bounds
    // MAX_STEPS of 30 is reasonable for performance while allowing good pattern reach
    const int MAX_STEPS = 30;
    float maxRadius = u_outerRadius;
    int steps = int(ceil(maxRadius)) + 1;
    float fSteps = float(steps);
    
    for (int x = -MAX_STEPS; x <= MAX_STEPS; x++) {
        for (int y = -MAX_STEPS; y <= MAX_STEPS; y++) {
            // Skip if outside our actual radius
            float fx = float(x);
            float fy = float(y);
            float absFx = fx < 0.0 ? -fx : fx;
            float absFy = fy < 0.0 ? -fy : fy;
            if (absFx > fSteps || absFy > fSteps) continue;
            if (x == 0 && y == 0) continue;
            
            float dist = length(vec2(fx, fy));
            
            if (dist > maxRadius) continue;
            
            vec2 samplePos = v_texCoord + vec2(fx, fy) * pixelSize;
            vec4 sampleColor = texture2D(u_texture, samplePos);
            float sampleLum = getLuminance(sampleColor);
            
            // Inner disk
            if (dist <= u_innerRadius) {
                float weight = smoothKernel(dist, u_innerRadius);
                innerSum += sampleColor * weight;
                innerLumSum += sampleLum * weight;
                innerCount += weight;
            }
            // Outer ring
            else if (dist <= u_outerRadius) {
                float weight = smoothKernel(dist - u_innerRadius, u_outerRadius - u_innerRadius);
                outerSum += sampleColor * weight;
                outerLumSum += sampleLum * weight;
                outerCount += weight;
            }
        }
    }
    
    // Normalize
    vec4 innerAvg = innerCount > 0.0 ? innerSum / innerCount : centerColor;
    float innerLumAvg = innerCount > 0.0 ? innerLumSum / innerCount : getLuminance(centerColor);
    
    vec4 outerAvg = outerCount > 0.0 ? outerSum / outerCount : centerColor;
    float outerLumAvg = outerCount > 0.0 ? outerLumSum / outerCount : getLuminance(centerColor);
    
    // Pack data: 
    // R = inner luminance, G = outer luminance
    // B = encoded inner RGB average (we'll store in next pass)
    // A = encoded outer RGB average
    gl_FragColor = vec4(innerLumAvg, outerLumAvg, innerAvg.r, innerAvg.g);
}
`;

// Fragment shader for transition (SIMPLIFIED - GoL + noise + image restore + edges)
export const transitionShader = `
precision highp float;

uniform sampler2D u_currentState;
uniform sampler2D u_convolution;
uniform sampler2D u_originalImage;
uniform sampler2D u_edgeTexture;
uniform vec2 u_resolution;
uniform float u_time;

// SIMPLIFIED parameters
uniform float u_chaos;           // 0-1: How unstable/wild the GoL gets
uniform float u_randomNoise;      // 0-1: Amount of random noise
uniform float u_imageRestore;     // 0-1: How much to pump original image back
uniform float u_edgeAnchor;       // 0-1: How strongly edges constrain
uniform float u_deltaTime;

varying vec2 v_texCoord;

const float PI = 3.14159265359;

// Calculate luminance
float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

// Sigmoid function
float sigmoid(float x, float a) {
    return 1.0 / (1.0 + exp(-4.0 / a * (x - 0.5)));
}

// Improved sigmoid interval with chaos parameter
float sigmoidInterval(float x, float a, float b, float alpha) {
    return sigmoid((x - a) / (b - a), alpha) * (1.0 - sigmoid((x - b) / (b - a), alpha));
}

// Hash function for pseudo-random per-pixel
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Convert chaos parameter to birth/death intervals
void getChaosIntervals(float chaos, out float birth1, out float birth2, out float death1, out float death2) {
    // Low chaos = narrow, specific intervals (stable, classic GoL)
    // High chaos = wider intervals (more activity, but not so wide everything dies)
    
    // Keep centers fixed where typical luminance values are
    float centerBirth = 0.35;
    float centerDeath = 0.30;
    
    // Moderate widening - not too extreme
    float birthWidth = 0.05 + chaos * 0.15;   // 0.05 -> 0.20
    float deathWidth = 0.05 + chaos * 0.18;   // 0.05 -> 0.23
    
    birth1 = centerBirth - birthWidth;
    birth2 = centerBirth + birthWidth;
    death1 = centerDeath - deathWidth;
    death2 = centerDeath + deathWidth;
}

// Transition function with chaos-based intervals
float transitionFunction(float n, float m, float chaos) {
    float birth1, birth2, death1, death2;
    getChaosIntervals(chaos, birth1, birth2, death1, death2);
    
    // Moderate sharpness increase with chaos - not too extreme
    float alpha = 0.2 - chaos * 0.1; // 0.2 -> 0.1 (moderate sharpening)
    alpha = max(alpha, 0.05); // Don't go too sharp
    
    float birthTerm = sigmoidInterval(n, birth1, birth2, alpha);
    float deathTerm = sigmoidInterval(n, death1, death2, alpha);
    
    return birthTerm * (1.0 - sigmoid(m, alpha)) + deathTerm * sigmoid(m, alpha);
}

void main() {
    vec4 current = texture2D(u_currentState, v_texCoord);
    vec4 conv = texture2D(u_convolution, v_texCoord);
    vec4 original = texture2D(u_originalImage, v_texCoord);
    vec4 edgeInfo = texture2D(u_edgeTexture, v_texCoord);
    
    float edgeStrength = edgeInfo.r;
    
    float currentLum = getLuminance(current);
    float innerLum = conv.r;  // m
    float outerLum = conv.g;  // n
    
    // GAME OF LIFE RULES
    float transition = transitionFunction(outerLum, innerLum, u_chaos);
    
    // Calculate GoL-driven luminance change - CAP IT to prevent flickering extremes
    float lumChange = u_deltaTime * (2.0 * transition - 1.0);
    lumChange = clamp(lumChange, -0.1, 0.1); // Tighter cap per frame
    float newLum = clamp(currentLum + lumChange, 0.1, 0.9); // KEEP AWAY FROM PURE BLACK/WHITE!
    
    // COLOR EVOLUTION: When restoration is low, blend with neighbors instead of preserving ratios
    vec4 newColor;
    
    if (u_imageRestore < 0.5) {
        // Sample neighbor colors and blend based on GoL transition
        vec2 pixelSize = 1.0 / u_resolution;
        vec4 neighborSum = vec4(0.0);
        float count = 0.0;
        
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                vec2 offset = vec2(float(x), float(y)) * pixelSize;
                neighborSum += texture2D(u_currentState, v_texCoord + offset);
                count += 1.0;
            }
        }
        
        vec4 neighborAvg = neighborSum / count;
        
        // Mix current with neighbors - MUCH MORE GENTLE
        // transition close to 0.5 = stable, far from 0.5 = more blending
        float blendToNeighbors = abs(transition - 0.5) * (1.0 - u_imageRestore * 2.0);
        blendToNeighbors = clamp(blendToNeighbors, 0.0, 0.3); // Max 30% blending!
        newColor = mix(current, neighborAvg, blendToNeighbors);
        
        // Scale to new luminance - but protect against extreme values
        float newColorLum = getLuminance(newColor);
        if (newColorLum > 0.01) {
            newColor *= (newLum / newColorLum);
        } else {
            // If color is too dark, just set to gray at target luminance
            newColor = vec4(newLum);
        }
    } else {
        // High restoration: just scale current color to new luminance
        newColor = currentLum > 0.001 ? 
            current * (newLum / currentLum) : 
            vec4(newLum);
    }
    
    // RANDOM NOISE - independent per channel, but not TOO extreme
    float noiseR = (hash(v_texCoord * 200.0 + u_time * 0.3) - 0.5) * u_randomNoise * 0.3;
    float noiseG = (hash(v_texCoord * 300.0 + u_time * 0.4) - 0.5) * u_randomNoise * 0.3;
    float noiseB = (hash(v_texCoord * 400.0 + u_time * 0.5) - 0.5) * u_randomNoise * 0.3;
    newColor.r += noiseR;
    newColor.g += noiseG;
    newColor.b += noiseB;
    
    // IMAGE RESTORATION - blend original image back in (ONLY if restoration > 0!)
    if (u_imageRestore > 0.001) {
        newColor = mix(newColor, original, u_imageRestore * u_deltaTime);
    }
    
    // EDGE ANCHORING - edges pull toward original (ONLY if anchor > 0!)
    if (u_edgeAnchor > 0.001) {
        float edgePull = u_edgeAnchor * edgeStrength;
        newColor = mix(newColor, original, edgePull);
    }
    
    // FINAL: Soft clamp - allow temporary excursions but gently bring back
    // This preserves dynamics while preventing runaway
    newColor = clamp(newColor, -0.2, 1.2);  // Allow 20% overflow
    newColor = clamp(newColor, 0.0, 1.0);   // Final hard clamp
}
`;

// Velocity update shader
export const velocityUpdateShader = `
precision highp float;

uniform sampler2D u_currentState;
uniform sampler2D u_previousState;
uniform sampler2D u_velocity;
uniform float u_flow;
uniform float u_deltaTime;

varying vec2 v_texCoord;

float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

void main() {
    vec4 current = texture2D(u_currentState, v_texCoord);
    vec4 previous = texture2D(u_previousState, v_texCoord);
    vec4 vel = texture2D(u_velocity, v_texCoord);
    
    float currentLum = getLuminance(current);
    float previousLum = getLuminance(previous);
    
    // Calculate luminance velocity
    float lumVel = (currentLum - previousLum) / u_deltaTime;
    
    // Accumulate with moderate damping
    float dampingFactor = 0.96 - u_flow * 0.05; // 0.96 -> 0.91
    float newVelLum = vel.r * dampingFactor + lumVel * u_flow * 1.0; // 1x flow multiplier
    
    // Store velocity in R channel (could extend to RGB if needed)
    gl_FragColor = vec4(newVelLum, 0.0, 0.0, 1.0);
}
`;
