/**
 * GPU-accelerated Frequency-domain Game of Life engine
 * Each RGB channel evolves at different spatial scales = frequency behavior
 */

import * as shaders from '../render/frequencyShaders.js';
import { 
    createShader, 
    createProgram, 
    createTexture, 
    createFramebuffer,
    setupQuad,
    bindQuadAttributes
} from '../render/webglUtils.js';

export class FrequencyGoLEngine {
    constructor(canvas, width, height, originalImageData, recreateCanvas = false) {
        this.width = width;
        this.height = height;
        this.originalImageData = originalImageData;
        this.frameCount = 0;
        
        // Only recreate canvas if explicitly told to
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
        const vertShader = createShader(gl, gl.VERTEX_SHADER, shaders.vertexShader);
        
        this.convolutionProgram = createProgram(gl, vertShader,
            createShader(gl, gl.FRAGMENT_SHADER, shaders.frequencyConvolutionShader));
        
        this.evolutionProgram = createProgram(gl, vertShader,
            createShader(gl, gl.FRAGMENT_SHADER, shaders.frequencyEvolutionShader));
        
        this.displayProgram = createProgram(gl, vertShader,
            createShader(gl, gl.FRAGMENT_SHADER, shaders.frequencyDisplayShader));
        
        // Create textures
        this.originalTexture = createTexture(gl, this.width, this.height, this.originalImageData);
        
        // State textures (ping-pong)
        this.stateTexture0 = createTexture(gl, this.width, this.height, this.originalImageData);
        this.stateTexture1 = createTexture(gl, this.width, this.height, null);
        
        // Convolution texture
        this.convolutionTexture = createTexture(gl, this.width, this.height, null);
        
        // Framebuffers
        this.stateFramebuffer0 = createFramebuffer(gl, this.stateTexture0);
        this.stateFramebuffer1 = createFramebuffer(gl, this.stateTexture1);
        this.convolutionFramebuffer = createFramebuffer(gl, this.convolutionTexture);
        
        // Setup quad geometry
        this.convQuad = setupQuad(gl, this.convolutionProgram);
        this.evolutionQuad = setupQuad(gl, this.evolutionProgram);
        this.displayQuad = setupQuad(gl, this.displayProgram);
        
        // Current state index (ping-pong)
        this.currentStateIndex = 0;
    }
    
    reset() {
        const gl = this.gl;
        
        // Reset state to original image
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.stateFramebuffer0);
        gl.useProgram(this.displayProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'u_texture'), 0);
        
        bindQuadAttributes(gl, this.displayQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        this.currentStateIndex = 0;
        this.frameCount = 0;
    }
    
    step(params) {
        const gl = this.gl;
        this.frameCount++;
        
        const currentTexture = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        const nextTexture = this.currentStateIndex === 0 ? this.stateTexture1 : this.stateTexture0;
        const nextFramebuffer = this.currentStateIndex === 0 ? this.stateFramebuffer1 : this.stateFramebuffer0;
        
        // PASS 1: Multi-scale convolution (different radius per channel)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.convolutionFramebuffer);
        gl.useProgram(this.convolutionProgram);
        
        const avgDimension = (this.width + this.height) / 2;
        const radiusPixels = params.radius * avgDimension;
        
        gl.uniform2f(gl.getUniformLocation(this.convolutionProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.convolutionProgram, 'u_radius'), radiusPixels);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(gl.getUniformLocation(this.convolutionProgram, 'u_texture'), 0);
        
        bindQuadAttributes(gl, this.convQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // PASS 2: Evolution
        gl.bindFramebuffer(gl.FRAMEBUFFER, nextFramebuffer);
        gl.useProgram(this.evolutionProgram);
        
        gl.uniform2f(gl.getUniformLocation(this.evolutionProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.evolutionProgram, 'u_time'), this.frameCount * 0.1);
        gl.uniform1f(gl.getUniformLocation(this.evolutionProgram, 'u_chaos'), params.chaos);
        gl.uniform1f(gl.getUniformLocation(this.evolutionProgram, 'u_activity'), params.activity ?? 0.6);
        gl.uniform1f(gl.getUniformLocation(this.evolutionProgram, 'u_randomNoise'), params.randomNoise);
        gl.uniform1f(gl.getUniformLocation(this.evolutionProgram, 'u_imageRestore'), params.imageRestore);
        gl.uniform1f(gl.getUniformLocation(this.evolutionProgram, 'u_edgeSensitivity'), params.edgeSensitivity);
        gl.uniform1f(gl.getUniformLocation(this.evolutionProgram, 'u_deltaTime'), params.deltaTime);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(gl.getUniformLocation(this.evolutionProgram, 'u_currentState'), 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.convolutionTexture);
        gl.uniform1i(gl.getUniformLocation(this.evolutionProgram, 'u_convolution'), 1);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(gl.getUniformLocation(this.evolutionProgram, 'u_originalImage'), 2);
        
        bindQuadAttributes(gl, this.evolutionQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Swap buffers
        this.currentStateIndex = 1 - this.currentStateIndex;
    }
    
    render() {
        const gl = this.gl;
        
        // Render to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(this.displayProgram);
        
        const currentTexture = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'u_texture'), 0);
        
        bindQuadAttributes(gl, this.displayQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    destroy() {
        const gl = this.gl;
        
        gl.deleteTexture(this.originalTexture);
        gl.deleteTexture(this.stateTexture0);
        gl.deleteTexture(this.stateTexture1);
        gl.deleteTexture(this.convolutionTexture);
        
        gl.deleteFramebuffer(this.stateFramebuffer0);
        gl.deleteFramebuffer(this.stateFramebuffer1);
        gl.deleteFramebuffer(this.convolutionFramebuffer);
        
        gl.deleteProgram(this.convolutionProgram);
        gl.deleteProgram(this.evolutionProgram);
        gl.deleteProgram(this.displayProgram);
    }
}
