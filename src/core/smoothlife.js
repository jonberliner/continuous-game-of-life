/**
 * Core SmoothLife engine using WebGL for computation
 */

import { vertexShader, convolutionShader, transitionShader } from '../render/shaders.js';
import { 
    createShader, 
    createProgram, 
    createTexture, 
    createFramebuffer,
    setupQuad,
    bindQuadAttributes 
} from '../render/webglUtils.js';

export class SmoothLifeEngine {
    constructor(canvas, width, height, originalImageData) {
        this.canvas = canvas;
        this.width = width;
        this.height = height;
        this.originalImageData = originalImageData;
        
        this.gl = canvas.getContext('webgl', {
            preserveDrawingBuffer: true,
            premultipliedAlpha: false
        });
        
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
        
        this.initWebGL();
        this.reset();
    }
    
    initWebGL() {
        const gl = this.gl;
        
        // Compile shaders and create programs
        const vs = createShader(gl, gl.VERTEX_SHADER, vertexShader);
        const convFs = createShader(gl, gl.FRAGMENT_SHADER, convolutionShader);
        const transFs = createShader(gl, gl.FRAGMENT_SHADER, transitionShader);
        
        this.convolutionProgram = createProgram(gl, vs, convFs);
        this.transitionProgram = createProgram(gl, vs, transFs);
        
        // Setup geometry for both programs
        this.convQuad = setupQuad(gl, this.convolutionProgram);
        this.transQuad = setupQuad(gl, this.transitionProgram);
        
        // Get uniform locations for convolution program
        this.convUniforms = {
            texture: gl.getUniformLocation(this.convolutionProgram, 'u_texture'),
            resolution: gl.getUniformLocation(this.convolutionProgram, 'u_resolution'),
            innerRadius: gl.getUniformLocation(this.convolutionProgram, 'u_innerRadius'),
            outerRadius: gl.getUniformLocation(this.convolutionProgram, 'u_outerRadius')
        };
        
        // Get uniform locations for transition program
        this.transUniforms = {
            currentState: gl.getUniformLocation(this.transitionProgram, 'u_currentState'),
            convolution: gl.getUniformLocation(this.transitionProgram, 'u_convolution'),
            originalImage: gl.getUniformLocation(this.transitionProgram, 'u_originalImage'),
            resolution: gl.getUniformLocation(this.transitionProgram, 'u_resolution'),
            birth1: gl.getUniformLocation(this.transitionProgram, 'u_birth1'),
            birth2: gl.getUniformLocation(this.transitionProgram, 'u_birth2'),
            death1: gl.getUniformLocation(this.transitionProgram, 'u_death1'),
            death2: gl.getUniformLocation(this.transitionProgram, 'u_death2'),
            alphaM: gl.getUniformLocation(this.transitionProgram, 'u_alphaM'),
            alphaN: gl.getUniformLocation(this.transitionProgram, 'u_alphaN'),
            deltaTime: gl.getUniformLocation(this.transitionProgram, 'u_deltaTime'),
            restoration: gl.getUniformLocation(this.transitionProgram, 'u_restoration'),
            mixToOriginal: gl.getUniformLocation(this.transitionProgram, 'u_mixToOriginal')
        };
        
        // Create textures
        this.originalTexture = createTexture(gl, this.width, this.height, this.originalImageData);
        this.stateTexture0 = createTexture(gl, this.width, this.height, this.originalImageData);
        this.stateTexture1 = createTexture(gl, this.width, this.height);
        this.convolutionTexture = createTexture(gl, this.width, this.height);
        
        // Create framebuffers
        this.convolutionFramebuffer = createFramebuffer(gl, this.convolutionTexture);
        this.stateFramebuffer0 = createFramebuffer(gl, this.stateTexture0);
        this.stateFramebuffer1 = createFramebuffer(gl, this.stateTexture1);
        
        // Ping-pong state
        this.currentStateIndex = 0;
        
        gl.viewport(0, 0, this.width, this.height);
    }
    
    reset() {
        const gl = this.gl;
        
        // Copy original image to current state
        gl.bindTexture(gl.TEXTURE_2D, this.stateTexture0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.originalImageData);
        
        this.currentStateIndex = 0;
    }
    
    step(params) {
        const gl = this.gl;
        
        const currentTexture = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        const currentFramebuffer = this.currentStateIndex === 0 ? this.stateFramebuffer0 : this.stateFramebuffer1;
        const nextTexture = this.currentStateIndex === 0 ? this.stateTexture1 : this.stateTexture0;
        const nextFramebuffer = this.currentStateIndex === 0 ? this.stateFramebuffer1 : this.stateFramebuffer0;
        
        // PASS 1: Convolution (compute inner and outer averages)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.convolutionFramebuffer);
        gl.useProgram(this.convolutionProgram);
        
        gl.uniform2f(this.convUniforms.resolution, this.width, this.height);
        gl.uniform1f(this.convUniforms.innerRadius, params.innerRadius);
        gl.uniform1f(this.convUniforms.outerRadius, params.outerRadius);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(this.convUniforms.texture, 0);
        
        bindQuadAttributes(gl, this.convQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // PASS 2: Transition (apply SmoothLife rules)
        gl.bindFramebuffer(gl.FRAMEBUFFER, nextFramebuffer);
        gl.useProgram(this.transitionProgram);
        
        gl.uniform2f(this.transUniforms.resolution, this.width, this.height);
        gl.uniform1f(this.transUniforms.birth1, params.birth1);
        gl.uniform1f(this.transUniforms.birth2, params.birth2);
        gl.uniform1f(this.transUniforms.death1, params.death1);
        gl.uniform1f(this.transUniforms.death2, params.death2);
        gl.uniform1f(this.transUniforms.alphaM, params.alphaM);
        gl.uniform1f(this.transUniforms.alphaN, params.alphaM); // Using same alpha for both
        gl.uniform1f(this.transUniforms.deltaTime, params.deltaTime);
        gl.uniform1f(this.transUniforms.restoration, params.restoration);
        gl.uniform1f(this.transUniforms.mixToOriginal, params.mixToOriginal);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(this.transUniforms.currentState, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.convolutionTexture);
        gl.uniform1i(this.transUniforms.convolution, 1);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(this.transUniforms.originalImage, 2);
        
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
        gl.useProgram(this.transitionProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        
        bindQuadAttributes(gl, this.transQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    getCurrentState() {
        return this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
    }
    
    destroy() {
        const gl = this.gl;
        
        gl.deleteProgram(this.convolutionProgram);
        gl.deleteProgram(this.transitionProgram);
        
        gl.deleteTexture(this.originalTexture);
        gl.deleteTexture(this.stateTexture0);
        gl.deleteTexture(this.stateTexture1);
        gl.deleteTexture(this.convolutionTexture);
        
        gl.deleteFramebuffer(this.convolutionFramebuffer);
        gl.deleteFramebuffer(this.stateFramebuffer0);
        gl.deleteFramebuffer(this.stateFramebuffer1);
        
        gl.deleteBuffer(this.convQuad.positionBuffer);
        gl.deleteBuffer(this.convQuad.texCoordBuffer);
        gl.deleteBuffer(this.transQuad.positionBuffer);
        gl.deleteBuffer(this.transQuad.texCoordBuffer);
    }
}
