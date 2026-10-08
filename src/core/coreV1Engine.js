import {
    coreV1VertexShader,
    coreV1DisplayShader,
    coreV1ConvolutionShader,
    coreV1TransitionShader
} from '../render/coreV1Shaders.js';
import {
    createShader,
    createProgram,
    createTexture,
    createFramebuffer,
    setupQuad,
    setupQuadFlipped,
    bindQuadAttributes
} from '../render/webglUtils.js';
import { hexToOklab } from '../render/color.js';
import { DEFAULT_PALETTE, MAX_PALETTE_COLORS } from '../ui/tunableParams.js';

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3.0 - 2.0 * t);
}

function makeGaussianKernel1D(sigma) {
    const s = Math.max(0.2, sigma);
    const radius = Math.max(1, Math.ceil(s * 3.0));
    const size = radius * 2 + 1;
    const kernel = new Float32Array(size);
    let sum = 0.0;
    for (let i = -radius; i <= radius; i++) {
        const w = Math.exp(-(i * i) / (2.0 * s * s));
        kernel[i + radius] = w;
        sum += w;
    }
    for (let i = 0; i < size; i++) kernel[i] /= sum;
    return { kernel, radius };
}

function gaussianBlurSeparable(input, width, height, sigma) {
    const { kernel, radius } = makeGaussianKernel1D(sigma);
    const tmp = new Float32Array(width * height);
    const out = new Float32Array(width * height);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            let acc = 0.0;
            for (let k = -radius; k <= radius; k++) {
                const sx = Math.min(width - 1, Math.max(0, x + k));
                acc += input[row + sx] * kernel[k + radius];
            }
            tmp[row + x] = acc;
        }
    }

    // Vertical pass
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            let acc = 0.0;
            for (let k = -radius; k <= radius; k++) {
                const sy = Math.min(height - 1, Math.max(0, y + k));
                acc += tmp[sy * width + x] * kernel[k + radius];
            }
            out[row + x] = acc;
        }
    }
    return out;
}

