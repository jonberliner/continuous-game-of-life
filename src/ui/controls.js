/**
 * UI Controls management - Artist-friendly parameters
 */

export class ControlsManager {
    constructor(onParamChange, onImageUpload, onPause, onReset, onModeSwitch) {
        this.params = {
            // CLEAN SIMPLE PARAMETERS
            energy: 0.64,            // Combined motion + disorder
            radius: 0.10,            // 10% - larger evolving structures
            structuredNoise: 0.10,   // Pocket-structured texture amount
            noiseScale: 0.72,        // Fine to coarse noise features
            noisePersistence: 0.82,  // Identity persistence of pocket texture
            imagePump: 0.06,         // Global source pumping
            edgeDetail: 0.60,        // Fine vs coarse edge map
            edgePump: 0.18,          // Edge re-injection strength
            edgeConfinement: 0.88,   // Noise leakage across edges
            deltaTime: 0.32          // Speed
        };
        
        this.callbacks = {
            onParamChange,
            onImageUpload,
            onPause,
            onReset,
            onModeSwitch
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
        setupSlider('energy', 'energy');
        setupSlider('radius', 'radius', true);  // Display as percentage
        setupSlider('structuredNoise', 'structuredNoise');
        setupSlider('noiseScale', 'noiseScale');
        setupSlider('noisePersistence', 'noisePersistence');
        setupSlider('imagePump', 'imagePump');
        setupSlider('edgeDetail', 'edgeDetail');
        setupSlider('edgePump', 'edgePump');
        setupSlider('edgeConfinement', 'edgeConfinement');
        setupSlider('deltaTime', 'deltaTime');
        
        // Mode switcher
        const spatialBtn = document.getElementById('spatialMode');
        const frequencyBtn = document.getElementById('frequencyMode');
        
        if (spatialBtn && frequencyBtn) {
            spatialBtn.addEventListener('click', () => {
                spatialBtn.classList.add('active');
                frequencyBtn.classList.remove('active');
                this.callbacks.onModeSwitch('spatial');
            });
            
            frequencyBtn.addEventListener('click', () => {
                frequencyBtn.classList.add('active');
                spatialBtn.classList.remove('active');
                this.callbacks.onModeSwitch('frequency');
            });
        }
        
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
        const e = this.params.energy;
        // One intuitive control under the hood:
        // activity governs speed, chaos governs rule disorder.
        const activity = Math.min(1.0, 0.08 + e * 1.05);
        const chaos = Math.min(1.0, e * e);

        // Keep compatibility for frequency mode until its UI is split.
        return {
            ...this.params,
            activity,
            chaos,
            randomNoise: this.params.structuredNoise,
            imageRestore: this.params.imagePump,
            edgeSensitivity: this.params.edgeDetail
        };
    }
}
