/**
 * CLEAN REWRITE - Simple stable GoL engine
 */

import { 
    vertexShader,
    displayShader,
    edgeDetectionShader,
    convolutionShader, 
    transitionShader
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
        
        this.displayProgram = createProgram(gl, vs, displayFs);
        this.edgeProgram = createProgram(gl, vs, edgeFs);
        this.convolutionProgram = createProgram(gl, vs, convFs);
        this.transitionProgram = createProgram(gl, vs, transFs);
        
        // Setup geometry
        this.displayQuad = setupQuadFlipped(gl, this.displayProgram);
        this.edgeQuad = setupQuad(gl, this.edgeProgram);
        this.convQuad = setupQuad(gl, this.convolutionProgram);
        this.transQuad = setupQuad(gl, this.transitionProgram);
        
        // Create textures
        this.originalTexture = createTexture(gl, this.width, this.height, this.originalImageData);
        this.edgeTexture = createTexture(gl, this.width, this.height);
        this.stateTexture0 = createTexture(gl, this.width, this.height, this.originalImageData);
        this.stateTexture1 = createTexture(gl, this.width, this.height);
        this.convolutionTexture = createTexture(gl, this.width, this.height);
        
        // Create framebuffers
        this.edgeFramebuffer = createFramebuffer(gl, this.edgeTexture);
        this.convolutionFramebuffer = createFramebuffer(gl, this.convolutionTexture);
        this.stateFramebuffer0 = createFramebuffer(gl, this.stateTexture0);
        this.stateFramebuffer1 = createFramebuffer(gl, this.stateFramebuffer1);
        
        this.currentStateIndex = 0;
        
        gl.viewport(0, 0, this.width, this.height);
        
        // Pre-compute edges
        this.computeEdges(0.3);
    }
    
    computeEdges(sensitivity) {
        const gl = this.gl;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeFramebuffer);
        gl.useProgram(this.edgeProgram);
        
        gl.uniform2f(gl.getUniformLocation(this.edgeProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_edgeSensitivity'), sensitivity);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(gl.getUniformLocation(this.edgeProgram, 'u_texture'), 0);
        
        bindQuadAttributes(gl, this.edgeQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    reset() {
        const gl = this.gl;
        
        // Reset state to original
        gl.bindTexture(gl.TEXTURE_2D, this.stateTexture0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.originalImageData);
        
        this.currentStateIndex = 0;
        this.frameCount = 0;
    }
    
    step(params) {
        const gl = this.gl;
        this.frameCount++;
        
        const currentTexture = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        const nextTexture = this.currentStateIndex === 0 ? this.stateTexture1 : this.stateTexture0;
        const nextFramebuffer = this.currentStateIndex === 0 ? this.stateFramebuffer1 : this.stateFramebuffer0;
        
        // Recompute edges if sensitivity changed
        if (params.edgeSensitivity !== undefined) {
            this.computeEdges(params.edgeSensitivity);
        }
        
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
        
        bindQuadAttributes(gl, this.convQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // PASS 2: Transition
        gl.bindFramebuffer(gl.FRAMEBUFFER, nextFramebuffer);
        gl.useProgram(this.transitionProgram);
        
        gl.uniform2f(gl.getUniformLocation(this.transitionProgram, 'u_resolution'), this.width, this.height);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_time'), this.frameCount * 0.1);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_chaos'), params.chaos);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_randomNoise'), params.randomNoise);
        gl.uniform1f(gl.getUniformLocation(this.transitionProgram, 'u_imageRestore'), params.imageRestore);
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
        gl.bindTexture(gl.TEXTURE_2D, this.edgeTexture);
        gl.uniform1i(gl.getUniformLocation(this.transitionProgram, 'u_edgeTexture'), 3);
        
        bindQuadAttributes(gl, this.transQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Swap buffers
        this.currentStateIndex = 1 - this.currentStateIndex;
    }
    
    render() {
        const gl = this.gl;
        const currentTexture = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        
        // Render to canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.useProgram(this.displayProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
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
        
        gl.deleteTexture(this.originalTexture);
        gl.deleteTexture(this.edgeTexture);
        gl.deleteTexture(this.stateTexture0);
        gl.deleteTexture(this.stateTexture1);
        gl.deleteTexture(this.convolutionTexture);
        
        gl.deleteFramebuffer(this.edgeFramebuffer);
        gl.deleteFramebuffer(this.convolutionFramebuffer);
        gl.deleteFramebuffer(this.stateFramebuffer0);
        gl.deleteFramebuffer(this.stateFramebuffer1);
    }
}