function computeSourceGuidanceTextureData(imgData, width, height, edgeFrequency = 0.55) {
    const size = width * height;
    const lum = new Float32Array(size);
    const lumGuidance = new Float32Array(size);
    const gx = new Float32Array(size);
    const gy = new Float32Array(size);
    const coherence = new Float32Array(size);
    const ridge = new Float32Array(size);
    const out = new Uint8Array(size * 4);

    const src = imgData.data;
    for (let i = 0, p = 0; i < size; i++, p += 4) {
        const r = src[p] / 255.0;
        const g = src[p + 1] / 255.0;
        const b = src[p + 2] / 255.0;
        lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    const ef = clamp01(edgeFrequency);
    // XDoG-style contour abstraction: low ef => coarser, cleaner outlines; high ef => finer detail.
    const sigmaFine = 0.40 + (1.0 - ef) * 1.10;
    const sigmaCoarse = 1.4 + (1.0 - ef) * 3.2;
    const blurFine = gaussianBlurSeparable(lum, width, height, sigmaFine);
    const blurCoarse = gaussianBlurSeparable(lum, width, height, sigmaCoarse);

    // Base field for orientation/coherence extraction.
    const orientationMix = 0.35 + 0.45 * ef; // more fine detail when ef is high
    for (let i = 0; i < size; i++) {
        lumGuidance[i] = blurCoarse[i] * (1.0 - orientationMix) + blurFine[i] * orientationMix;
    }

    const idx = (x, y) => y * width + x;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i00 = idx(x - 1, y - 1);
            const i01 = idx(x, y - 1);
            const i02 = idx(x + 1, y - 1);
            const i10 = idx(x - 1, y);
            const i12 = idx(x + 1, y);
            const i20 = idx(x - 1, y + 1);
            const i21 = idx(x, y + 1);
            const i22 = idx(x + 1, y + 1);

            const sx =
                -lumGuidance[i00] - 2.0 * lumGuidance[i10] - lumGuidance[i20] +
                lumGuidance[i02] + 2.0 * lumGuidance[i12] + lumGuidance[i22];
            const sy =
                -lumGuidance[i00] - 2.0 * lumGuidance[i01] - lumGuidance[i02] +
                lumGuidance[i20] + 2.0 * lumGuidance[i21] + lumGuidance[i22];

            const i = idx(x, y);
            gx[i] = sx;
            gy[i] = sy;
        }
    }

    const gradMag = new Float32Array(size);
    let maxGrad = 1.0e-6;
    for (let i = 0; i < size; i++) {
        const gmag = Math.hypot(gx[i], gy[i]);
        gradMag[i] = gmag;
        if (gmag > maxGrad) maxGrad = gmag;
    }

    // Canny-style contour extraction: thin, binary cartoon-like lines.
    const nms = new Float32Array(size);
    let maxNms = 1.0e-6;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = idx(x, y);
            const g = gradMag[i];
            if (g <= 0.0) continue;

            let theta = Math.atan2(gy[i], gx[i]) * (180.0 / Math.PI);
            if (theta < 0.0) theta += 180.0;

            let g1 = 0.0;
            let g2 = 0.0;
            if (theta < 22.5 || theta >= 157.5) {
                g1 = gradMag[idx(x - 1, y)];
                g2 = gradMag[idx(x + 1, y)];
            } else if (theta < 67.5) {
                g1 = gradMag[idx(x - 1, y - 1)];
                g2 = gradMag[idx(x + 1, y + 1)];
            } else if (theta < 112.5) {
                g1 = gradMag[idx(x, y - 1)];
                g2 = gradMag[idx(x, y + 1)];
            } else {
                g1 = gradMag[idx(x - 1, y + 1)];
                g2 = gradMag[idx(x + 1, y - 1)];
            }

            const v = (g >= g1 && g >= g2) ? g : 0.0;
            nms[i] = v;
            if (v > maxNms) maxNms = v;
        }
    }

    // Edge frequency controls contour density/detail:
    // low ef = coarser/sparser (higher threshold), high ef = finer/denser (lower threshold).
    const highT = (0.58 - 0.36 * ef) * maxNms;
    const lowT = highT * (0.42 + 0.12 * ef);
    const ridgeMask = new Uint8Array(size);
    const weakMask = new Uint8Array(size);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = idx(x, y);
            const v = nms[i];
            if (v >= highT) ridgeMask[i] = 1;
            else if (v >= lowT) weakMask[i] = 1;
        }
    }

    // Hysteresis: keep weak edges connected to strong edges.
    let changed = true;
    let iter = 0;
    while (changed && iter < 8) {
        changed = false;
        iter++;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = idx(x, y);
                if (weakMask[i] === 0 || ridgeMask[i] === 1) continue;
                if (
                    ridgeMask[idx(x - 1, y - 1)] || ridgeMask[idx(x, y - 1)] || ridgeMask[idx(x + 1, y - 1)] ||
                    ridgeMask[idx(x - 1, y)]     || ridgeMask[idx(x + 1, y)] ||
                    ridgeMask[idx(x - 1, y + 1)] || ridgeMask[idx(x, y + 1)] || ridgeMask[idx(x + 1, y + 1)]
                ) {
                    ridgeMask[i] = 1;
                    changed = true;
                }
            }
        }
    }
    // Coarse-end cleanup: prune sparse micro-contours when Edge Frequency is low.
    const prunePasses = Math.max(0, Math.floor((1.0 - ef) * 3.0));
    for (let pass = 0; pass < prunePasses; pass++) {
        const keep = new Uint8Array(size);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = idx(x, y);
                if (!ridgeMask[i]) continue;
                let neighbors = 0;
                neighbors += ridgeMask[idx(x - 1, y - 1)] ? 1 : 0;
                neighbors += ridgeMask[idx(x, y - 1)] ? 1 : 0;
                neighbors += ridgeMask[idx(x + 1, y - 1)] ? 1 : 0;
                neighbors += ridgeMask[idx(x - 1, y)] ? 1 : 0;
                neighbors += ridgeMask[idx(x + 1, y)] ? 1 : 0;
                neighbors += ridgeMask[idx(x - 1, y + 1)] ? 1 : 0;
                neighbors += ridgeMask[idx(x, y + 1)] ? 1 : 0;
                neighbors += ridgeMask[idx(x + 1, y + 1)] ? 1 : 0;
                // Require local support; isolated spikes are dropped.
                if (neighbors >= 2) keep[i] = 1;
            }
        }
        for (let i = 0; i < size; i++) ridgeMask[i] = keep[i];
    }
    for (let i = 0; i < size; i++) ridge[i] = ridgeMask[i] ? 1.0 : 0.0;

    // IMPORTANT: Guidance direction/coherence must be derived from the same contour map
    // used for overlay, not from raw image texture gradients.
    const ridgeGuidance = gaussianBlurSeparable(ridge, width, height, 0.8 + (1.0 - ef) * 1.2);
    for (let i = 0; i < size; i++) {
        gx[i] = 0.0;
        gy[i] = 0.0;
    }
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i00 = idx(x - 1, y - 1);
            const i01 = idx(x, y - 1);
            const i02 = idx(x + 1, y - 1);
            const i10 = idx(x - 1, y);
            const i12 = idx(x + 1, y);
            const i20 = idx(x - 1, y + 1);
            const i21 = idx(x, y + 1);
            const i22 = idx(x + 1, y + 1);

            const sx =
                -ridgeGuidance[i00] - 2.0 * ridgeGuidance[i10] - ridgeGuidance[i20] +
                ridgeGuidance[i02] + 2.0 * ridgeGuidance[i12] + ridgeGuidance[i22];
            const sy =
                -ridgeGuidance[i00] - 2.0 * ridgeGuidance[i01] - ridgeGuidance[i02] +
                ridgeGuidance[i20] + 2.0 * ridgeGuidance[i21] + ridgeGuidance[i22];

            const i = idx(x, y);
            gx[i] = sx;
            gy[i] = sy;
        }
    }

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let jxx = 0.0;
            let jyy = 0.0;
            let jxy = 0.0;
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    const ii = idx(x + ox, y + oy);
                    const gxx = gx[ii];
                    const gyy = gy[ii];
                    jxx += gxx * gxx;
                    jyy += gyy * gyy;
                    jxy += gxx * gyy;
                }
            }
            jxx /= 9.0;
            jyy /= 9.0;
            jxy /= 9.0;

            const tr = jxx + jyy + 1.0e-8;
            const aniso = Math.sqrt((jxx - jyy) * (jxx - jyy) + 4.0 * jxy * jxy);
            const i = idx(x, y);
            const edgeSupport = smoothstep(0.05, 0.35, ridgeGuidance[i]);
            const c = clamp01(aniso / tr) * edgeSupport;

            const theta = 0.5 * Math.atan2(2.0 * jxy, jxx - jyy);
            const tx = edgeSupport > 0.0 ? Math.cos(theta + Math.PI * 0.5) : 1.0;
            const ty = edgeSupport > 0.0 ? Math.sin(theta + Math.PI * 0.5) : 0.0;
            coherence[i] = c;

            out[i * 4] = Math.floor(clamp01(tx * 0.5 + 0.5) * 255.0);
            out[i * 4 + 1] = Math.floor(clamp01(ty * 0.5 + 0.5) * 255.0);
            out[i * 4 + 2] = Math.floor(c * 255.0);
            out[i * 4 + 3] = Math.floor(ridge[i] * 255.0);
        }
    }

    // Fill boundary pixels from nearest interior to avoid undefined edges.
    for (let x = 0; x < width; x++) {
        const top = idx(x, 0);
        const topSrc = idx(Math.min(width - 2, Math.max(1, x)), 1);
        const bot = idx(x, height - 1);
        const botSrc = idx(Math.min(width - 2, Math.max(1, x)), height - 2);
        out[top * 4] = out[topSrc * 4];
        out[top * 4 + 1] = out[topSrc * 4 + 1];
        out[top * 4 + 2] = out[topSrc * 4 + 2];
        out[top * 4 + 3] = out[topSrc * 4 + 3];
        out[bot * 4] = out[botSrc * 4];
        out[bot * 4 + 1] = out[botSrc * 4 + 1];
        out[bot * 4 + 2] = out[botSrc * 4 + 2];
        out[bot * 4 + 3] = out[botSrc * 4 + 3];
    }
    for (let y = 0; y < height; y++) {
        const left = idx(0, y);
        const leftSrc = idx(1, Math.min(height - 2, Math.max(1, y)));
        const right = idx(width - 1, y);
        const rightSrc = idx(width - 2, Math.min(height - 2, Math.max(1, y)));
        out[left * 4] = out[leftSrc * 4];
        out[left * 4 + 1] = out[leftSrc * 4 + 1];
        out[left * 4 + 2] = out[leftSrc * 4 + 2];
        out[left * 4 + 3] = out[leftSrc * 4 + 3];
        out[right * 4] = out[rightSrc * 4];
        out[right * 4 + 1] = out[rightSrc * 4 + 1];
        out[right * 4 + 2] = out[rightSrc * 4 + 2];
        out[right * 4 + 3] = out[rightSrc * 4 + 3];
    }

    return out;
}

