// CLEAN REWRITE - Simple, stable shaders

// Simple vertex shader
export const vertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

// Simple display shader
export const displayShader = `
precision highp float;

uniform sampler2D u_texture;
varying vec2 v_texCoord;

void main() {
    gl_FragColor = texture2D(u_texture, v_texCoord);
}
`;

// Edge detection shader - outputs BOOLEAN mask (0 or 1)
export const edgeDetectionShader = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_edgeSensitivity;

varying vec2 v_texCoord;

float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

void main() {
    vec2 pixelSize = 1.0 / u_resolution;
    
    // Sobel edge detection
    float gx = 0.0;
    float gy = 0.0;
    
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 offset = vec2(float(x), float(y)) * pixelSize;
            float lum = getLuminance(texture2D(u_texture, v_texCoord + offset));
            
            if (x == -1) gx -= lum * (y == 0 ? 2.0 : 1.0);
            if (x == 1) gx += lum * (y == 0 ? 2.0 : 1.0);
            if (y == -1) gy -= lum * (x == 0 ? 2.0 : 1.0);
            if (y == 1) gy += lum * (x == 0 ? 2.0 : 1.0);
        }
    }
    
    float edgeMagnitude = sqrt(gx * gx + gy * gy);
    
    // BOOLEAN: threshold determines edge sensitivity
    // Higher sensitivity = lower threshold = more edges
    float threshold = 1.0 - u_edgeSensitivity;
    float isEdge = edgeMagnitude > threshold ? 1.0 : 0.0;
    
    // Store as R channel
    gl_FragColor = vec4(isEdge, 0.0, 0.0, 1.0);
}
`;

// Convolution shader - just compute neighborhood average
export const convolutionShader = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_radius;  // Single radius parameter

varying vec2 v_texCoord;

float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

void main() {
    vec2 pixelSize = 1.0 / u_resolution;
    vec4 centerColor = texture2D(u_texture, v_texCoord);
    
    float lumSum = 0.0;
    vec4 colorSum = vec4(0.0);
    float count = 0.0;
    
    // Fixed max for WebGL
    const int MAX_STEPS = 30;
    int steps = int(ceil(u_radius)) + 1;
    float fSteps = float(steps);
    
    for (int x = -MAX_STEPS; x <= MAX_STEPS; x++) {
        for (int y = -MAX_STEPS; y <= MAX_STEPS; y++) {
            float fx = float(x);
            float fy = float(y);
            float absFx = fx < 0.0 ? -fx : fx;
            float absFy = fy < 0.0 ? -fy : fy;
            if (absFx > fSteps || absFy > fSteps) continue;
            if (x == 0 && y == 0) continue;
            
            float dist = length(vec2(fx, fy));
            if (dist > u_radius) continue;
            
            vec2 samplePos = v_texCoord + vec2(fx, fy) * pixelSize;
            vec4 sampleColor = texture2D(u_texture, samplePos);
            
            lumSum += getLuminance(sampleColor);
            colorSum += sampleColor;
            count += 1.0;
        }
    }
    
    float avgLum = count > 0.0 ? lumSum / count : getLuminance(centerColor);
    vec4 avgColor = count > 0.0 ? colorSum / count : centerColor;
    
    // Pack: R = avg luminance, GBA = avg color
    gl_FragColor = vec4(avgLum, avgColor.rgb);
}
`;

// Transition shader - CLEAN AND SIMPLE
export const transitionShader = `
precision highp float;

uniform sampler2D u_currentState;
uniform sampler2D u_convolution;
uniform sampler2D u_originalImage;
uniform sampler2D u_edgeTexture;
uniform vec2 u_resolution;
uniform float u_time;

uniform float u_chaos;           // 0-1: How easily cells flip
uniform float u_randomNoise;     // 0-1: Random color variation  
uniform float u_imageRestore;    // 0-1: Memory of original (non-edges)
uniform float u_deltaTime;

varying vec2 v_texCoord;

float getLuminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vec4 current = texture2D(u_currentState, v_texCoord);
    vec4 conv = texture2D(u_convolution, v_texCoord);
    vec4 original = texture2D(u_originalImage, v_texCoord);
    float isEdge = texture2D(u_edgeTexture, v_texCoord).r;
    
    // EDGES: Always show original, done!
    if (isEdge > 0.5) {
        gl_FragColor = original;
        return;
    }
    
    // NON-EDGES: Evolve with simple GoL
    float currentLum = getLuminance(current);
    float neighborLum = conv.r;  // Average luminance of neighbors
    
    // Simple rule: Move toward neighbor average
    // Chaos controls how responsive we are
    float diff = neighborLum - currentLum;
    float response = diff * (0.2 + u_chaos * 0.8) * u_deltaTime;
    
    // Add random flicker based on chaos
    float randomFlip = (hash(v_texCoord * 100.0 + u_time) - 0.5) * u_chaos * 0.05 * u_deltaTime;
    
    float newLum = currentLum + response + randomFlip;
    newLum = clamp(newLum, 0.15, 0.85);
    
    // Scale color to new luminance (preserves color ratios for GoL evolution)
    vec4 evolvedColor = current * (newLum / max(currentLum, 0.01));
    
    // Generate pure random color
    vec4 randomColor = vec4(
        hash(v_texCoord * 200.0 + u_time * 0.3),
        hash(v_texCoord * 300.0 + u_time * 0.4),
        hash(v_texCoord * 400.0 + u_time * 0.5),
        1.0
    );
    
    // Mix: 0 = pure evolved, 1 = pure random
    vec4 newColor = mix(evolvedColor, randomColor, u_randomNoise);
    
    // Image restoration: ONLY if > 0!
    if (u_imageRestore > 0.01) {
        newColor = mix(newColor, original, u_imageRestore * u_deltaTime * 0.2);
    }
    
    gl_FragColor = clamp(newColor, 0.0, 1.0);
}
`;
