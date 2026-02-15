/**
 * UI Controls management - Artist-friendly parameters
 */

export class ControlsManager {
    constructor(onParamChange, onImageUpload, onPause, onReset) {
        this.params = {
            // CLEAN SIMPLE PARAMETERS
            chaos: 0.3,              // How flippy
            radius: 0.02,            // 2% - single radius
            randomNoise: 0.1,        // Color noise
            imageRestore: 0.15,      // Memory of original
            edgeSensitivity: 0.3,    // Edge detection
            deltaTime: 0.1           // Speed
        };
        
        this.callbacks = {
            onParamChange,
            onImageUpload,
            onPause,
            onReset
        };
        
        this.initControls();
        this.initPresets();
    }
    
    initControls() {
        // Helper to setup a slider with value display
        const setupSlider = (id, paramName, isPercentage = false) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(`${id}Value`);
            
            if (!slider || !valueDisplay) {
                console.warn(`Control ${id} not found`);
                return;
            }
            
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.params[paramName] = value;
                
                // Format display based on whether it's a percentage
                if (isPercentage) {
                    valueDisplay.textContent = (value * 100).toFixed(1) + '%';
                } else {
                    valueDisplay.textContent = value.toFixed(2);
                }
                
                this.callbacks.onParamChange(this.params);
            });
            
            // Set initial value
            slider.value = this.params[paramName];
            if (isPercentage) {
                valueDisplay.textContent = (this.params[paramName] * 100).toFixed(1) + '%';
            } else {
                valueDisplay.textContent = this.params[paramName].toFixed(2);
            }
        };
        
        // Setup all sliders
        setupSlider('chaos', 'chaos');
        setupSlider('radius', 'radius', true);  // Display as percentage
        setupSlider('randomNoise', 'randomNoise');
        setupSlider('imageRestore', 'imageRestore');
        setupSlider('edgeSensitivity', 'edgeSensitivity');
        setupSlider('deltaTime', 'deltaTime');
        
        // Image upload
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) {
            imageUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.callbacks.onImageUpload(file);
                }
            });
        }
        
        // Pause button
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.callbacks.onPause();
            });
        }
        
        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.callbacks.onReset();
            });
        }
    }
    
    initPresets() {
        // Removed presets for simplicity - just have reset button
    }
    
    applyPreset(preset) {
        // Removed presets
    }
    
    updatePauseButton(isPaused) {
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) {
            pauseBtn.textContent = isPaused ? 'Play' : 'Pause';
        }
    }
    
    getParams() {
        return { ...this.params };
    }
}
