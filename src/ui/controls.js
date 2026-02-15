/**
 * UI Controls management
 */

export class ControlsManager {
    constructor(onParamChange, onImageUpload, onPause, onReset) {
        this.params = {
            mixToOriginal: 0,
            innerRadius: 3,
            outerRadius: 9,
            birth1: 0.278,
            birth2: 0.365,
            death1: 0.267,
            death2: 0.445,
            alphaM: 0.147,
            deltaTime: 0.1,
            restoration: 0.05
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
        const setupSlider = (id, paramName) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(`${id}Value`);
            
            if (!slider || !valueDisplay) {
                console.warn(`Control ${id} not found`);
                return;
            }
            
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.params[paramName] = value;
                valueDisplay.textContent = value.toFixed(3);
                this.callbacks.onParamChange(this.params);
            });
            
            // Set initial value
            slider.value = this.params[paramName];
            valueDisplay.textContent = this.params[paramName].toFixed(3);
        };
        
        // Setup all sliders
        setupSlider('mixToOriginal', 'mixToOriginal');
        setupSlider('innerRadius', 'innerRadius');
        setupSlider('outerRadius', 'outerRadius');
        setupSlider('birth1', 'birth1');
        setupSlider('birth2', 'birth2');
        setupSlider('death1', 'death1');
        setupSlider('death2', 'death2');
        setupSlider('alphaM', 'alphaM');
        setupSlider('deltaTime', 'deltaTime');
        setupSlider('restoration', 'restoration');
        
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
        const presets = {
            default: {
                mixToOriginal: 0,
                innerRadius: 3,
                outerRadius: 9,
                birth1: 0.278,
                birth2: 0.365,
                death1: 0.267,
                death2: 0.445,
                alphaM: 0.147,
                deltaTime: 0.1,
                restoration: 0.05
            },
            chaotic: {
                mixToOriginal: 0,
                innerRadius: 2,
                outerRadius: 12,
                birth1: 0.2,
                birth2: 0.4,
                death1: 0.15,
                death2: 0.5,
                alphaM: 0.2,
                deltaTime: 0.15,
                restoration: 0.03
            },
            stable: {
                mixToOriginal: 0,
                innerRadius: 4,
                outerRadius: 8,
                birth1: 0.3,
                birth2: 0.35,
                death1: 0.28,
                death2: 0.4,
                alphaM: 0.1,
                deltaTime: 0.08,
                restoration: 0.1
            },
            waves: {
                mixToOriginal: 0,
                innerRadius: 5,
                outerRadius: 15,
                birth1: 0.25,
                birth2: 0.38,
                death1: 0.22,
                death2: 0.42,
                alphaM: 0.18,
                deltaTime: 0.12,
                restoration: 0.07
            }
        };
        
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const presetName = btn.dataset.preset;
                const preset = presets[presetName];
                
                if (preset) {
                    this.applyPreset(preset);
                }
            });
        });
    }
    
    applyPreset(preset) {
        Object.assign(this.params, preset);
        
        // Update all sliders and displays
        for (const [key, value] of Object.entries(preset)) {
            const slider = document.getElementById(key);
            const valueDisplay = document.getElementById(`${key}Value`);
            
            if (slider) {
                slider.value = value;
            }
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(3);
            }
        }
        
        this.callbacks.onParamChange(this.params);
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