export class CoreV1Engine {
    constructor(canvas, width, height, originalImageData) {
        this.width = width;
        this.height = height;
        this.originalImageData = originalImageData;
        this.frameCount = 0;
        this.gl = canvas.getContext('webgl', {
            preserveDrawingBuffer: true,
            premultipliedAlpha: false,
            alpha: false
        });
        if (!this.gl) throw new Error('WebGL not supported');
        this.gl.disable(this.gl.BLEND);
        this.initWebGL();
        this.reset();
    }

    initWebGL() {
        const gl = this.gl;
        const vs = createShader(gl, gl.VERTEX_SHADER, coreV1VertexShader);
        const displayFs = createShader(gl, gl.FRAGMENT_SHADER, coreV1DisplayShader);
        const convFs = createShader(gl, gl.FRAGMENT_SHADER, coreV1ConvolutionShader);
        const transFs = createShader(gl, gl.FRAGMENT_SHADER, coreV1TransitionShader);

        this.displayProgram = createProgram(gl, vs, displayFs);
        this.convProgram = createProgram(gl, vs, convFs);
        this.transProgram = createProgram(gl, vs, transFs);

        this.displayQuad = setupQuadFlipped(gl, this.displayProgram);
        this.blitQuad = setupQuad(gl, this.displayProgram);
        this.convQuad = setupQuad(gl, this.convProgram);
        this.transQuad = setupQuad(gl, this.transProgram);

        this.originalTexture = createTexture(gl, this.width, this.height, this.originalImageData);
        this.stateTexture0 = createTexture(gl, this.width, this.height, this.originalImageData);
        this.stateTexture1 = createTexture(gl, this.width, this.height);
        this.convTexture = createTexture(gl, this.width, this.height);
        this.sourceGuidanceTexture = createTexture(gl, this.width, this.height);

        this.stateFramebuffer0 = createFramebuffer(gl, this.stateTexture0);
        this.stateFramebuffer1 = createFramebuffer(gl, this.stateTexture1);
        this.convFramebuffer = createFramebuffer(gl, this.convTexture);

        this.currentStateIndex = 0;
        gl.viewport(0, 0, this.width, this.height);
    }

