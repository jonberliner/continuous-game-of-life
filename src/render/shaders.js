// Fragment shader for computing inner and outer averages (convolution)
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
    // Note: WebGL requires constant loop bounds, so we use a max of 50
    // which supports outer radius up to ~45 pixels
    const int MAX_STEPS = 50;
    float maxRadius = u_outerRadius;
    int steps = int(ceil(maxRadius)) + 1;
    
    for (int x = -MAX_STEPS; x <= MAX_STEPS; x++) {
        for (int y = -MAX_STEPS; y <= MAX_STEPS; y++) {
            // Skip if outside our actual radius
            if (abs(float(x)) > float(steps) || abs(float(y)) > float(steps)) continue;
            if (x == 0 && y == 0) continue;
            
            float dist = length(vec2(float(x), float(y)));
            
            if (dist > maxRadius) continue;
            
            vec2 samplePos = v_texCoord + vec2(float(x), float(y)) * pixelSize;
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

// Fragment shader for transition (SmoothLife rules + color bleeding)
export const transitionShader = `
precision highp float;

uniform sampler2D u_currentState;
uniform sampler2D u_convolution;
uniform sampler2D u_originalImage;
uniform vec2 u_resolution;

uniform float u_birth1;
uniform float u_birth2;
uniform float u_death1;
uniform float u_death2;
uniform float u_alphaM;
uniform float u_alphaN;
uniform float u_deltaTime;
uniform float u_restoration;
uniform float u_mixToOriginal;

varying vec2 v_texCoord;

const float PI = 3.14159265359;

// Sigmoid function for smooth transitions
float sigmoid(float x, float a) {
    return 1.0 / (1.0 + exp(-4.0 / a * (x - 0.5)));
}

// Double sigmoid for interval
float sigmoidInterval(float x, float a, float b, float alpha) {
    return sigmoid((x - a) / (b - a), alpha) * (1.0 - sigmoid((x - b) / (b - a), alpha));
}

// Calculate luminance from RGB
float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

// Transition function s(n, m)
float transitionFunction(float n, float m) {
    float birthTerm = sigmoidInterval(n, u_birth1, u_birth2, u_alphaN);
    float deathTerm = sigmoidInterval(n, u_death1, u_death2, u_alphaN);
    
    return birthTerm * (1.0 - sigmoid(m, u_alphaM)) + deathTerm * sigmoid(m, u_alphaM);
}

void main() {
    vec4 current = texture2D(u_currentState, v_texCoord);
    vec4 conv = texture2D(u_convolution, v_texCoord);
    vec4 original = texture2D(u_originalImage, v_texCoord);
    
    float currentLum = getLuminance(current);
    float innerLum = conv.r;  // m
    float outerLum = conv.g;  // n
    
    // Calculate transition strength based on luminance
    float transition = transitionFunction(outerLum, innerLum);
    
    // New luminance
    float newLum = currentLum + u_deltaTime * (2.0 * transition - 1.0);
    newLum = clamp(newLum, 0.0, 1.0);
    
    // Color bleeding: blend current color toward neighborhood average
    // Using the encoded averages from convolution pass
    vec2 pixelSize = 1.0 / u_resolution;
    
    // Recompute color averages (simplified for this pass)
    vec4 colorSum = vec4(0.0);
    float count = 0.0;
    
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 samplePos = v_texCoord + vec2(float(x), float(y)) * pixelSize;
            vec4 sampleColor = texture2D(u_currentState, samplePos);
            colorSum += sampleColor;
            count += 1.0;
        }
    }
    
    vec4 neighborAvg = colorSum / count;
    
    // Blend current color with neighbor average based on transition strength
    float blendFactor = abs(transition - 0.5) * 0.3; // More blending when actively transitioning
    vec4 blendedColor = mix(current, neighborAvg, blendFactor);
    
    // Scale color to match new luminance
    float currentBlendedLum = getLuminance(blendedColor);
    vec4 newColor = currentBlendedLum > 0.001 ? 
        blendedColor * (newLum / currentBlendedLum) : 
        vec4(newLum);
    
    // Apply restoration force toward original image
    vec4 finalColor = mix(newColor, original, u_restoration);
    
    // Apply mix to original (effect strength control)
    // When u_mixToOriginal = 1.0, show only original
    // When u_mixToOriginal = 0.0, show full transformation
    finalColor = mix(finalColor, original, u_mixToOriginal);
    
    // Clamp all channels
    gl_FragColor = clamp(finalColor, 0.0, 1.0);
}
`;

// Simple vertex shader for both passes
export const vertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;
