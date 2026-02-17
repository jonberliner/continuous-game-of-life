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
            boundarySimplification: 0.00,
            boundaryStrength: 0.00,
            kernelWidth: 0.40,
            hazardRate: 0.00,
            simSpeed: 0.78,
            energy: 0.78,
            sourceColorAdherence: 0.00,
            colorFeedback: 0.50,
            colorInertia: 0.30,
            sourceDrift: 0.00,
            coreMinimalMode: true,
            autoTuneEnabled: false,
            autoTuneAggression: 0.35,
            autoTuneWeightDriftEnabled: false,
            autoTuneWeightDrift: 0.10,
            healthWMotion: 1.00,
            healthWPattern: 1.00,
            healthWColorStruct: 1.00,
            healthWColorChange: 1.00,
            healthWFlicker: 1.20,
            healthWUniform: 1.00,
            healthWDead: 1.20,
            healthWSource: 0.80,
            showSections: false
        };

        // Populate defaults from tunable params definitions
        for (const p of TUNABLE_PARAMS) {
            if (!(p.key in this.params)) {
                this.params[p.key] = p.default;
            }
        }

        // Baseline: all optional injection/noise paths start off.
        // This gives a clean source-anchored reference state by default.
        Object.assign(this.params, {
            structuredNoise: 0.00,
            mutation: 0.00,
            chromaNoiseMag: 0.00,
            colorDiversity: 0.00,
            pumpNoiseSpread: 0.00,
            growthHueShift: 0.00,
            lSatModulation: 0.00,
            finalNoiseBase: 0.000,
            finalNoiseScale: 0.000,
            basePumpMin: 0.00,
            basePumpMax: 0.00,
            activePumpBase: 0.00,
            activePumpHazScale: 0.00,
            patchUniBase: 0.00,
            patchUniScale: 0.00,
            pumpHazardFloor: 0.00,
            deadDesaturation: 1.00,
            chromaFloorMin: 0.00,
            chromaFloorMax: 0.00,
            grayPushMag: 0.00,

            // Movement-first defaults (cell-neighbor/history driven):
            externalFieldInfluence: 0.00,
            lifeRateBase: 0.055,
            lifeRateActScale: 1.8,
            perturbMag: 0.020,
            growthScale: 3.1,
            transWidth: 0.022,
            transWidthFloor: 0.014,
            aliveHysteresis: 0.010,
            aliveMemory: 0.18,
            actSurvivalCeilShift: 0.11,
            homeoBirthShift: 0.24,
            homeoBirthCeilShift: 0.16,
            homeoSurvivalFloorShift: 0.07,
            homeoDwellBoost: 2.0,
            activityTarget: 0.54,
            activityGain: 0.22,
            noveltyVarLow: 0.006,
            noveltyVarHigh: 0.020,
            noveltyBirthGain: 0.18,
            noveltyBirthCeilGain: 0.14,
            noveltySurvivalDrop: 0.12,
            noveltyColorGain: 1.4,
            stasisDeltaLow: 0.006,
            stasisDeltaHigh: 0.024,
            consensusRepel: 0.10,
            consensusStasisBoost: 2.6,
            stasisLifeBlend: 0.42,
            stasisLifeRateBoost: 2.2,
            stasisColorRateFloor: 0.22,
            colorRateBase: 0.24,
            colorRateActScale: 0.95,
            patternCoupling: 0.84,
            displayValueBlend: 0.12
            ,
            // Core v1 clean-room update parameters
            coreLRate: 1.0,
            coreLDiffGain: 1.2,
            coreLReactionGain: 0.55,
            coreColorToLGain: 0.15,
            coreColorRate: 1.0,
            coreAdoptGain: 1.3,
            coreRepelGain: 0.45,
            coreGrowthHueCoupling: 0.9,
            coreMaxDeltaL: 0.08,
            coreMaxDeltaAB: 0.08
        });

        this._lastSourceLockLogSig = '';
        
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
        setupSlider('autoTuneAggression', 'autoTuneAggression');
        setupSlider('autoTuneWeightDrift', 'autoTuneWeightDrift');
        setupSlider('healthWMotion', 'healthWMotion');
        setupSlider('healthWPattern', 'healthWPattern');
        setupSlider('healthWColorStruct', 'healthWColorStruct');
        setupSlider('healthWColorChange', 'healthWColorChange');
        setupSlider('healthWFlicker', 'healthWFlicker');
        setupSlider('healthWUniform', 'healthWUniform');
        setupSlider('healthWDead', 'healthWDead');
        setupSlider('healthWSource', 'healthWSource');
        setupSlider('structuredNoise', 'structuredNoise');
        setupSlider('mutation', 'mutation');
        setupSlider('growthHueShift', 'growthHueShift');
        setupSlider('chromaNoiseMag', 'chromaNoiseMag');
        setupSlider('colorDiversity', 'colorDiversity');
        setupSlider('pumpNoiseSpread', 'pumpNoiseSpread');
        setupSlider('coreLRate', 'coreLRate');
        setupSlider('coreLDiffGain', 'coreLDiffGain');
        setupSlider('coreLReactionGain', 'coreLReactionGain');
        setupSlider('coreColorToLGain', 'coreColorToLGain');
        setupSlider('coreColorRate', 'coreColorRate');
        setupSlider('coreAdoptGain', 'coreAdoptGain');
        setupSlider('coreRepelGain', 'coreRepelGain');
        setupSlider('coreGrowthHueCoupling', 'coreGrowthHueCoupling');
        setupSlider('coreMaxDeltaL', 'coreMaxDeltaL');
        setupSlider('coreMaxDeltaAB', 'coreMaxDeltaAB');

        const autoTuneEnabled = document.getElementById('autoTuneEnabled');
        if (autoTuneEnabled) {
            autoTuneEnabled.checked = !!this.params.autoTuneEnabled;
            autoTuneEnabled.addEventListener('change', (e) => {
                this.params.autoTuneEnabled = !!e.target.checked;
                this.callbacks.onParamChange(this.getParams());
            });
        }
        const autoTuneWeightDriftEnabled = document.getElementById('autoTuneWeightDriftEnabled');
        if (autoTuneWeightDriftEnabled) {
            autoTuneWeightDriftEnabled.checked = !!this.params.autoTuneWeightDriftEnabled;
            autoTuneWeightDriftEnabled.addEventListener('change', (e) => {
                this.params.autoTuneWeightDriftEnabled = !!e.target.checked;
                this.callbacks.onParamChange(this.getParams());
            });
        }

        const showSections = document.getElementById('showSections');
        if (showSections) {
            showSections.checked = this.params.showSections;
            showSections.addEventListener('change', (e) => {
                this.params.showSections = !!e.target.checked;
                this.callbacks.onParamChange(this.getParams());
            });
        }
        const coreMinimalMode = document.getElementById('coreMinimalMode');
        if (coreMinimalMode) {
            coreMinimalMode.checked = !!this.params.coreMinimalMode;
            coreMinimalMode.addEventListener('change', (e) => {
                this.params.coreMinimalMode = !!e.target.checked;
                this.updatePipelineStatusText();
                this.callbacks.onParamChange(this.getParams());
            });
        }
        this.updatePipelineStatusText();

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
                sourceColorAdherence: 0.40, patternCoupling: 0.68
            },
            presetRegional: {
                boundarySimplification: 0.50, boundaryStrength: 0.82, kernelWidth: 0.735,
                hazardRate: 0.16, simSpeed: 0.63, energy: 0.60, colorFeedback: 0.55,
                colorInertia: 0.25, sourceDrift: 0.10,
                sourceColorAdherence: 0.30, patternCoupling: 0.78
            },
            presetDreamy: {
                boundarySimplification: 0.26, boundaryStrength: 0.50, kernelWidth: 0.752,
                hazardRate: 0.26, simSpeed: 0.55, energy: 0.42, colorFeedback: 0.60,
                colorInertia: 0.45, sourceDrift: 0.30,
                sourceColorAdherence: 0.12, patternCoupling: 0.56
            },
            presetWild: {
                boundarySimplification: 0.80, boundaryStrength: 0.25, kernelWidth: 0.693,
                hazardRate: 0.72, simSpeed: 0.72, energy: 0.88, colorFeedback: 0.70,
                colorInertia: 0.10, sourceDrift: 0.50,
                sourceColorAdherence: 0.02, patternCoupling: 0.92
            },
            presetSourceMemory: {
                boundarySimplification: 0.40, boundaryStrength: 0.85, kernelWidth: 0.715,
                hazardRate: 0.10, simSpeed: 0.63, energy: 0.48, colorFeedback: 0.50,
                colorInertia: 0.40, sourceDrift: 0.05,
                sourceColorAdherence: 0.80, patternCoupling: 0.46
            },
            presetTestingAudit: {
                // Core stance: keep dynamics alive, remove exogenous color forcing.
                boundarySimplification: 0.35, boundaryStrength: 0.62, kernelWidth: 0.62,
                hazardRate: 0.00, simSpeed: 0.58, energy: 0.50, colorFeedback: 0.80,
                colorInertia: 0.35, sourceDrift: 0.00,
                sourceColorAdherence: 0.15, patternCoupling: 0.75,
                structuredNoise: 0.00, mutation: 0.00, noiseScale: 0.54,
                chromaNoiseMag: 0.00, colorDiversity: 0.00, pumpNoiseSpread: 0.00,
                finalNoiseBase: 0.000, finalNoiseScale: 0.000,
                basePumpMin: 0.00, basePumpMax: 0.00, activePumpBase: 0.00,
                activePumpHazScale: 0.00, patchUniBase: 0.00, patchUniScale: 0.00,
                pumpHazardFloor: 0.00,
                satBirthBoost: 0.08, cfbBirthGain: 0.14, cfbSurvivalGain: 0.08,
                cfbThreshold: 0.28
            },
            presetLineSeeking: {
                // Reduce spot bias and seek elongated/labyrinth regimes.
                boundarySimplification: 0.30, boundaryStrength: 0.55, kernelWidth: 0.39,
                hazardRate: 0.08, simSpeed: 0.60, energy: 0.55, colorFeedback: 0.65,
                colorInertia: 0.35, sourceDrift: 0.00,
                sourceColorAdherence: 0.25, patternCoupling: 0.68,
                innerFraction: 0.31, radialFalloff: 0.14,
                transWidth: 0.022, transWidthFloor: 0.018,
                survivalCeiling: 0.46, birthCeiling: 0.40,
                structuredNoise: 0.06, mutation: 0.06, noiseScale: 0.50,
                chromaNoiseMag: 0.015, colorDiversity: 0.015, pumpNoiseSpread: 0.03,
                basePumpClamp: 0.10
            },
            presetCoreMinimal: {
                // Phase-0 baseline: core cell/history/neighbor dynamics only.
                coreMinimalMode: true,
                boundarySimplification: 0.00, boundaryStrength: 0.00, kernelWidth: 0.40,
                hazardRate: 0.00, simSpeed: 0.78, energy: 0.78, colorFeedback: 0.55,
                colorInertia: 0.30, sourceDrift: 0.00,
                sourceColorAdherence: 0.00, patternCoupling: 0.84,
                externalFieldInfluence: 0.00,
                structuredNoise: 0.00, mutation: 0.00, noiseLMag: 0.00,
                chromaNoiseMag: 0.00, colorDiversity: 0.00, pumpNoiseSpread: 0.00,
                finalNoiseBase: 0.000, finalNoiseScale: 0.000,
                basePumpMin: 0.00, basePumpMax: 0.00, activePumpBase: 0.00,
                activePumpHazScale: 0.00, patchUniBase: 0.00, patchUniScale: 0.00,
                pumpHazardFloor: 0.00
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
                // Keep the generated advanced UI in sync with whichever params the preset changed.
                for (const p of TUNABLE_PARAMS) {
                    this.updateTunableSlider(p.key, this.params[p.key] ?? p.default);
                }
                const showSectionsCb = document.getElementById('showSections');
                if (showSectionsCb) showSectionsCb.checked = !!this.params.showSections;
                const coreMinimalModeCb = document.getElementById('coreMinimalMode');
                if (coreMinimalModeCb) coreMinimalModeCb.checked = !!this.params.coreMinimalMode;
                this.updatePipelineStatusText();
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

        // Ensure built-in testing configurations are always available.
        this.ensureDefaultConfigurations();

        // Render any existing saved configs
        this.renderSavedConfigs();
    }

    /** Seed default built-in configurations when missing */
    ensureDefaultConfigurations() {
        const defaults = [
            {
                name: 'Testing (Coupling Audit)',
                params: {
                    boundarySimplification: 0.35, boundaryStrength: 0.62, kernelWidth: 0.62,
                    hazardRate: 0.00, simSpeed: 0.58, energy: 0.50, colorFeedback: 0.80,
                    colorInertia: 0.35, sourceDrift: 0.00,
                    sourceColorAdherence: 0.15, patternCoupling: 0.75,
                    structuredNoise: 0.00, mutation: 0.00, noiseScale: 0.54,
                    chromaNoiseMag: 0.00, colorDiversity: 0.00, pumpNoiseSpread: 0.00,
                    finalNoiseBase: 0.000, finalNoiseScale: 0.000,
                    basePumpMin: 0.00, basePumpMax: 0.00, activePumpBase: 0.00,
                    activePumpHazScale: 0.00, patchUniBase: 0.00, patchUniScale: 0.00,
                    pumpHazardFloor: 0.00,
                    satBirthBoost: 0.08, cfbBirthGain: 0.14, cfbSurvivalGain: 0.08,
                    cfbThreshold: 0.28
                }
            },
            {
                name: 'Line-Seeking',
                params: {
                    boundarySimplification: 0.30, boundaryStrength: 0.55, kernelWidth: 0.39,
                    hazardRate: 0.08, simSpeed: 0.60, energy: 0.55, colorFeedback: 0.65,
                    colorInertia: 0.35, sourceDrift: 0.00,
                    sourceColorAdherence: 0.25, patternCoupling: 0.68,
                    innerFraction: 0.31, radialFalloff: 0.14,
                    transWidth: 0.022, transWidthFloor: 0.018,
                    survivalCeiling: 0.46, birthCeiling: 0.40,
                    structuredNoise: 0.06, mutation: 0.06, noiseScale: 0.50,
                    chromaNoiseMag: 0.015, colorDiversity: 0.015, pumpNoiseSpread: 0.03,
                    basePumpClamp: 0.10
                }
            },
            {
                name: 'Core Minimal Dynamics',
                params: {
                    coreMinimalMode: true,
                    boundarySimplification: 0.00, boundaryStrength: 0.00, kernelWidth: 0.40,
                    hazardRate: 0.00, simSpeed: 0.78, energy: 0.78, colorFeedback: 0.55,
                    colorInertia: 0.30, sourceDrift: 0.00,
                    sourceColorAdherence: 0.00, patternCoupling: 0.84,
                    externalFieldInfluence: 0.00,
                    structuredNoise: 0.00, mutation: 0.00, noiseLMag: 0.00,
                    chromaNoiseMag: 0.00, colorDiversity: 0.00, pumpNoiseSpread: 0.00,
                    finalNoiseBase: 0.000, finalNoiseScale: 0.000,
                    basePumpMin: 0.00, basePumpMax: 0.00, activePumpBase: 0.00,
                    activePumpHazScale: 0.00, patchUniBase: 0.00, patchUniScale: 0.00,
                    pumpHazardFloor: 0.00
                }
            }
        ];

        const configs = this._loadAllConfigs();
        let changed = false;
        for (const d of defaults) {
            const idx = configs.findIndex(c => c.name === d.name);
            const builtInEntry = {
                name: d.name,
                timestamp: new Date(0).toISOString(),
                params: d.params
            };
            if (idx >= 0) {
                configs[idx] = builtInEntry;
            } else {
                configs.push(builtInEntry);
            }
            changed = true;
        }
        if (changed) this._saveAllConfigs(configs);
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
            { id: 'sourceDrift', key: 'sourceDrift', pct: false },
            { id: 'autoTuneAggression', key: 'autoTuneAggression', pct: false },
            { id: 'autoTuneWeightDrift', key: 'autoTuneWeightDrift', pct: false },
            { id: 'healthWMotion', key: 'healthWMotion', pct: false },
            { id: 'healthWPattern', key: 'healthWPattern', pct: false },
            { id: 'healthWColorStruct', key: 'healthWColorStruct', pct: false },
            { id: 'healthWColorChange', key: 'healthWColorChange', pct: false },
            { id: 'healthWFlicker', key: 'healthWFlicker', pct: false },
            { id: 'healthWUniform', key: 'healthWUniform', pct: false },
            { id: 'healthWDead', key: 'healthWDead', pct: false },
            { id: 'healthWSource', key: 'healthWSource', pct: false },
            { id: 'structuredNoise', key: 'structuredNoise', pct: false },
            { id: 'mutation', key: 'mutation', pct: false },
            { id: 'growthHueShift', key: 'growthHueShift', pct: false },
            { id: 'chromaNoiseMag', key: 'chromaNoiseMag', pct: false },
            { id: 'colorDiversity', key: 'colorDiversity', pct: false },
            { id: 'pumpNoiseSpread', key: 'pumpNoiseSpread', pct: false },
            { id: 'coreLRate', key: 'coreLRate', pct: false },
            { id: 'coreLDiffGain', key: 'coreLDiffGain', pct: false },
            { id: 'coreLReactionGain', key: 'coreLReactionGain', pct: false },
            { id: 'coreColorToLGain', key: 'coreColorToLGain', pct: false },
            { id: 'coreColorRate', key: 'coreColorRate', pct: false },
            { id: 'coreAdoptGain', key: 'coreAdoptGain', pct: false },
            { id: 'coreRepelGain', key: 'coreRepelGain', pct: false },
            { id: 'coreGrowthHueCoupling', key: 'coreGrowthHueCoupling', pct: false },
            { id: 'coreMaxDeltaL', key: 'coreMaxDeltaL', pct: false },
            { id: 'coreMaxDeltaAB', key: 'coreMaxDeltaAB', pct: false }
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
        const autoTuneEnabledCb = document.getElementById('autoTuneEnabled');
        if (autoTuneEnabledCb) autoTuneEnabledCb.checked = !!this.params.autoTuneEnabled;
        const autoTuneWeightDriftEnabledCb = document.getElementById('autoTuneWeightDriftEnabled');
        if (autoTuneWeightDriftEnabledCb) autoTuneWeightDriftEnabledCb.checked = !!this.params.autoTuneWeightDriftEnabled;
        const coreMinimalModeCb = document.getElementById('coreMinimalMode');
        if (coreMinimalModeCb) coreMinimalModeCb.checked = !!this.params.coreMinimalMode;
        this.updatePipelineStatusText();

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
        // In minimal mode, boundary strength directly controls structure influence.
        // In legacy mode, structure remains tied to external-field gating.
        const sourceStructureInfluence = this.params.coreMinimalMode
            ? this.params.boundaryStrength
            : (this.params.externalFieldInfluence ?? 0.0) * sourceColorAdherence;

        const activity = Math.min(1.0, 0.08 + energy * 0.92);
        const chaos = Math.min(1.0, 0.04 + energy * 0.96);
        const deltaTime = this.params.simSpeed;
        const radius = this.kernelWidthFromSlider(this.params.kernelWidth);

        // Boundary strength: 0 = erode away, 1 = strong unbroken boundaries
        const bs2 = this.params.boundaryStrength;
        const boundaryReassertionRate = 0.18 * bs2;
        const boundaryErosionStrength = 0.55 * (1.0 - bs2);
        const boundaryDiffusionRate = 0.3;

        const edgeConfinement = 0.25 + bs2 * 0.65;

        // Previously-hardcoded section map params: now read from this.params
        const sectionScale = this.params.sectionScale;
        const tileSize = this.params.tileSize ?? 0.66;
        const edgeAdherence = this.params.edgeAdherence ?? 1.0;
        const microDetailInfluence = this.params.microDetailInfluence ?? 0.0;
        const sectionStrictness = this.params.sectionStrictness ?? 0.70;
        const sectionClosure = this.params.sectionClosure ?? 0.70;

        const structuredNoise = this.params.structuredNoise;
        const mutation = this.params.mutation;
        const noiseScale = this.params.noiseScale;
        const noisePersistence = this.params.noisePersistence;

        const bs = this.params.boundarySimplification;
        const sectionizerSimplification = Math.max(0.0, Math.min(1.0, bs));
        const boundaryLeakage = 0.10 + (1.0 - bs2) * 0.30;

        // Collect all tunable params for direct pass-through to shaders
        const tunables = {};
        for (const p of TUNABLE_PARAMS) {
            tunables[p.key] = this.params[p.key] ?? p.default;
        }

        const result = {
            activity,
            chaos,
            deltaTime,
            radius,
            structuredNoise,
            randomNoise: structuredNoise, // kept for frequency engine compat
            noiseScale,
            noisePersistence,
            mutation,
            imageRestore: 0.0, // kept for frequency engine compat
            edgeDetail: this.params.coreMinimalMode
                ? this.params.boundarySimplification
                : this.params.edgeFineness,
            sectionizerSimplification,
            edgeSensitivity: this.params.edgeFineness,
            edgeConfinement,
            sectionScale,
            tileSize,
            edgeAdherence,
            sectionClosure,
            sectionStrictness,
            microDetailInfluence,
            sourceColorAdherence,
            sourceStructureInfluence,
            hazardRate: this.params.hazardRate,
            boundaryLeakage,
            boundaryReassertionRate,
            boundaryErosionStrength,
            boundaryDiffusionRate,
            patternCoupling: this.params.patternCoupling,
            colorFeedback: this.params.colorFeedback,
            colorInertia: this.params.colorInertia,
            sourceDrift: this.params.sourceDrift,
            autoTuneEnabled: !!this.params.autoTuneEnabled,
            autoTuneAggression: this.params.autoTuneAggression,
            autoTuneWeightDriftEnabled: !!this.params.autoTuneWeightDriftEnabled,
            autoTuneWeightDrift: this.params.autoTuneWeightDrift,
            healthWMotion: this.params.healthWMotion,
            healthWPattern: this.params.healthWPattern,
            healthWColorStruct: this.params.healthWColorStruct,
            healthWColorChange: this.params.healthWColorChange,
            healthWFlicker: this.params.healthWFlicker,
            healthWUniform: this.params.healthWUniform,
            healthWDead: this.params.healthWDead,
            healthWSource: this.params.healthWSource,
            showSections: this.params.showSections,
            coreMinimalMode: !!this.params.coreMinimalMode,
            // All tunable params (shader uniforms)
            ...tunables
        };

        if (this.params.coreMinimalMode) {
            this.applyCoreMinimalOverrides(result);
        }

        this.logSourceLockBlockers(result);
        return result;
    }

    applyCoreMinimalOverrides(params) {
        // Minimal mode baseline: keep ONLY core CA + boundary/source controls.
        // sourceColorAdherence and sourceStructureInfluence remain user-controlled.
        params.externalFieldInfluence = 0.0;
        params.structuredNoise = 0.0;
        params.mutation = 0.0;
        params.noiseLMag = 0.0;
        params.chromaNoiseMag = 0.0;
        params.colorDiversity = 0.0;
        params.pumpNoiseSpread = 0.0;
        params.finalNoiseBase = 0.0;
        params.finalNoiseScale = 0.0;
        params.basePumpMin = 0.0;
        params.basePumpMax = 0.0;
        params.activePumpBase = 0.0;
        params.activePumpHazScale = 0.0;
        params.patchUniBase = 0.0;
        params.patchUniScale = 0.0;
        params.pumpHazardFloor = 0.0;
        params.sourceDrift = 0.0;
        params.hazardRate = 0.0;
    }

    /** Update autotune status text in UI */
    setAutoTuneStatsText(text) {
        const el = document.getElementById('autoTuneStats');
        if (el) el.textContent = text;
    }

    setAutoTuneKnobScoresText(text) {
        const el = document.getElementById('autoTuneKnobScores');
        if (el) el.textContent = text;
    }

    setPipelineStatusText(text) {
        const el = document.getElementById('pipelineStatus');
        if (el) el.textContent = text;
    }

    updatePipelineStatusText() {
        const mode = this.params.coreMinimalMode
            ? 'Core Minimal (core CA + boundary/source only)'
            : 'Legacy Full Stack';
        this.setPipelineStatusText(`Pipeline: ${mode}`);
    }

    /** Set a parameter with clamping and optional callback emit */
    setParam(key, value, emit = true) {
        const bounds = this.getParamBounds(key);
        if (!bounds) return;
        const clamped = Math.max(bounds.min, Math.min(bounds.max, value));
        this.params[key] = clamped;
        this.updateCoreSliderUI(key, clamped);
        this.updateTunableSlider(key, clamped);
        if (emit) this.callbacks.onParamChange(this.getParams());
    }

    /** Nudge a parameter by delta with clamping */
    nudgeParam(key, delta, emit = true) {
        const current = this.params[key];
        if (typeof current !== 'number') return;
        this.setParam(key, current + delta, emit);
    }

    emitParamsChanged() {
        this.callbacks.onParamChange(this.getParams());
    }

    getParamBounds(key) {
        const slider = document.getElementById(key);
        if (slider && slider.type === 'range') {
            const min = slider.min === '' ? -Infinity : parseFloat(slider.min);
            const max = slider.max === '' ? Infinity : parseFloat(slider.max);
            if (!Number.isNaN(min) && !Number.isNaN(max)) {
                return { min, max };
            }
        }
        const p = TUNABLE_PARAMS.find((tp) => tp.key === key);
        if (p) return { min: p.min, max: p.max };
        return null;
    }

    updateCoreSliderUI(key, value) {
        const slider = document.getElementById(key);
        const display = document.getElementById(`${key}Value`);
        if (slider) slider.value = value;
        if (!display) return;
        if (key === 'kernelWidth') {
            display.textContent = `${(this.kernelWidthFromSlider(value) * 100).toFixed(1)}%`;
            return;
        }
        display.textContent = value.toFixed(2);
    }

    /** Log parameters that can make "100% source adherence" look non-source. */
    logSourceLockBlockers(params) {
        if ((params.sourceColorAdherence ?? 0) < 0.99) return;
        const blockers = [];
        const checks = [
            ['structuredNoise', 0],
            ['mutation', 0],
            ['chromaNoiseMag', 0],
            ['colorDiversity', 0],
            ['pumpNoiseSpread', 0],
            ['finalNoiseBase', 0],
            ['finalNoiseScale', 0],
            ['basePumpMin', 0],
            ['basePumpMax', 0],
            ['activePumpBase', 0],
            ['activePumpHazScale', 0],
            ['patchUniBase', 0],
            ['patchUniScale', 0],
            ['growthHueShift', 0],
            ['lSatModulation', 0],
            ['deadDesaturation', 1],
            ['chromaFloorMin', 0],
            ['grayPushMag', 0],
            ['sourceDrift', 0]
        ];
        for (const [key, zero] of checks) {
            const v = params[key];
            if (typeof v === 'number' && Math.abs(v - zero) > 1e-6) blockers.push(`${key}=${v.toFixed(4)}`);
        }
        const sig = blockers.join('|');
        if (sig === this._lastSourceLockLogSig) return;
        this._lastSourceLockLogSig = sig;
        if (blockers.length === 0) {
            console.info('[SourceLock] adherence=100% and no active injection/noise blockers detected.');
        } else {
            console.warn('[SourceLock] adherence=100% but active non-source drivers:', blockers.join(', '));
        }
    }
}