    reset() {
        const gl = this.gl;
        
        // Get image data - handle different input types
        let imgData;
        if (this.originalImageData instanceof ImageData) {
            // Already ImageData, clone it
            imgData = new ImageData(
                new Uint8ClampedArray(this.originalImageData.data),
                this.originalImageData.width,
                this.originalImageData.height
            );
        } else {
            // It's an Image, Canvas, or other drawable - convert to ImageData
            const canvas = document.createElement('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.originalImageData, 0, 0, this.width, this.height);
            imgData = ctx.getImageData(0, 0, this.width, this.height);
        }
        this.guidanceSourceImageData = new ImageData(
            new Uint8ClampedArray(imgData.data),
            imgData.width,
            imgData.height
        );
        
        // Convert RGB to (L, a, b, M) where M starts equal to L
        for (let i = 0; i < imgData.data.length; i += 4) {
            const r = imgData.data[i] / 255.0;
            const g = imgData.data[i + 1] / 255.0;
            const b = imgData.data[i + 2] / 255.0;
            
            // Compute L as luminance
            const L = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Compute (a, b) chroma from RGB
            const maxc = Math.max(r, g, b);
            const minc = Math.min(r, g, b);
            const delta = maxc - minc;
            let h = 0;
            if (delta > 1e-6) {
                if (maxc === r) h = ((g - b) / delta) % 6;
                else if (maxc === g) h = (b - r) / delta + 2;
                else h = (r - g) / delta + 4;
                h /= 6.0;
            }
            const s = maxc > 1e-6 ? delta / maxc : 0;
            const a = s * Math.cos(h * 2 * Math.PI);
            const bb = s * Math.sin(h * 2 * Math.PI);
            
            // Encode to [0, 255]
            imgData.data[i] = Math.floor(L * 255);           // R = L
            imgData.data[i + 1] = Math.floor((a * 0.5 + 0.5) * 255);  // G = a encoded
            imgData.data[i + 2] = Math.floor((bb * 0.5 + 0.5) * 255); // B = b encoded
            imgData.data[i + 3] = Math.floor(L * 255);       // A = M (starts as L)
        }
        
        gl.bindTexture(gl.TEXTURE_2D, this.stateTexture0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgData);
        gl.bindTexture(gl.TEXTURE_2D, this.stateTexture1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgData);

        this._lastGuidanceEdgeFrequency = null;
        this.updateSourceGuidanceTexture(0.55);
        
        this.currentStateIndex = 0;
        this.frameCount = 0;
    }

    updateSourceGuidanceTexture(edgeFrequency) {
        if (!this.guidanceSourceImageData) return;
        const freq = Math.max(0.0, Math.min(1.0, edgeFrequency ?? 0.55));
        const data = computeSourceGuidanceTextureData(this.guidanceSourceImageData, this.width, this.height, freq);
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.sourceGuidanceTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.width,
            this.height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        );
        this._lastGuidanceEdgeFrequency = freq;
    }

