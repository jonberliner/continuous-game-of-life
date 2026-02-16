/**
 * Main application orchestration - supports Spatial and Frequency modes
 */

import { SmoothLifeEngine } from './core/smoothlife.js';
import { FrequencyGoLEngine } from './core/frequencyEngine.js';
import { loadImage, createDefaultImage } from './render/imageLoader.js';
import { ControlsManager } from './ui/controls.js';

class ContinuousGameOfLife {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.engine = null;
        this.mode = 'spatial'; // 'spatial' or 'frequency'
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        
        this.imageData = null;
        this.simAccumulator = 0;
        this.fixedSimulationDelta = 0.2; // Keep simulation dynamics stable; speed controls rate only.
        
        this.init();
    }
    
    async init() {
        // Create default image
        const defaultImg = createDefaultImage(512, 512);
        this.imageData = defaultImg;
        
        // Initialize canvas and engine
        this.setupCanvas();
        this.createEngine();
        
        // Setup controls
        this.controls = new ControlsManager(
            (params) => this.onParamChange(params),
            (file) => this.onImageUpload(file),
            () => this.togglePause(),
            () => this.reset(),
            (mode) => this.switchMode(mode)  // New: mode switcher
        );
        
        // Start animation
        this.start();
    }
    
    setupCanvas() {
        this.canvas.width = this.imageData.width;
        this.canvas.height = this.imageData.height;
    }
    
    createEngine() {
        if (this.engine) {
            this.engine.destroy();
        }
        
        if (this.mode === 'spatial') {
            this.engine = new SmoothLifeEngine(
                this.canvas,
                this.imageData.width,
                this.imageData.height,
                this.imageData.imageData,
                false // Don't recreate canvas
            );
        } else {
            this.engine = new FrequencyGoLEngine(
                this.canvas,
                this.imageData.width,
                this.imageData.height,
                this.imageData.imageData,
                false // Don't recreate canvas
            );
        }
    }
    
    switchMode(mode) {
        if (mode === this.mode) return;
        
        const wasRunning = this.isRunning;
        this.stop();
        
        this.mode = mode;
        
        // When switching modes, we DO need to recreate the canvas
        this.recreateCanvasForMode(mode);
        this.createEngine();
        
        // Re-fetch canvas reference
        this.canvas = document.getElementById('glCanvas');
        
        if (wasRunning) {
            this.start();
        } else {
            this.engine.render();
        }
    }
    
    recreateCanvasForMode(mode) {
        const parent = this.canvas.parentElement;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        if (!parent) {
            throw new Error('Canvas has no parent element');
        }
        
        // Remove old canvas
        this.canvas.remove();
        
        // Create new canvas
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'glCanvas';
        newCanvas.width = canvasWidth;
        newCanvas.height = canvasHeight;
        parent.appendChild(newCanvas);
        
        this.canvas = newCanvas;
    }
    
    async onImageUpload(file) {
        try {
            const wasRunning = this.isRunning;
            this.stop();
            
            const loadedImage = await loadImage(file);
            this.imageData = loadedImage;
            
            this.setupCanvas();
            this.createEngine();
            
            if (wasRunning) {
                this.start();
            } else {
                this.engine.render();
            }
        } catch (error) {
            console.error('Failed to load image:', error);
            alert('Failed to load image. Please try another file.');
        }
    }
    
    onParamChange(params) {
        // Parameters are used directly in the step function
        // No need to do anything here unless we want to validate
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        this.controls.updatePauseButton(this.isPaused);
    }
    
    reset() {
        const wasRunning = this.isRunning;
        this.stop();
        
        this.engine.reset();
        this.simAccumulator = 0;
        this.engine.render();
        
        if (wasRunning) {
            this.start();
        }
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.controls.updatePauseButton(false);
        this.animate();
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    animate() {
        if (!this.isRunning) return;
        
        if (!this.isPaused) {
            const params = this.controls.getParams();
            // Interpret slider as simulation rate, not simulation dt.
            // This keeps behavior stable while changing how fast time advances.
            const speedNorm = Math.max(0, Math.min(1, (params.deltaTime - 0.01) / 0.49));
            const simRate = 0.08 + speedNorm * 3.2; // ~0.08 to ~3.28 sim steps per frame
            this.simAccumulator += simRate;

            const stepParams = {
                ...params,
                deltaTime: this.fixedSimulationDelta
            };

            let steps = 0;
            const maxStepsPerFrame = 8;
            while (this.simAccumulator >= 1.0 && steps < maxStepsPerFrame) {
                this.engine.step(stepParams);
                this.simAccumulator -= 1.0;
                steps++;
            }

            this.engine.render();
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
}

// Initialize the application when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ContinuousGameOfLife();
    });
} else {
    new ContinuousGameOfLife();
}
