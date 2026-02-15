/**
 * Simplified frequency-domain shaders
 * Just like spatial mode but RGB channels evolve at different scales
 */

export const vertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

// Multi-scale convolution - different radius for each RGB channel
export const frequencyConvolutionShader = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_radius;

varying vec2 v_texCoord;

void main() {
    vec2 pixelSize = 1.0 / u_resolution;
    vec4 centerColor = texture2D(u_texture, v_texCoord);
    
    // Different radii for each channel (frequency separation)
    float radiusR = u_radius * 2.0;  // Red = low freq (large scale)
    float radiusG = u_radius * 1.0;  // Green = mid freq (medium scale)
    float radiusB = u_radius * 0.5;  // Blue = high freq (fine scale)
    
    vec3 sum = vec3(0.0);
    vec3 wsum = vec3(0.0);

    const int SAMPLE_COUNT = 128;
    const float GOLDEN_ANGLE = 2.39996323;
    for (int i = 0; i < SAMPLE_COUNT; i++) {
        float fi = float(i);
        float t = (fi + 0.5) / float(SAMPLE_COUNT);
        float a = fi * GOLDEN_ANGLE;
        vec2 dir = vec2(cos(a), sin(a));
        vec4 sampleColor;

        float rR = sqrt(t) * max(radiusR, 0.5);
        sampleColor = texture2D(u_texture, v_texCoord + dir * rR * pixelSize);
        sum.r += sampleColor.r;
        wsum.r += 1.0;

        float rG = sqrt(t) * max(radiusG, 0.5);
        sampleColor = texture2D(u_texture, v_texCoord + dir * rG * pixelSize);
        sum.g += sampleColor.g;
        wsum.g += 1.0;

        float rB = sqrt(t) * max(radiusB, 0.5);
        sampleColor = texture2D(u_texture, v_texCoord + dir * rB * pixelSize);
        sum.b += sampleColor.b;
        wsum.b += 1.0;
    }
    
    vec3 avgColor = vec3(
        wsum.r > 0.0 ? sum.r / wsum.r : centerColor.r,
        wsum.g > 0.0 ? sum.g / wsum.g : centerColor.g,
        wsum.b > 0.0 ? sum.b / wsum.b : centerColor.b
    );
    
    // Store average in RGB, count in alpha (for debugging)
    gl_FragColor = vec4(avgColor, 1.0);
}
`;

// Frequency evolution - SIMPLE, just like spatial mode
export const frequencyEvolutionShader = `
precision highp float;

uniform sampler2D u_currentState;
uniform sampler2D u_convolution;
uniform sampler2D u_originalImage;
uniform vec2 u_resolution;
uniform float u_chaos;
uniform float u_activity;
uniform float u_randomNoise;
uniform float u_imageRestore;
uniform float u_edgeSensitivity;
uniform float u_deltaTime;
uniform float u_time;

varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float lifeTarget(float current, float neighborhood, float phase, float chaos) {
    // Continuous birth/survival windows with small per-channel phase offsets.
    float b1 = 0.25 + 0.03 * phase;
    float b2 = 0.38 + 0.03 * phase;
    float s1 = 0.22 + 0.02 * phase;
    float s2 = 0.50 + 0.02 * phase;
    float w = mix(0.03, 0.14, chaos);

    float birth = smoothstep(b1 - w, b1, neighborhood) * (1.0 - smoothstep(b2, b2 + w, neighborhood));
    float survive = smoothstep(s1 - w, s1, neighborhood) * (1.0 - smoothstep(s2, s2 + w, neighborhood));
    float alive = smoothstep(0.45, 0.55, current);

    // If currently alive, favor survival; otherwise favor birth.
    return mix(birth, survive, alive);
}

void main() {
    vec4 current = texture2D(u_currentState, v_texCoord);
    vec4 neighbor = texture2D(u_convolution, v_texCoord);
    vec4 original = texture2D(u_originalImage, v_texCoord);
    
    // Continuous-GoL update (actual birth/survival dynamics).
    float rate = clamp((0.03 + u_activity * 2.0) * u_deltaTime, 0.0, 1.0);
    vec3 target = vec3(
        lifeTarget(current.r, neighbor.r, 0.0, u_chaos),
        lifeTarget(current.g, neighbor.g, 0.4, u_chaos),
        lifeTarget(current.b, neighbor.b, 0.8, u_chaos)
    );
    vec3 newColor = mix(current.rgb, target, rate);
    
    // Random noise
    if (u_randomNoise > 0.01) {
        vec3 randomColor = vec3(
            hash(v_texCoord * 100.0 + u_time),
            hash(v_texCoord * 200.0 + u_time),
            hash(v_texCoord * 300.0 + u_time)
        );
        // Noise is a controlled perturbation, not full overwrite unless slider is max.
        newColor = mix(newColor, randomColor, clamp(u_randomNoise * u_deltaTime * 2.0, 0.0, 1.0));
    }
    
    // Image restoration
    if (u_imageRestore > 0.01) {
        newColor = mix(newColor, original.rgb, clamp(u_imageRestore * u_deltaTime * 2.0, 0.0, 1.0));
    }
    
    newColor = clamp(newColor, 0.0, 1.0);
    
    gl_FragColor = vec4(newColor, 1.0);
}
`;

// Display shader
export const frequencyDisplayShader = `
precision highp float;

uniform sampler2D u_texture;

varying vec2 v_texCoord;

void main() {
    gl_FragColor = texture2D(u_texture, v_texCoord);
}
`;
