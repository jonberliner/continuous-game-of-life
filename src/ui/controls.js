/**
 * UI Controls management - Artist-friendly parameters
 */

export class ControlsManager {
    constructor(onParamChange, onImageUpload, onPause, onReset, onModeSwitch) {
        this.kernelWidthMin = 0.001;
        this.kernelWidthMax = 1.0;
        this.params = {
            // Requested core sliders
            edgeFineness: 0.62,
            edgePump: 0.22,
            edgeMerge: 0.72,
            // Slider position (0..1), mapped logarithmically to actual kernel width
            kernelWidth: 0.55,
            hazardRate: 0.20,
            paletteStability: 0.72,
            simSpeed: 0.32,
            energy: 0.62,
            // Additional essential control (explicit source-color coupling)
            sourceColorAdherence: 0.25,
            // Advanced
            microDetailInfluence: 0.22,
            noisePersistence: 0.82,
            boundaryLeakage: 0.18,
            showSections: false
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

    kernelWidthFromSlider(t) {
        const ratio = this.kernelWidthMax / this.kernelWidthMin;
        return this.kernelWidthMin * Math.pow(ratio, t);
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
                    if (id === 'kernelWidth') {
                        valueDisplay.textContent = (this.kernelWidthFromSlider(value) * 100).toFixed(1) + '%';
                    } else {
                        valueDisplay.textContent = (value * 100).toFixed(1) + '%';
                    }
                } else {
                    valueDisplay.textContent = value.toFixed(2);
                }
                
                this.callbacks.onParamChange(this.getParams());
            });
            
