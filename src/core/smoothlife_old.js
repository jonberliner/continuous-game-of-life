/**
 * Core SmoothLife engine with momentum and edge-guided constraints
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
        this.canvas = canvas;
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
        
        // Disable blending to prevent ghosting
        this.gl.disable(this.gl.BLEND);
        
        this.initWebGL();
        this.reset();
    }
    
    initWebGL() {
        const gl = this.gl;
        
        // Compile shaders and create programs
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
        this.displayQuad = setupQuadFlipped(gl, this.displayProgram);  // Display flipped
        this.edgeQuad = setupQuad(gl, this.edgeProgram);  // Compute normal
        this.convQuad = setupQuad(gl, this.convolutionProgram);
        this.transQuad = setupQuad(gl, this.transitionProgram);
        
        // Get uniform locations
        this.setupUniforms();
        
        // Display program uniforms
        this.displayUniforms = {
            texture: gl.getUniformLocation(this.displayProgram, 'u_texture')
        };
        
        // Create textures
        this.originalTexture = createTexture(gl, this.width, this.height, this.originalImageData);
        this.edgeTexture = createTexture(gl, this.width, this.height);
        this.patchStatsTexture = createTexture(gl, this.width, this.height);
        this.stateTexture0 = createTexture(gl, this.width, this.height, this.originalImageData);
        this.stateTexture1 = createTexture(gl, this.width, this.height);
        this.stateTexture2 = createTexture(gl, this.width, this.height); // Previous state for velocity
        this.velocityTexture0 = createTexture(gl, this.width, this.height);
        this.velocityTexture1 = createTexture(gl, this.width, this.height);
        this.convolutionTexture = createTexture(gl, this.width, this.height);
        
        // Create framebuffers
        this.edgeFramebuffer = createFramebuffer(gl, this.edgeTexture);
        this.patchStatsFramebuffer = createFramebuffer(gl, this.patchStatsTexture);
        this.convolutionFramebuffer = createFramebuffer(gl, this.convolutionTexture);
        this.stateFramebuffer0 = createFramebuffer(gl, this.stateTexture0);
        this.stateFramebuffer1 = createFramebuffer(gl, this.stateTexture1);
        this.stateFramebuffer2 = createFramebuffer(gl, this.stateTexture2);
        this.velocityFramebuffer0 = createFramebuffer(gl, this.velocityTexture0);
        this.velocityFramebuffer1 = createFramebuffer(gl, this.velocityTexture1);
        
        // Ping-pong state
        this.currentStateIndex = 0;
        this.currentVelocityIndex = 0;
        
        gl.viewport(0, 0, this.width, this.height);
        
        // Pre-compute edge detection and patch stats (once at start)
        this.computeEdges(0.3); // Default edge sensitivity
        this.computePatchStats(10); // Default patch radius
    }
    
    setupUniforms() {
        const gl = this.gl;
        
        // Edge detection uniforms
        this.edgeUniforms = {
            texture: gl.getUniformLocation(this.edgeProgram, 'u_texture'),
            resolution: gl.getUniformLocation(this.edgeProgram, 'u_resolution'),
            edgeSensitivity: gl.getUniformLocation(this.edgeProgram, 'u_edgeSensitivity')
        };
        
        // Patch stats uniforms
        this.patchUniforms = {
            originalImage: gl.getUniformLocation(this.patchProgram, 'u_originalImage'),
            edgeTexture: gl.getUniformLocation(this.patchProgram, 'u_edgeTexture'),
            resolution: gl.getUniformLocation(this.patchProgram, 'u_resolution'),
            patchRadius: gl.getUniformLocation(this.patchProgram, 'u_patchRadius')
        };
        
        // Convolution uniforms
        this.convUniforms = {
            texture: gl.getUniformLocation(this.convolutionProgram, 'u_texture'),
            resolution: gl.getUniformLocation(this.convolutionProgram, 'u_resolution'),
            innerRadius: gl.getUniformLocation(this.convolutionProgram, 'u_innerRadius'),
            outerRadius: gl.getUniformLocation(this.convolutionProgram, 'u_outerRadius')
        };
        
        // Transition uniforms - SIMPLIFIED
        this.transUniforms = {
            currentState: gl.getUniformLocation(this.transitionProgram, 'u_currentState'),
            convolution: gl.getUniformLocation(this.transitionProgram, 'u_convolution'),
            originalImage: gl.getUniformLocation(this.transitionProgram, 'u_originalImage'),
            edgeTexture: gl.getUniformLocation(this.transitionProgram, 'u_edgeTexture'),
            resolution: gl.getUniformLocation(this.transitionProgram, 'u_resolution'),
            time: gl.getUniformLocation(this.transitionProgram, 'u_time'),
            chaos: gl.getUniformLocation(this.transitionProgram, 'u_chaos'),
            randomNoise: gl.getUniformLocation(this.transitionProgram, 'u_randomNoise'),
            imageRestore: gl.getUniformLocation(this.transitionProgram, 'u_imageRestore'),
            edgeAnchor: gl.getUniformLocation(this.transitionProgram, 'u_edgeAnchor'),
            deltaTime: gl.getUniformLocation(this.transitionProgram, 'u_deltaTime')
        };
        
        // Velocity uniforms
        this.velUniforms = {
            currentState: gl.getUniformLocation(this.velocityProgram, 'u_currentState'),
            previousState: gl.getUniformLocation(this.velocityProgram, 'u_previousState'),
            velocity: gl.getUniformLocation(this.velocityProgram, 'u_velocity'),
            flow: gl.getUniformLocation(this.velocityProgram, 'u_flow'),
            deltaTime: gl.getUniformLocation(this.velocityProgram, 'u_deltaTime')
        };
    }
    
    computeEdges(edgeSensitivity) {
        const gl = this.gl;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeFramebuffer);
        gl.useProgram(this.edgeProgram);
        
        gl.uniform2f(this.edgeUniforms.resolution, this.width, this.height);
        gl.uniform1f(this.edgeUniforms.edgeSensitivity, edgeSensitivity);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(this.edgeUniforms.texture, 0);
        
        bindQuadAttributes(gl, this.edgeQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    computePatchStats(patchRadius) {
        const gl = this.gl;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.patchStatsFramebuffer);
        gl.useProgram(this.patchProgram);
        
        gl.uniform2f(this.patchUniforms.resolution, this.width, this.height);
        gl.uniform1f(this.patchUniforms.patchRadius, patchRadius);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(this.patchUniforms.originalImage, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.edgeTexture);
        gl.uniform1i(this.patchUniforms.edgeTexture, 1);
        
        bindQuadAttributes(gl, this.patchQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    reset() {
        const gl = this.gl;
        
        // Copy original image to current state
        gl.bindTexture(gl.TEXTURE_2D, this.stateTexture0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.originalImageData);
        
        gl.bindTexture(gl.TEXTURE_2D, this.stateTexture2);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.originalImageData);
        
        // Reset velocity
        const emptyData = new Uint8Array(this.width * this.height * 4);
        gl.bindTexture(gl.TEXTURE_2D, this.velocityTexture0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);
        
        this.currentStateIndex = 0;
        this.currentVelocityIndex = 0;
        this.frameCount = 0;
    }
    
    step(params) {
        const gl = this.gl;
        this.frameCount++;
        
        const currentTexture = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        const nextTexture = this.currentStateIndex === 0 ? this.stateTexture1 : this.stateTexture0;
        const nextFramebuffer = this.currentStateIndex === 0 ? this.stateFramebuffer1 : this.stateFramebuffer0;
        const previousTexture = this.stateTexture2;
        
        const currentVelTexture = this.currentVelocityIndex === 0 ? this.velocityTexture0 : this.velocityTexture1;
        const nextVelTexture = this.currentVelocityIndex === 0 ? this.velocityTexture1 : this.velocityTexture0;
        const nextVelFramebuffer = this.currentVelocityIndex === 0 ? this.velocityFramebuffer1 : this.velocityFramebuffer0;
        
        // Recompute edges if edge detail changed (could optimize to only when params.edgeDetail changes)
        if (params.edgeDetail !== undefined) {
            this.computeEdges(params.edgeDetail);
            this.computePatchStats(10); // Recompute patches too
        }
        
        // PASS 1: Convolution (compute inner and outer averages)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.convolutionFramebuffer);
        gl.useProgram(this.convolutionProgram);
        
        // Convert percentage (0-1) to actual pixels based on image size
        const avgDimension = (this.width + this.height) / 2;
        const innerRadiusPixels = params.innerRadius * avgDimension;
        const outerRadiusPixels = params.outerRadius * avgDimension;
        
        gl.uniform2f(this.convUniforms.resolution, this.width, this.height);
        gl.uniform1f(this.convUniforms.innerRadius, innerRadiusPixels);
        gl.uniform1f(this.convUniforms.outerRadius, outerRadiusPixels);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(this.convUniforms.texture, 0);
        
        bindQuadAttributes(gl, this.convQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // PASS 2: Transition (apply GoL rules) - SIMPLIFIED
        gl.bindFramebuffer(gl.FRAMEBUFFER, nextFramebuffer);
        gl.useProgram(this.transitionProgram);
        
        gl.uniform2f(this.transUniforms.resolution, this.width, this.height);
        gl.uniform1f(this.transUniforms.time, this.frameCount * 0.1);
        gl.uniform1f(this.transUniforms.chaos, params.chaos);
        gl.uniform1f(this.transUniforms.randomNoise, params.randomNoise);
        gl.uniform1f(this.transUniforms.imageRestore, params.imageRestore);
        gl.uniform1f(this.transUniforms.edgeAnchor, params.edgeAnchor);
        gl.uniform1f(this.transUniforms.deltaTime, params.deltaTime);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(this.transUniforms.currentState, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.convolutionTexture);
        gl.uniform1i(this.transUniforms.convolution, 1);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
        gl.uniform1i(this.transUniforms.originalImage, 2);
        
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.edgeTexture);
        gl.uniform1i(this.transUniforms.edgeTexture, 3);
        
        bindQuadAttributes(gl, this.transQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Unbind all textures before next pass to avoid feedback
        for (let i = 0; i < 6; i++) {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        
        // Swap buffers
        this.currentStateIndex = 1 - this.currentStateIndex;
    }
    
    render() {
        const gl = this.gl;
        const currentTexture = this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
        
        // Clear and render to canvas using simple display shader
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.useProgram(this.displayProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(this.displayUniforms.texture, 0);
        
        bindQuadAttributes(gl, this.displayQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    getCurrentState() {
        return this.currentStateIndex === 0 ? this.stateTexture0 : this.stateTexture1;
    }
    
    destroy() {
        const gl = this.gl;
        
        gl.deleteProgram(this.displayProgram);
        gl.deleteProgram(this.edgeProgram);
        gl.deleteProgram(this.patchProgram);
        gl.deleteProgram(this.convolutionProgram);
        gl.deleteProgram(this.transitionProgram);
        gl.deleteProgram(this.velocityProgram);
        
        gl.deleteTexture(this.originalTexture);
        gl.deleteTexture(this.edgeTexture);
        gl.deleteTexture(this.patchStatsTexture);
        gl.deleteTexture(this.stateTexture0);
        gl.deleteTexture(this.stateTexture1);
        gl.deleteTexture(this.stateTexture2);
        gl.deleteTexture(this.velocityTexture0);
        gl.deleteTexture(this.velocityTexture1);
        gl.deleteTexture(this.convolutionTexture);
        
        gl.deleteFramebuffer(this.edgeFramebuffer);
        gl.deleteFramebuffer(this.patchStatsFramebuffer);
        gl.deleteFramebuffer(this.convolutionFramebuffer);
        gl.deleteFramebuffer(this.stateFramebuffer0);
        gl.deleteFramebuffer(this.stateFramebuffer1);
        gl.deleteFramebuffer(this.stateFramebuffer2);
        gl.deleteFramebuffer(this.velocityFramebuffer0);
        gl.deleteFramebuffer(this.velocityFramebuffer1);
        
        // Delete buffers
        gl.deleteBuffer(this.displayQuad.positionBuffer);
        gl.deleteBuffer(this.displayQuad.texCoordBuffer);
        gl.deleteBuffer(this.edgeQuad.positionBuffer);
        gl.deleteBuffer(this.edgeQuad.texCoordBuffer);
        gl.deleteBuffer(this.patchQuad.positionBuffer);
        gl.deleteBuffer(this.patchQuad.texCoordBuffer);
        gl.deleteBuffer(this.convQuad.positionBuffer);
        gl.deleteBuffer(this.convQuad.texCoordBuffer);
        gl.deleteBuffer(this.transQuad.positionBuffer);
        gl.deleteBuffer(this.transQuad.texCoordBuffer);
        gl.deleteBuffer(this.velQuad.positionBuffer);
        gl.deleteBuffer(this.velQuad.texCoordBuffer);
    }
}
