/**
 * CLEAN REWRITE - Simple stable GoL engine
 */

import { 
    vertexShader,
    displayShader,
    edgeDetectionShader,
    convolutionShader, 
    transitionShader,
    structuredNoiseUpdateShader,
    sectionMapShader
} from '../render/shaders.js';
import { 
    createShader, 
    createProgram, 
    createTexture, 
    createFramebuffer,
    setupQuad,
    setupQuadFlipped,
    bindQuadAttributes 
} from '../render/webglUtils.js';

export class SmoothLifeEngine {
    constructor(canvas, width, height, originalImageData, recreateCanvas = false) {
        this.width = width;
        this.height = height;
        this.originalImageData = originalImageData;
        this.frameCount = 0;
        
        // Only recreate canvas if explicitly told to (when switching modes)
        if (recreateCanvas) {
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const parent = canvas.parentElement;
            
            if (!parent) {
                throw new Error('Canvas has no parent element');
            }
            
            canvas.remove();
            
            const newCanvas = document.createElement('canvas');
            newCanvas.id = 'glCanvas';
            newCanvas.width = canvasWidth;
            newCanvas.height = canvasHeight;
            parent.appendChild(newCanvas);
            
            canvas = newCanvas;
        }
        
        this.gl = canvas.getContext('webgl', {
            preserveDrawingBuffer: true,
            premultipliedAlpha: false,
            alpha: false
        });
        
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
        
        this.gl.disable(this.gl.BLEND);
        
        this.initWebGL();
        this.reset();
    }
    
    initWebGL() {
        const gl = this.gl;
        
        // Compile shaders
        const vs = createShader(gl, gl.VERTEX_SHADER, vertexShader);
        const displayFs = createShader(gl, gl.FRAGMENT_SHADER, displayShader);
        const edgeFs = createShader(gl, gl.FRAGMENT_SHADER, edgeDetectionShader);
        const convFs = createShader(gl, gl.FRAGMENT_SHADER, convolutionShader);
        const transFs = createShader(gl, gl.FRAGMENT_SHADER, transitionShader);
        const noiseFs = createShader(gl, gl.FRAGMENT_SHADER, structuredNoiseUpdateShader);
        const sectionFs = createShader(gl, gl.FRAGMENT_SHADER, sectionMapShader);
        
        this.displayProgram = createProgram(gl, vs, displayFs);
        this.edgeProgram = createProgram(gl, vs, edgeFs);
        this.convolutionProgram = createProgram(gl, vs, convFs);
        this.transitionProgram = createProgram(gl, vs, transFs);
        this.noiseProgram = createProgram(gl, vs, noiseFs);
        this.sectionProgram = createProgram(gl, vs, sectionFs);
        
        // Setup geometry
        this.displayQuad = setupQuadFlipped(gl, this.displayProgram);
        this.edgeQuad = setupQuad(gl, this.edgeProgram);
        this.convQuad = setupQuad(gl, this.convolutionProgram);
        this.transQuad = setupQuad(gl, this.transitionProgram);
        this.noiseQuad = setupQuad(gl, this.noiseProgram);
        this.sectionQuad = setupQuad(gl, this.sectionProgram);
        
        // Create textures
        this.originalTexture = createTexture(gl, this.width, this.height, this.originalImageData);
        this.edgeTexture = createTexture(gl, this.width, this.height);
        this.stateTexture0 = createTexture(gl, this.width, this.height, this.originalImageData);
        this.stateTexture1 = createTexture(gl, this.width, this.height);
        this.convolutionTexture = createTexture(gl, this.width, this.height);
        this.noiseTexture0 = createTexture(gl, this.width, this.height);
        this.noiseTexture1 = createTexture(gl, this.width, this.height);
        this.sectionTexture = createTexture(gl, this.width, this.height);
        
        // Create framebuffers
        this.edgeFramebuffer = createFramebuffer(gl, this.edgeTexture);
        this.convolutionFramebuffer = createFramebuffer(gl, this.convolutionTexture);
        this.stateFramebuffer0 = createFramebuffer(gl, this.stateTexture0);
        this.stateFramebuffer1 = createFramebuffer(gl, this.stateTexture1);
        this.noiseFramebuffer0 = createFramebuffer(gl, this.noiseTexture0);
        this.noiseFramebuffer1 = createFramebuffer(gl, this.noiseTexture1);
        this.sectionFramebuffer = createFramebuffer(gl, this.sectionTexture);
        
        this.currentStateIndex = 0;
        this.currentNoiseIndex = 0;
        
        gl.viewport(0, 0, this.width, this.height);
        
        // Pre-compute edges
        this.computeEdges(0.6);
        this.computeSections();
        this.seedNoiseTextures();
    }
    
