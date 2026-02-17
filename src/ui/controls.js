/**
 * UI Controls management - Artist-friendly parameters
 */

import { TUNABLE_PARAMS } from './tunableParams.js';

export class ControlsManager {
    constructor(onParamChange, onImageUpload, onPause, onReset, onModeSwitch) {
        this.kernelWidthMin = 0.001;
        this.kernelWidthMax = 1.0;
        this.params = {
            // Core sliders
            boundarySimplification: 0.35,
            boundaryStrength: 0.70,
            kernelWidth: 0.55,
            hazardRate: 0.20,
            simSpeed: 0.65,
            energy: 0.62,
            sourceColorAdherence: 0.25,
            colorFeedback: 0.50,
            colorInertia: 0.30,
            sourceDrift: 0.00,
            showSections: false
        };

        // Populate defaults from tunable params definitions
        for (const p of TUNABLE_PARAMS) {
            if (!(p.key in this.params)) {
                this.params[p.key] = p.default;
            }
        }
        
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
        
        // Core sliders (Color Flow and Palette Stability removed from main UI)
        setupSlider('boundarySimplification', 'boundarySimplification');
        setupSlider('boundaryStrength', 'boundaryStrength');
        setupSlider('kernelWidth', 'kernelWidth', true);
        setupSlider('hazardRate', 'hazardRate');
        setupSlider('simSpeed', 'simSpeed');
        setupSlider('energy', 'energy');
        setupSlider('sourceColorAdherence', 'sourceColorAdherence');
        setupSlider('colorFeedback', 'colorFeedback');
        setupSlider('colorInertia', 'colorInertia');
        setupSlider('sourceDrift', 'sourceDrift');

        const showSections = document.getElementById('showSections');
        if (showSections) {
            showSections.checked = this.params.showSections;
            showSections.addEventListener('change', (e) => {
                this.params.showSections = !!e.target.checked;
                this.callbacks.onParamChange(this.getParams());
            });
        }

        // Generate all tunable parameter sliders in the advanced section
        this.generateTunableUI();

        // Configurations: save/load/export/import
        this.initConfigurationUI();

        // Presets
        const presets = {
            presetOrganic: {
                boundarySimplification: 0.30, boundaryStrength: 0.72, kernelWidth: 0.666,
                hazardRate: 0.14, simSpeed: 0.60, energy: 0.50, colorFeedback: 0.45,
                colorInertia: 0.35, sourceDrift: 0.15,
                sourceColorAdherence: 0.40, patternCoupling: 0.68, paletteStability: 0.78
            },
            presetRegional: {
                boundarySimplification: 0.50, boundaryStrength: 0.82, kernelWidth: 0.735,
                hazardRate: 0.16, simSpeed: 0.63, energy: 0.60, colorFeedback: 0.55,
                colorInertia: 0.25, sourceDrift: 0.10,
                sourceColorAdherence: 0.30, patternCoupling: 0.78, paletteStability: 0.82
            },
            presetDreamy: {
                boundarySimplification: 0.26, boundaryStrength: 0.50, kernelWidth: 0.752,
                hazardRate: 0.26, simSpeed: 0.55, energy: 0.42, colorFeedback: 0.60,
                colorInertia: 0.45, sourceDrift: 0.30,
                sourceColorAdherence: 0.12, patternCoupling: 0.56, paletteStability: 0.70
            },
            presetWild: {
                boundarySimplification: 0.80, boundaryStrength: 0.25, kernelWidth: 0.693,
                hazardRate: 0.72, simSpeed: 0.72, energy: 0.88, colorFeedback: 0.70,
                colorInertia: 0.10, sourceDrift: 0.50,
                sourceColorAdherence: 0.02, patternCoupling: 0.92, paletteStability: 0.28
            },
            presetSourceMemory: {
                boundarySimplification: 0.40, boundaryStrength: 0.85, kernelWidth: 0.715,
                hazardRate: 0.10, simSpeed: 0.63, energy: 0.48, colorFeedback: 0.50,
                colorInertia: 0.40, sourceDrift: 0.05,
                sourceColorAdherence: 0.80, patternCoupling: 0.46, paletteStability: 0.86
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
                // Update core sliders
                updateSliderUI('boundarySimplification', this.params.boundarySimplification);
                updateSliderUI('boundaryStrength', this.params.boundaryStrength);
                updateSliderUI('kernelWidth', this.params.kernelWidth, true);
                updateSliderUI('hazardRate', this.params.hazardRate);
                updateSliderUI('simSpeed', this.params.simSpeed);
                updateSliderUI('energy', this.params.energy);
                updateSliderUI('sourceColorAdherence', this.params.sourceColorAdherence);
                updateSliderUI('colorFeedback', this.params.colorFeedback);
                updateSliderUI('colorInertia', this.params.colorInertia);
                updateSliderUI('sourceDrift', this.params.sourceDrift);
                // Also update the advanced sliders that presets touch
                this.updateTunableSlider('patternCoupling', this.params.patternCoupling);
                this.updateTunableSlider('paletteStability', this.params.paletteStability);
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

    /** Dynamically generate slider UI for all tunable params, grouped by category */
    generateTunableUI() {
        const container = document.getElementById('ruleParamsContainer');
        if (!container) return;

        // Group params by group name (preserving insertion order)
        const groups = new Map();
        for (const p of TUNABLE_PARAMS) {
            if (!groups.has(p.group)) groups.set(p.group, []);
            groups.get(p.group).push(p);
        }

        for (const [groupName, params] of groups) {
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = groupName;
            details.appendChild(summary);

            for (const p of params) {
                const label = document.createElement('label');
                label.title = p.hint;

                const nameText = document.createTextNode(`${p.label}: `);
                label.appendChild(nameText);

                const span = document.createElement('span');
                span.id = `${p.key}Value`;
                span.textContent = this.formatParamValue(p.key, this.params[p.key]);
                label.appendChild(span);

                const input = document.createElement('input');
                input.type = 'range';
                input.id = p.key;
                input.min = p.min;
                input.max = p.max;
                input.value = this.params[p.key];
                input.step = p.step;
                label.appendChild(input);

                const hint = document.createElement('small');
                hint.className = 'hint';
                hint.textContent = p.hint;

                details.appendChild(label);
                details.appendChild(hint);

                // Wire up event
                input.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    this.params[p.key] = value;
                    span.textContent = this.formatParamValue(p.key, value);
                    this.callbacks.onParamChange(this.getParams());
                });
            }

            container.appendChild(details);
        }
    }

    /** Format a tunable param value for display */
    formatParamValue(key, value) {
        if (value === undefined || value === null) return '?';
        // Use enough precision to distinguish step sizes
        if (Math.abs(value) < 0.01 && value !== 0) return value.toFixed(4);
        if (Math.abs(value) < 1) return value.toFixed(3);
        return value.toFixed(2);
    }

    /** Update a generated tunable slider's UI (used by presets) */
    updateTunableSlider(key, value) {
        const slider = document.getElementById(key);
        const display = document.getElementById(`${key}Value`);
        if (slider) slider.value = value;
        if (display) display.textContent = this.formatParamValue(key, value);
    }
    
    initPresets() {}
    
    applyPreset(preset) {}

    // ================================================================
    //  CONFIGURATION: Save / Load / Export / Import
    // ================================================================

    static STORAGE_KEY = 'smoothlife_saved_configs';

    initConfigurationUI() {
        // Save button
        const saveBtn = document.getElementById('saveConfigBtn');
        const nameInput = document.getElementById('configName');
        if (saveBtn && nameInput) {
            saveBtn.addEventListener('click', () => {
                const name = nameInput.value.trim();
                if (!name) {
                    nameInput.focus();
                    nameInput.style.borderColor = '#ff5050';
                    setTimeout(() => { nameInput.style.borderColor = ''; }, 1200);
                    return;
                }
                this.saveConfiguration(name);
                nameInput.value = '';
            });
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveBtn.click();
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportConfigBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportConfiguration());
        }

        // Import file input
        const importInput = document.getElementById('importConfig');
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.importConfiguration(file);
                importInput.value = ''; // allow re-import of same file
            });
        }

        // Render any existing saved configs
        this.renderSavedConfigs();
    }

    /** Save current params to localStorage under the given name */
    saveConfiguration(name) {
        const configs = this._loadAllConfigs();
        // Overwrite if same name exists
        const existing = configs.findIndex(c => c.name === name);
        const entry = {
            name,
            timestamp: new Date().toISOString(),
            params: { ...this.params }
        };
        if (existing >= 0) {
            configs[existing] = entry;
        } else {
            configs.unshift(entry); // newest first
        }
        this._saveAllConfigs(configs);
        this.renderSavedConfigs();
    }

    /** Load a saved configuration by name */
    loadConfigurationByName(name) {
        const configs = this._loadAllConfigs();
        const config = configs.find(c => c.name === name);
        if (!config) return;
        this.loadAllParams(config.params);
    }

    /** Delete a saved configuration by name */
    deleteConfiguration(name) {
        const configs = this._loadAllConfigs().filter(c => c.name !== name);
        this._saveAllConfigs(configs);
        this.renderSavedConfigs();
    }

    /** Export current params as a downloaded JSON file */
    exportConfiguration() {
        const data = {
            name: 'SmoothLife Configuration',
            version: 1,
            timestamp: new Date().toISOString(),
            params: { ...this.params }
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smoothlife-config-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /** Import a configuration from a JSON file */
    importConfiguration(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.params || typeof data.params !== 'object') {
                    alert('Invalid configuration file: missing params object.');
                    return;
                }
                this.loadAllParams(data.params);
            } catch (err) {
                alert('Failed to parse configuration file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    /** Apply a full params object: update internal state, all sliders, and trigger callback */
    loadAllParams(params) {
        // Merge loaded params into this.params (preserving any new keys not in the saved config)
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'boolean' || typeof value === 'number') {
                this.params[key] = value;
            }
        }

        // Update core sliders
        const coreSliders = [
            { id: 'boundarySimplification', key: 'boundarySimplification', pct: false },
            { id: 'boundaryStrength', key: 'boundaryStrength', pct: false },
            { id: 'kernelWidth', key: 'kernelWidth', pct: true },
            { id: 'hazardRate', key: 'hazardRate', pct: false },
            { id: 'simSpeed', key: 'simSpeed', pct: false },
            { id: 'energy', key: 'energy', pct: false },
            { id: 'sourceColorAdherence', key: 'sourceColorAdherence', pct: false },
            { id: 'colorFeedback', key: 'colorFeedback', pct: false },
            { id: 'colorInertia', key: 'colorInertia', pct: false },
            { id: 'sourceDrift', key: 'sourceDrift', pct: false }
        ];
        for (const { id, key, pct } of coreSliders) {
            const slider = document.getElementById(id);
            const display = document.getElementById(`${id}Value`);
            if (!slider || !display) continue;
            const value = this.params[key];
            if (value === undefined) continue;
            slider.value = value;
            if (pct && id === 'kernelWidth') {
                display.textContent = `${(this.kernelWidthFromSlider(value) * 100).toFixed(1)}%`;
            } else if (pct) {
                display.textContent = `${(value * 100).toFixed(1)}%`;
            } else {
                display.textContent = value.toFixed(2);
            }
        }

        // Update checkbox
        const showSectionsCb = document.getElementById('showSections');
        if (showSectionsCb) showSectionsCb.checked = !!this.params.showSections;

        // Update all tunable param sliders
        for (const p of TUNABLE_PARAMS) {
            this.updateTunableSlider(p.key, this.params[p.key] ?? p.default);
        }

        // Trigger update
        this.callbacks.onParamChange(this.getParams());
    }

    /** Render the saved configurations list */
    renderSavedConfigs() {
        const list = document.getElementById('savedConfigsList');
        if (!list) return;
        list.innerHTML = '';

        const configs = this._loadAllConfigs();
        for (const config of configs) {
            const item = document.createElement('div');
            item.className = 'saved-config-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'config-item-name';
            nameSpan.textContent = config.name;
            nameSpan.title = `Saved: ${new Date(config.timestamp).toLocaleString()}`;
            item.appendChild(nameSpan);

            const loadBtn = document.createElement('button');
            loadBtn.className = 'config-load-btn';
            loadBtn.textContent = 'Load';
            loadBtn.addEventListener('click', () => this.loadConfigurationByName(config.name));
            item.appendChild(loadBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'config-delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Delete this configuration';
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Delete "${config.name}"?`)) {
                    this.deleteConfiguration(config.name);
                }
            });
            item.appendChild(deleteBtn);

            list.appendChild(item);
        }
    }

    /** Read all saved configs from localStorage */
    _loadAllConfigs() {
        try {
            const raw = localStorage.getItem(ControlsManager.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    /** Write all configs to localStorage */
    _saveAllConfigs(configs) {
        try {
            localStorage.setItem(ControlsManager.STORAGE_KEY, JSON.stringify(configs));
        } catch {
            alert('Could not save to localStorage — storage may be full or disabled.');
        }
    }
    
    updatePauseButton(isPaused) {
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) {
            pauseBtn.textContent = isPaused ? 'Play' : 'Pause';
        }
    }
    
    getParams() {
        const energy = this.params.energy;
        const sourceColorAdherence = this.params.sourceColorAdherence;

        const activity = Math.min(1.0, 0.08 + energy * 0.92);
        const chaos = Math.min(1.0, 0.04 + energy * 0.96);
        const deltaTime = this.params.simSpeed;
        const radius = this.kernelWidthFromSlider(this.params.kernelWidth);

        // Boundary strength: 0 = erode away, 1 = strong unbroken boundaries
        const bs2 = this.params.boundaryStrength;
        const boundaryReassertionRate = 0.18 * bs2;
        const boundaryErosionStrength = 0.55 * (1.0 - bs2);
        const boundaryDiffusionRate = 0.3;

        const edgePump = 0.0;
        const edgeConfinement = 0.25 + bs2 * 0.65;

        // Previously-hardcoded section map params: now read from this.params
        const sectionScale = this.params.sectionScale;
        const tileSize = this.params.tileSize ?? 0.66;
        const edgeAdherence = this.params.edgeAdherence ?? 1.0;
        const microDetailInfluence = this.params.microDetailInfluence ?? 0.0;
        const sectionStrictness = this.params.sectionStrictness ?? 0.70;
        const sectionClosure = this.params.sectionClosure ?? 0.70;

        const structuredNoise = this.params.hazardRate;
        const mutation = this.params.hazardRate;
        const noiseScale = 0.45 + this.params.hazardRate * 0.45;
        // noisePersistence: direct from slider, no longer overwritten
        const noisePersistence = this.params.noisePersistence;

        const imagePump = 0.0;

        const bs = this.params.boundarySimplification;
        const sectionizerSimplification = Math.max(0.0, Math.min(1.0, bs));
        const boundaryLeakage = 0.10 + (1.0 - bs2) * 0.30;

        // Collect all tunable params for direct pass-through to shaders
        const tunables = {};
        for (const p of TUNABLE_PARAMS) {
            tunables[p.key] = this.params[p.key] ?? p.default;
        }

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
            sectionizerSimplification,
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
            boundaryLeakage,
            boundaryReassertionRate,
            boundaryErosionStrength,
            boundaryDiffusionRate,
            patternCoupling: this.params.patternCoupling,
            colorFeedback: this.params.colorFeedback,
            colorInertia: this.params.colorInertia,
            sourceDrift: this.params.sourceDrift,
            showSections: this.params.showSections,
            // All tunable params (shader uniforms)
            ...tunables
        };
    }
}
