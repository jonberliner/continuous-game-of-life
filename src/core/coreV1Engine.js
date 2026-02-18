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

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

function computeSourceGuidanceTextureData(imgData, width, height, edgeFrequency = 0.55) {
    const size = width * height;
    const lum = new Float32Array(size);
    const lumBlur = new Float32Array(size);
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

    const idx = (x, y) => y * width + x;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                lumBlur[idx(x, y)] = lum[idx(x, y)];
                continue;
            }
            let sum = 0.0;
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    sum += lum[idx(x + ox, y + oy)];
                }
            }
            lumBlur[idx(x, y)] = sum / 9.0;
        }
    }
    const ef = clamp01(edgeFrequency);
    for (let i = 0; i < size; i++) {
        lumGuidance[i] = lumBlur[i] * (1.0 - ef) + lum[i] * ef;
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

    let maxGrad = 1.0e-6;
    for (let i = 0; i < size; i++) {
        const gmag = Math.hypot(gx[i], gy[i]);
        if (gmag > maxGrad) maxGrad = gmag;
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
            const c = clamp01(aniso / tr);

            const theta = 0.5 * Math.atan2(2.0 * jxy, jxx - jyy);
            const tx = Math.cos(theta + Math.PI * 0.5);
            const ty = Math.sin(theta + Math.PI * 0.5);

            const i = idx(x, y);
            coherence[i] = c;
            ridge[i] = clamp01(Math.hypot(gx[i], gy[i]) / maxGrad);

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
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreAdoptGain'), params.coreAdoptGain ?? 1.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreGrowthHueCoupling'), params.coreGrowthHueCoupling ?? 0.4);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_coreMaxDeltaAB'), params.coreMaxDeltaAB ?? 0.08);
        
        // Diversity
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_diversityKick'), params.diversityKick ?? 0.5);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_antiConsensusGain'), params.antiConsensusGain ?? 0.4);
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
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelBlend'), params.kernelBlend ?? 0.0);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelGrowthGain'), params.kernelGrowthGain ?? 0.25);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelInhibitGain'), params.kernelInhibitGain ?? 0.20);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelInnerRatio'), params.kernelInnerRatio ?? 0.50);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelTransitionWidth'), params.kernelTransitionWidth ?? 0.08);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelBirthCenter'), params.kernelBirthCenter ?? 0.30);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelBirthWidth'), params.kernelBirthWidth ?? 0.18);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelSurvivalCenter'), params.kernelSurvivalCenter ?? 0.46);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelSurvivalWidth'), params.kernelSurvivalWidth ?? 0.22);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelColorToLGain'), params.kernelColorToLGain ?? 0.35);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_kernelLToColorGain'), params.kernelLToColorGain ?? 0.40);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_colorWaveDamping'), params.colorWaveDamping ?? 0.75);
        gl.uniform1f(gl.getUniformLocation(this.transProgram, 'u_colorPocketGain'), params.colorPocketGain ?? 0.35);
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
        
        bindQuadAttributes(gl, this.displayQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
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