    step(params) {
        const gl = this.gl;
        this.frameCount++;
        this.lastParams = params;
        const guidanceFreq = params.sourceEdgeFrequency ?? 0.55;
        if (this._lastGuidanceEdgeFrequency === null || Math.abs(guidanceFreq - this._lastGuidanceEdgeFrequency) > 1.0e-4) {
            this.updateSourceGuidanceTexture(guidanceFreq);
        }
        const current = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        const nextFB = this.currentStateIndex === 0 ? this.stateFramebuffer1 : this.stateFramebuffer0;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.convFramebuffer);
        gl.useProgram(this.convProgram);
        gl.uniform2f(gl.getUniformLocation(this.convProgram, 'u_resolution'), this.width, this.height);
        const avgDim = (this.width + this.height) * 0.5;
        const radiusPx = Math.max(1.0, (params.radius ?? 0.01) * avgDim);
        gl.uniform1f(gl.getUniformLocation(this.convProgram, 'u_radius'), radiusPx);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, current);
        gl.uniform1i(gl.getUniformLocation(this.convProgram, 'u_texture'), 0);
        bindQuadAttributes(gl, this.convQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindFramebuffer(gl.FRAMEBUFFER, nextFB);
        gl.useProgram(this.transProgram);
        gl.uniform2f(gl.getUniformLocation(this.transProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_radius'), radiusPx);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_deltaTime'), params.deltaTime);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_boundaryStrength'), params.boundaryStrength ?? 0.1);
        
        // L Dynamics
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreLRate'), params.coreLRate ?? 1.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreLDiffGain'), params.coreLDiffGain ?? 0.5);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreMaxDeltaL'), params.coreMaxDeltaL ?? 0.08);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_refractoryGain'), params.refractoryGain ?? 0.35);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_refractoryThreshold'), params.refractoryThreshold ?? 0.12);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_refractoryWidth'), params.refractoryWidth ?? 0.10);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_excitabilityGain'), params.excitabilityGain ?? 0.20);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_refractoryColorDamp'), params.refractoryColorDamp ?? 0.35);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_satRegimeGain'), params.satRegimeGain ?? 0.10);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_satRegimeSpread'), params.satRegimeSpread ?? 0.08);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_lumaChromaCoexistGain'), params.lumaChromaCoexistGain ?? 0.20);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_memoryDecay'), params.memoryDecay ?? 0.05);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_historyOscillationGain'), params.historyOscillationGain ?? 0.8);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_divergenceGain'), params.divergenceGain ?? 0.6);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_moderationGain'), params.moderationGain ?? 0.2);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_varianceAmplifyGain'), params.varianceAmplifyGain ?? 0.5);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_flatBreakupGain'), params.flatBreakupGain ?? 0.5);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_noiseGain'), params.noiseGain ?? 0.05);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_contrastGain'), params.contrastGain ?? 0.5);
        
        // Chroma Dynamics
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreColorRate'), params.coreColorRate ?? 1.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreAdoptGain'), params.coreAdoptGain ?? 0.85);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreGrowthHueCoupling'), params.coreGrowthHueCoupling ?? 0.25);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreMaxDeltaAB'), params.coreMaxDeltaAB ?? 0.10);
        
        // Diversity
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_diversityKick'), params.diversityKick ?? 0.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_antiConsensusGain'), params.antiConsensusGain ?? 0.18);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_vorticityGain'), params.vorticityGain ?? 0.15);
        
        // State Angles
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_angleL'), params.angleL ?? 0.5);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_angleM'), params.angleM ?? 1.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_angleS'), params.angleS ?? 0.3);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_angleV'), params.angleV ?? 0.8);
        
        // Angle Fixes
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_angleQuantization'), params.angleQuantization ?? 4.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_spatialFrequency'), params.spatialFrequency ?? 5.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_positionAngleBias'), params.positionAngleBias ?? 0.5);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_momentumThreshold'), params.momentumThreshold ?? 0.8);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_varianceThreshold'), params.varianceThreshold ?? 0.6);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_memoryFreqScale'), params.memoryFreqScale ?? 10.0);
        
        // Attractors
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_attractorGain'), params.attractorGain ?? 0.30);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_attractor1'), params.attractor1 ?? 0.15);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_attractor2'), params.attractor2 ?? 0.50);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_attractor3'), params.attractor3 ?? 0.85);
        
        // Boundaries
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_boundaryAmplify'), params.boundaryAmplify ?? 0.50);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_hysteresisGain'), params.hysteresisGain ?? 0.30);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_competitionGain'), params.competitionGain ?? 0.40);

        // Hybrid SmoothLife kernel (Phase A)
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelBlend'), 1.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelGrowthGain'), params.kernelGrowthGain ?? 0.25);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelInhibitGain'), params.kernelInhibitGain ?? 0.20);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelInnerRatio'), params.kernelInnerRatio ?? 0.50);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelTransitionWidth'), params.kernelTransitionWidth ?? 0.08);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelBirthCenter'), params.kernelBirthCenter ?? 0.30);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelBirthWidth'), params.kernelBirthWidth ?? 0.18);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelSurvivalCenter'), params.kernelSurvivalCenter ?? 0.46);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelSurvivalWidth'), params.kernelSurvivalWidth ?? 0.22);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelSecondaryGain'), params.kernelSecondaryGain ?? 0.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelSecondaryRadius'), params.kernelSecondaryRadius ?? 2.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelSecondaryInner'), params.kernelSecondaryInner ?? 0.60);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelColorToLGain'), params.kernelColorToLGain ?? 0.20);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelLToColorGain'), params.kernelLToColorGain ?? 0.35);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_colorWaveDamping'), params.colorWaveDamping ?? 0.75);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_colorPocketGain'), params.colorPocketGain ?? 0.30);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_fieldMomentCoupling'), params.fieldMomentCoupling ?? 0.18);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_crossMomentCoupling'), params.crossMomentCoupling ?? 0.14);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_scaleMomentCoupling'), params.scaleMomentCoupling ?? 0.12);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_sourceGuidanceGain'), params.sourceGuidanceGain ?? 0.55);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_sourceAnisotropy'), params.sourceAnisotropy ?? 1.20);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_sourceCoherenceFloor'), params.sourceCoherenceFloor ?? 0.20);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_sourceRidgeBias'), params.sourceRidgeBias ?? 0.35);
        
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_frameCount'), this.frameCount);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, current);
        gl.uniform1i(gl.getUniformLocation(this.transProgram, 'u_currentState'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.convTexture);
        gl.uniform1i(gl.getUniformLocation(this.transProgram, 'u_convolution'), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(gl.getUniformLocation(this.transProgram, 'u_originalImage'), 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.sourceGuidanceTexture);
        gl.uniform1i(gl.getUniformLocation(this.transProgram, 'u_sourceGuidance'), 3);
        bindQuadAttributes(gl, this.transQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        this.currentStateIndex = 1 - this.currentStateIndex;
    }

    render() {
        const gl = this.gl;
        const current = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.displayProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, current);
        gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'u_texture'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.sourceGuidanceTexture);
        gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'u_sourceGuidance'), 1);
        const showGuidanceEdges = this.lastParams && this.lastParams.showGuidanceEdges ? 1.0 : 0.0;
        gl.uniform1f(gl.getUniformLocation(this.displayProgram, 'u_showGuidanceEdges'), showGuidanceEdges);
        gl.uniform2f(gl.getUniformLocation(this.displayProgram, 'u_texel'), 1.0 / this.width, 1.0 / this.height);
        gl.uniform1f(
            gl.getUniformLocation(this.displayProgram, 'u_structureIdentityMix'),
            this.lastParams?.structureIdentityMix ?? 0.0
        );
        gl.uniform1f(
            gl.getUniformLocation(this.displayProgram, 'u_structureIdentityColor'),
            this.lastParams?.structureIdentityColor ?? 0.0
        );
        
        this.setPaletteUniforms(this.lastParams || {});

        bindQuadAttributes(gl, this.displayQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    setPaletteUniforms(params) {
        const gl = this.gl;
        const prog = this.displayProgram;
        const colors = (Array.isArray(params.palette) && params.palette.length
            ? params.palette
            : DEFAULT_PALETTE.colors).slice(0, MAX_PALETTE_COLORS);
        const background = params.paletteBackground || DEFAULT_PALETTE.background;
        const cacheKey = colors.join(',') + '|' + background;
        if (cacheKey !== this._paletteCacheKey) {
            const flat = new Float32Array(MAX_PALETTE_COLORS * 3);
            colors.forEach((hex, i) => flat.set(hexToOklab(hex), i * 3));
            this._paletteFlat = flat;
            this._paletteCount = colors.length;
            this._paletteBackground = hexToOklab(background);
            this._paletteCacheKey = cacheKey;
        }
        // Drift: 1.0 on the slider is one full trip around the palette every 20 seconds.
        const drift = (params.paletteCycle ?? 0) * (performance.now() / 1000) * 0.05;
        const shift = (((params.paletteShift ?? 0) + drift) % 1 + 1) % 1;

        gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteOn'), params.paletteOn === false ? 0.0 : 1.0);
        gl.uniform3fv(gl.getUniformLocation(prog, 'u_palette'), this._paletteFlat);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteCount'), this._paletteCount);
        gl.uniform3fv(gl.getUniformLocation(prog, 'u_paletteBackground'), this._paletteBackground);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteFill'), params.paletteFill ?? 0.55);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteBands'), params.paletteBands ?? 0.25);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteShading'), params.paletteShading ?? 0.7);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteShift'), shift);
    }

    readCurrentStatePixels() {
        const gl = this.gl;
        const currentFB = this.currentStateIndex === 0 ? this.stateFramebuffer0 : this.stateFramebuffer1;
        const size = this.width * this.height * 4;
        if (!this._readback || this._readback.length !== size) this._readback = new Uint8Array(size);
        gl.bindFramebuffer(gl.FRAMEBUFFER, currentFB);
        gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this._readback);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return this._readback;
    }

    destroy() {
        const gl = this.gl;
        gl.deleteProgram(this.displayProgram);
        gl.deleteProgram(this.convProgram);
        gl.deleteProgram(this.transProgram);
        gl.deleteTexture(this.originalTexture);
        gl.deleteTexture(this.stateTexture0);
        gl.deleteTexture(this.stateTexture1);
        gl.deleteTexture(this.convTexture);
        gl.deleteTexture(this.sourceGuidanceTexture);
        gl.deleteFramebuffer(this.stateFramebuffer0);
        gl.deleteFramebuffer(this.stateFramebuffer1);
        gl.deleteFramebuffer(this.convFramebuffer);
    }
}
