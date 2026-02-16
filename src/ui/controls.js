/**
 * UI Controls management - Artist-friendly parameters
 */

export class ControlsManager {
    constructor(onParamChange, onImageUpload, onPause, onReset, onModeSwitch) {
        this.params = {
            // Core artist-friendly controls
            energy: 0.62,
            patternSize: 0.48,
            sectionStrength: 0.70,
            tileGranularity: 0.58,
            naturalEdgeAdherence: 0.82,
            fineEdgeMerge: 0.62,
            colorNovelty: 0.42,
            sourceColorAdherence: 0.28,
            memory: 0.18,
            // Advanced (optional)
            edgeDetail: 0.60,
            microDetailInfluence: 0.22,
            noisePersistence: 0.82
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
                
                this.callbacks.onParamChange(this.getParams());
            });
            
            // Set initial value
            slider.value = this.params[paramName];
            if (isPercentage) {
                valueDisplay.textContent = (this.params[paramName] * 100).toFixed(1) + '%';
            } else {
                valueDisplay.textContent = this.params[paramName].toFixed(2);
            }
        };
        
        // Core sliders
        setupSlider('energy', 'energy');
        setupSlider('patternSize', 'patternSize');
        setupSlider('sectionStrength', 'sectionStrength');
        setupSlider('tileGranularity', 'tileGranularity');
        setupSlider('naturalEdgeAdherence', 'naturalEdgeAdherence');
        setupSlider('fineEdgeMerge', 'fineEdgeMerge');
        setupSlider('colorNovelty', 'colorNovelty');
        setupSlider('sourceColorAdherence', 'sourceColorAdherence');
        setupSlider('memory', 'memory');
        // Advanced sliders
        setupSlider('edgeDetail', 'edgeDetail');
        setupSlider('microDetailInfluence', 'microDetailInfluence');
        setupSlider('noisePersistence', 'noisePersistence');

        // Presets
        const presets = {
            presetOrganic: {
                energy: 0.52, patternSize: 0.42, sectionStrength: 0.58,
                tileGranularity: 0.54, naturalEdgeAdherence: 0.70, fineEdgeMerge: 0.58, colorNovelty: 0.28, sourceColorAdherence: 0.42, memory: 0.24
            },
            presetRegional: {
                energy: 0.60, patternSize: 0.60, sectionStrength: 0.82,
                tileGranularity: 0.72, naturalEdgeAdherence: 0.62, fineEdgeMerge: 0.74, colorNovelty: 0.34, sourceColorAdherence: 0.36, memory: 0.22
            },
            presetDreamy: {
                energy: 0.40, patternSize: 0.68, sectionStrength: 0.52,
                tileGranularity: 0.64, naturalEdgeAdherence: 0.30, fineEdgeMerge: 0.68, colorNovelty: 0.62, sourceColorAdherence: 0.14, memory: 0.12
            },
            presetWild: {
                energy: 0.86, patternSize: 0.50, sectionStrength: 0.68,
                tileGranularity: 0.86, naturalEdgeAdherence: 0.18, fineEdgeMerge: 0.84, colorNovelty: 0.88, sourceColorAdherence: 0.06, memory: 0.08
            },
            presetSourceMemory: {
                energy: 0.48, patternSize: 0.52, sectionStrength: 0.74,
                tileGranularity: 0.58, naturalEdgeAdherence: 0.88, fineEdgeMerge: 0.66, colorNovelty: 0.18, sourceColorAdherence: 0.72, memory: 0.58
            }
        };

        const updateSliderUI = (id, value, isPercentage = false) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(`${id}Value`);
            if (!slider || !valueDisplay) return;
            slider.value = value;
            valueDisplay.textContent = isPercentage ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
        };

        Object.keys(presets).forEach((presetId) => {
            const btn = document.getElementById(presetId);
            if (!btn) return;
            btn.addEventListener('click', () => {
                Object.assign(this.params, presets[presetId]);
                updateSliderUI('energy', this.params.energy);
                updateSliderUI('patternSize', this.params.patternSize);
                updateSliderUI('sectionStrength', this.params.sectionStrength);
                updateSliderUI('tileGranularity', this.params.tileGranularity);
                updateSliderUI('naturalEdgeAdherence', this.params.naturalEdgeAdherence);
                updateSliderUI('fineEdgeMerge', this.params.fineEdgeMerge);
                updateSliderUI('colorNovelty', this.params.colorNovelty);
                updateSliderUI('sourceColorAdherence', this.params.sourceColorAdherence);
                updateSliderUI('memory', this.params.memory);
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
        const e = this.params.energy;
        const size = this.params.patternSize;
        const sectionStrength = this.params.sectionStrength;
        const tileGranularity = this.params.tileGranularity;
        const naturalEdgeAdherence = this.params.naturalEdgeAdherence;
        const fineEdgeMerge = this.params.fineEdgeMerge;
        const novelty = this.params.colorNovelty;
        const sourceColorAdherence = this.params.sourceColorAdherence;
        const memory = this.params.memory;

        // Core mapping: simple user controls -> rich internal behavior
        const activity = Math.min(1.0, 0.12 + e * 0.95);
        const chaos = Math.min(1.0, 0.06 + e * e * 0.94);
        const deltaTime = 0.01 + e * 0.49; // used as speed/rate in main loop
        const radius = 0.01 + size * 0.45;

        const sectionStrictness = Math.min(1.0, 0.20 + sectionStrength * 0.80);
        const sectionClosure = Math.min(1.0, 0.18 + sectionStrength * 0.58 + fineEdgeMerge * 0.40);
        const edgeConfinement = Math.min(1.0, 0.15 + sectionStrength * 0.85);
        const sectionScale = tileGranularity;
        const tileSize = Math.min(1.0, tileGranularity * 0.65 + fineEdgeMerge * 0.55);
        const edgeAdherence = naturalEdgeAdherence;
        const microDetailInfluence = this.params.microDetailInfluence * (1.0 - fineEdgeMerge * 0.9) * (1.0 - tileGranularity * 0.35);

        const structuredNoise = novelty;
        const mutation = Math.min(1.0, 0.03 + novelty * 0.92);
        const noiseScale = 0.35 + novelty * 0.55;
        const noisePersistence = Math.min(1.0, Math.max(0.0, this.params.noisePersistence - novelty * 0.10));

        const imagePump = Math.min(1.0, Math.pow(memory, 1.2) * (0.2 + 0.8 * sourceColorAdherence));
        const edgePump = Math.min(1.0, (memory * 0.48 + sectionStrength * 0.10) * (0.15 + 0.85 * sourceColorAdherence));

        return {
            // Expose mapped internal parameters for both engines.
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
            edgeDetail: this.params.edgeDetail,
            edgeSensitivity: this.params.edgeDetail,
            edgePump,
            edgeConfinement,
            sectionScale,
            tileSize,
            edgeAdherence,
            sectionClosure,
            sectionStrictness,
            microDetailInfluence,
            sourceColorAdherence
        };
    }
}
