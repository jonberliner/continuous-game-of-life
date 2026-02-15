/**
 * Main application orchestration
 */

import { SmoothLifeEngine } from './core/smoothlife.js';
import { loadImage, createDefaultImage } from './render/imageLoader.js';
import { ControlsManager } from './ui/controls.js';

class ContinuousGameOfLife {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.engine = null;
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        
        this.imageData = null;
        
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
            () => this.reset()
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
        
        this.engine = new SmoothLifeEngine(
            this.canvas,
            this.imageData.width,
            this.imageData.height,
            this.imageData.imageData
        );
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
            this.engine.step(params);
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