    computeEdges(detail) {
        const gl = this.gl;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeFramebuffer);
        gl.useProgram(this.edgeProgram);
        
        gl.uniform2f(gl.getUniformLocation(this.edgeProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_edgeDetail'), detail);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(gl.getUniformLocation(this.edgeProgram, 'u_texture'), 0);
        
        bindQuadAttributes(gl, this.edgeQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    computeSections(params = {}) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sectionFramebuffer);
        gl.useProgram(this.sectionProgram);

        gl.uniform2f(gl.getUniformLocation(this.sectionProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.sectionProgram, 'u_sectionScale'), params.sectionScale ?? 0.68);
        gl.uniform1f(gl.getUniformLocation(this.sectionProgram, 'u_sectionClosure'), params.sectionClosure ?? 0.72);
        gl.uniform1f(gl.getUniformLocation(this.sectionProgram, 'u_sectionStrictness'), params.sectionStrictness ?? 0.70);
        gl.uniform1f(gl.getUniformLocation(this.sectionProgram, 'u_microDetailInfluence'), params.microDetailInfluence ?? 0.22);
        gl.uniform1f(gl.getUniformLocation(this.sectionProgram, 'u_tileSize'), params.tileSize ?? 0.66);
        gl.uniform1f(gl.getUniformLocation(this.sectionProgram, 'u_edgeAdherence'), params.edgeAdherence ?? 0.45);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.edgeTexture);
        gl.uniform1i(gl.getUniformLocation(this.sectionProgram, 'u_edgeTexture'), 0);

        bindQuadAttributes(gl, this.sectionQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    reset() {
        const gl = this.gl;
        
        // Reset state to original
        gl.bindTexture(gl.TEXTURE_2D, this.stateTexture0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.originalImageData);
        
        this.currentStateIndex = 0;
        this.currentNoiseIndex = 0;
        this.frameCount = 0;
        this.seedNoiseTextures();
    }

    seedNoiseTextures() {
        const gl = this.gl;
        const size = this.width * this.height * 4;
        const data = new Uint8Array(size);
        for (let i = 0; i < size; i += 4) {
            data[i] = Math.floor(Math.random() * 256);
            data[i + 1] = Math.floor(Math.random() * 256);
            data[i + 2] = Math.floor(Math.random() * 256);
            data[i + 3] = 255;
        }
        gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }
    
    step(params) {
        const gl = this.gl;
        this.lastParams = params;
        this.frameCount++;
        
        const currentTexture = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        const nextFramebuffer = this.currentStateIndex === 0 ? this.stateFramebuffer1 : this.stateFramebuffer0;
        const currentNoiseTexture = this.currentNoiseIndex === 0 ? this.noiseTexture0 : this.noiseTexture1;
        const nextNoiseFramebuffer = this.currentNoiseIndex === 0 ? this.noiseFramebuffer1 : this.noiseFramebuffer0;
        
        // Recompute edges if controls are present
        if (params.edgeDetail !== undefined) {
            this.computeEdges(params.edgeDetail);
        }
        this.computeSections(params);
        
        // PASS 1: Convolution
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.convolutionFramebuffer);
        gl.useProgram(this.convolutionProgram);
        
        // Convert radius percentage to pixels
        const avgDimension = (this.width + this.height) / 2;
        const radiusPixels = params.radius * avgDimension;
        
        gl.uniform2f(gl.getUniformLocation(this.convolutionProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.convolutionProgram, 'u_radius'), radiusPixels);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(gl.getUniformLocation(this.convolutionProgram, 'u_texture'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.sectionTexture);
        gl.uniform1i(gl.getUniformLocation(this.convolutionProgram, 'u_edgeTexture'), 1);
        
        bindQuadAttributes(gl, this.convQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PASS 1.5: Structured noise evolution (edge-aware)
        gl.bindFramebuffer(gl.FRAMEBUFFER, nextNoiseFramebuffer);
        gl.useProgram(this.noiseProgram);
        gl.uniform2f(gl.getUniformLocation(this.noiseProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.noiseProgram, 'u_time'), this.frameCount * 0.1);
        gl.uniform1f(gl.getUniformLocation(this.noiseProgram, 'u_deltaTime'), params.deltaTime);
        gl.uniform1f(gl.getUniformLocation(this.noiseProgram, 'u_noiseScale'), params.noiseScale ?? 0.45);
        gl.uniform1f(gl.getUniformLocation(this.noiseProgram, 'u_noisePersistence'), params.noisePersistence ?? 0.65);
        gl.uniform1f(gl.getUniformLocation(this.noiseProgram, 'u_edgeConfinement'), params.edgeConfinement ?? 0.8);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentNoiseTexture);
        gl.uniform1i(gl.getUniformLocation(this.noiseProgram, 'u_prevNoise'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.sectionTexture);
        gl.uniform1i(gl.getUniformLocation(this.noiseProgram, 'u_edgeTexture'), 1);

        bindQuadAttributes(gl, this.noiseQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // PASS 2: Transition
        gl.bindFramebuffer(gl.FRAMEBUFFER, nextFramebuffer);
        gl.useProgram(this.transitionProgram);
        
        gl.uniform2f(gl.getUniformLocation(this.transitionProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_time'), this.frameCount * 0.1);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_chaos'), params.chaos);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_activity'), params.activity ?? 0.6);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_randomNoise'), params.randomNoise);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_edgePump'), params.edgePump ?? 0.2);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_imagePump'), params.imagePump ?? 0.08);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_structuredNoise'), params.structuredNoise ?? params.randomNoise ?? 0.0);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_mutation'), params.mutation ?? 0.15);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_paletteStability'), params.paletteStability ?? 0.72);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_sectionScale'), params.sectionScale ?? 0.68);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_tileSize'), params.tileSize ?? 0.66);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_edgeAdherence'), params.edgeAdherence ?? 0.45);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_sourceColorAdherence'), params.sourceColorAdherence ?? 0.35);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_deltaTime'), params.deltaTime);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(gl.getUniformLocation(this.transitionProgram, 'u_currentState'), 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.convolutionTexture);
        gl.uniform1i(gl.getUniformLocation(this.transitionProgram, 'u_convolution'), 1);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(gl.getUniformLocation(this.transitionProgram, 'u_originalImage'), 2);
        
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.sectionTexture);
        gl.uniform1i(gl.getUniformLocation(this.transitionProgram, 'u_edgeTexture'), 3);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, currentNoiseTexture);
        gl.uniform1i(gl.getUniformLocation(this.transitionProgram, 'u_structuredNoiseTexture'), 4);
        
        bindQuadAttributes(gl, this.transQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Swap buffers
        this.currentStateIndex = 1 - this.currentStateIndex;
        this.currentNoiseIndex = 1 - this.currentNoiseIndex;
    }
    
    render() {
        const gl = this.gl;
        const currentTexture = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        const displayTexture = this.lastParams && this.lastParams.showSections ? this.sectionTexture : currentTexture;
        
        // Render to canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.useProgram(this.displayProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, displayTexture);
        gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'u_texture'), 0);
        
        bindQuadAttributes(gl, this.displayQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    destroy() {
        const gl = this.gl;
        
        gl.deleteProgram(this.displayProgram);
        gl.deleteProgram(this.edgeProgram);
        gl.deleteProgram(this.convolutionProgram);
        gl.deleteProgram(this.transitionProgram);
        gl.deleteProgram(this.noiseProgram);
        gl.deleteProgram(this.sectionProgram);
        
        gl.deleteTexture(this.originalTexture);
        gl.deleteTexture(this.edgeTexture);
        gl.deleteTexture(this.stateTexture0);
        gl.deleteTexture(this.stateTexture1);
        gl.deleteTexture(this.convolutionTexture);
        gl.deleteTexture(this.noiseTexture0);
        gl.deleteTexture(this.noiseTexture1);
        gl.deleteTexture(this.sectionTexture);
        
        gl.deleteFramebuffer(this.edgeFramebuffer);
        gl.deleteFramebuffer(this.convolutionFramebuffer);
        gl.deleteFramebuffer(this.stateFramebuffer0);
        gl.deleteFramebuffer(this.stateFramebuffer1);
        gl.deleteFramebuffer(this.noiseFramebuffer0);
        gl.deleteFramebuffer(this.noiseFramebuffer1);
        gl.deleteFramebuffer(this.sectionFramebuffer);
    }
}