            // Set initial value
            slider.value = this.params[paramName];
            if (isPercentage) {
                if (id === 'kernelWidth') {
                    valueDisplay.textContent = (this.kernelWidthFromSlider(this.params[paramName]) * 100).toFixed(1) + '%';
                } else {
                    valueDisplay.textContent = (this.params[paramName] * 100).toFixed(1) + '%';
                }
            } else {
                valueDisplay.textContent = this.params[paramName].toFixed(2);
            }
        };
        
        // Core sliders
        setupSlider('edgeFineness', 'edgeFineness');
        setupSlider('edgePump', 'edgePump');
        setupSlider('edgeMerge', 'edgeMerge');
        setupSlider('kernelWidth', 'kernelWidth', true);
        setupSlider('hazardRate', 'hazardRate');
        setupSlider('paletteStability', 'paletteStability');
        setupSlider('simSpeed', 'simSpeed');
        setupSlider('energy', 'energy');
        setupSlider('sourceColorAdherence', 'sourceColorAdherence');
        // Advanced sliders
        setupSlider('microDetailInfluence', 'microDetailInfluence');
        setupSlider('noisePersistence', 'noisePersistence');
        setupSlider('boundaryLeakage', 'boundaryLeakage');

        const showSections = document.getElementById('showSections');
        if (showSections) {
            showSections.checked = this.params.showSections;
            showSections.addEventListener('change', (e) => {
                this.params.showSections = !!e.target.checked;
                this.callbacks.onParamChange(this.getParams());
            });
        }

        // Presets
        const presets = {
            presetOrganic: {
                edgeFineness: 0.56, edgePump: 0.22, edgeMerge: 0.64, kernelWidth: 0.666,
                hazardRate: 0.14, paletteStability: 0.78, simSpeed: 0.28, energy: 0.50, sourceColorAdherence: 0.40, boundaryLeakage: 0.14
            },
            presetRegional: {
                edgeFineness: 0.62, edgePump: 0.24, edgeMerge: 0.84, kernelWidth: 0.735,
                hazardRate: 0.16, paletteStability: 0.82, simSpeed: 0.30, energy: 0.60, sourceColorAdherence: 0.30, boundaryLeakage: 0.10
            },
            presetDreamy: {
                edgeFineness: 0.48, edgePump: 0.16, edgeMerge: 0.70, kernelWidth: 0.752,
                hazardRate: 0.26, paletteStability: 0.70, simSpeed: 0.24, energy: 0.42, sourceColorAdherence: 0.12, boundaryLeakage: 0.24
            },
            presetWild: {
                edgeFineness: 0.74, edgePump: 0.10, edgeMerge: 0.58, kernelWidth: 0.693,
                hazardRate: 0.72, paletteStability: 0.28, simSpeed: 0.36, energy: 0.88, sourceColorAdherence: 0.02, boundaryLeakage: 0.30
            },
            presetSourceMemory: {
                edgeFineness: 0.68, edgePump: 0.40, edgeMerge: 0.78, kernelWidth: 0.715,
                hazardRate: 0.10, paletteStability: 0.86, simSpeed: 0.30, energy: 0.48, sourceColorAdherence: 0.80, boundaryLeakage: 0.12
            }
        };

        const updateSliderUI = (id, value, isPercentage = false) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(`${id}Value`);
            if (!slider || !valueDisplay) return;
            slider.value = value;
            if (isPercentage && id === 'kernelWidth') {
                valueDisplay.textContent = `${(this.kernelWidthFromSlider(value) * 100).toFixed(1)}%`;
            } else {
                valueDisplay.textContent = isPercentage ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
            }
        };

        Object.keys(presets).forEach((presetId) => {
            const btn = document.getElementById(presetId);
            if (!btn) return;
            btn.addEventListener('click', () => {
                Object.assign(this.params, presets[presetId]);
                updateSliderUI('edgeFineness', this.params.edgeFineness);
                updateSliderUI('edgePump', this.params.edgePump);
                updateSliderUI('edgeMerge', this.params.edgeMerge);
                updateSliderUI('kernelWidth', this.params.kernelWidth, true);
                updateSliderUI('hazardRate', this.params.hazardRate);
                updateSliderUI('paletteStability', this.params.paletteStability);
                updateSliderUI('simSpeed', this.params.simSpeed);
                updateSliderUI('energy', this.params.energy);
                updateSliderUI('sourceColorAdherence', this.params.sourceColorAdherence);
                updateSliderUI('microDetailInfluence', this.params.microDetailInfluence);
                updateSliderUI('noisePersistence', this.params.noisePersistence);
                updateSliderUI('boundaryLeakage', this.params.boundaryLeakage);
                const showSectionsCb = document.getElementById('showSections');
                if (showSectionsCb) showSectionsCb.checked = !!this.params.showSections;
                this.callbacks.onParamChange(this.getParams());
            });
        });
        
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
        const energy = this.params.energy;
        const edgeMerge = this.params.edgeMerge;
        const sourceColorAdherence = this.params.sourceColorAdherence;

        // Formalized macro mapping
        const activity = Math.min(1.0, 0.08 + energy * 0.92);
        const chaos = Math.min(1.0, 0.04 + energy * 0.96);
        const deltaTime = this.params.simSpeed; // speed only, interpreted in main loop as rate
        const radius = this.kernelWidthFromSlider(this.params.kernelWidth); // logarithmic kernel width (% image)

        const sectionStrictness = Math.min(1.0, 0.20 + edgeMerge * 0.80);
        const sectionClosure = Math.min(1.0, 0.15 + edgeMerge * 0.85);
        const edgeConfinementBase = Math.min(1.0, 0.20 + edgeMerge * 0.80);
        const edgeConfinement = Math.max(0.0, edgeConfinementBase * (1.0 - this.params.boundaryLeakage));
        const sectionScale = Math.min(1.0, 0.25 + edgeMerge * 0.75);
        const tileSize = Math.min(1.0, 0.20 + edgeMerge * 0.80);
        const edgeAdherence = 1.0; // always prefer natural edges now
        const microDetailInfluence = Math.max(0.0, this.params.microDetailInfluence * (1.0 - edgeMerge) * 0.6);

        const structuredNoise = this.params.hazardRate;
        const mutation = this.params.hazardRate;
        const noiseScale = 0.45 + this.params.hazardRate * 0.45;
        const noisePersistence = Math.max(0.0, Math.min(1.0, this.params.paletteStability - this.params.hazardRate * 0.25));

        const imagePump = 0.0; // source pull handled by sourceColorAdherence + explicit pump controls
        const edgePump = this.params.edgePump;

        return {
            activity,
            chaos,
            deltaTime,
            radius,
            structuredNoise,
            randomNoise: structuredNoise,
            noiseScale,
            noisePersistence,
            mutation,
            imagePump,
            imageRestore: imagePump,
            edgeDetail: this.params.edgeFineness,
            edgeSensitivity: this.params.edgeFineness,
            edgePump,
            edgeConfinement,
            sectionScale,
            tileSize,
            edgeAdherence,
            sectionClosure,
            sectionStrictness,
            microDetailInfluence,
            sourceColorAdherence,
            hazardRate: this.params.hazardRate,
            paletteStability: this.params.paletteStability,
            boundaryLeakage: this.params.boundaryLeakage,
            showSections: this.params.showSections
        };
    }
}
