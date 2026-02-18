/**
 * UI Controls - Clean Core V1 Parameters Only
 * All 41 parameters exposed, organized by group
 */

import { TUNABLE_PARAMS } from './tunableParams.js';

export class ControlsManager {
    constructor(onParamChange, onImageUpload, onPause, onReset, onModeSwitch) {
        this.onParamChange = onParamChange;
        this.onImageUpload = onImageUpload;
        this.onPause = onPause;
        this.onReset = onReset;
        this.onModeSwitch = onModeSwitch || (() => {}); // Optional
        
        // Initialize params from TUNABLE_PARAMS
        this.params = {};
        for (const p of TUNABLE_PARAMS) {
                this.params[p.key] = p.default;
        }
        
        // Load saved configs from localStorage
        this.loadSavedConfigs();
        
        this.buildUI();
    }
    
    loadSavedConfigs() {
        try {
            const saved = localStorage.getItem('caConfigs');
            this.savedConfigs = saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Failed to load configs:', e);
            this.savedConfigs = [];
        }
    }
    
    saveConfig(name) {
        const config = {
            name: name,
            params: { ...this.params },
            timestamp: Date.now()
        };
        this.savedConfigs.push(config);
        try {
            localStorage.setItem('caConfigs', JSON.stringify(this.savedConfigs));
        } catch (e) {
            console.error('Failed to save config:', e);
        }
        this.updateConfigList();
    }
    
    loadConfig(index) {
        if (index >= 0 && index < this.savedConfigs.length) {
            const config = this.savedConfigs[index];
            this.params = { ...config.params };
            this.rebuildSliders();
            this.onParamChange(this.params);
        }
    }
    
    deleteConfig(index) {
        if (index >= 0 && index < this.savedConfigs.length) {
            this.savedConfigs.splice(index, 1);
            try {
                localStorage.setItem('caConfigs', JSON.stringify(this.savedConfigs));
            } catch (e) {
                console.error('Failed to delete config:', e);
            }
            this.updateConfigList();
        }
    }
    
    exportConfig() {
        const config = {
            name: 'Exported Config',
            params: { ...this.params },
            timestamp: Date.now()
        };
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ca-config.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    importConfig(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                if (config.params) {
                    this.params = { ...config.params };
                    this.rebuildSliders();
                    this.onParamChange(this.params);
                }
            } catch (err) {
                console.error('Failed to import config:', err);
            }
        };
        reader.readAsText(file);
    }

    rebuildSliders() {
        // Update all slider values
        for (const param of TUNABLE_PARAMS) {
            const slider = document.getElementById(`slider-${param.key}`);
            if (slider && param.key in this.params) {
                slider.value = this.params[param.key];
                const valueDisplay = slider.previousElementSibling;
                if (valueDisplay) {
                    valueDisplay.textContent = this.params[param.key].toFixed(param.step < 0.01 ? 3 : 2);
                }
            }
        }
    }
    
    updateConfigList() {
        const container = document.getElementById('saved-configs-list');
        if (!container) return;
        
        container.innerHTML = '';
        this.savedConfigs.forEach((config, index) => {
            const item = document.createElement('div');
            item.className = 'config-item';
            item.innerHTML = `
                <span class="config-name">${config.name}</span>
                <button class="config-load-btn" data-index="${index}">Load</button>
                <button class="config-delete-btn" data-index="${index}">×</button>
            `;
            container.appendChild(item);
        });
        
        // Attach event listeners
        container.querySelectorAll('.config-load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.loadConfig(parseInt(e.target.dataset.index));
            });
        });
        
        container.querySelectorAll('.config-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteConfig(parseInt(e.target.dataset.index));
            });
        });
    }
    
    buildUI() {
        const container = document.querySelector('.controls-container');
        if (!container) {
            console.error('Controls container not found');
                return;
            }
            
        container.innerHTML = '';
        
        // Add header
        const header = document.createElement('div');
        header.className = 'controls-header';
        header.innerHTML = `
            <h2>Core V1 CA Controls</h2>
            <div class="header-buttons">
                <button id="btn-pause">⏸ Pause</button>
                <button id="btn-reset">🔄 Reset</button>
                <button id="btn-upload">📁 Upload Image</button>
            </div>
            <div class="config-section">
                <input type="text" id="config-name-input" placeholder="Config name..." class="config-input">
                <button id="btn-save-config">💾 Save</button>
                <button id="btn-export-config">📤 Export</button>
                <label class="btn-import-label">
                    📥 Import
                    <input type="file" id="btn-import-config" accept=".json" style="display:none">
                </label>
                <div id="saved-configs-list" class="saved-configs-list"></div>
            </div>
        `;
        container.appendChild(header);
        
        // Group parameters by group
        const groups = {};
        for (const param of TUNABLE_PARAMS) {
            if (!groups[param.group]) {
                groups[param.group] = [];
            }
            groups[param.group].push(param);
        }
        
        // Create collapsible sections for each group
        for (const [groupName, params] of Object.entries(groups)) {
            const section = this.createGroupSection(groupName, params);
            container.appendChild(section);
        }
        
        // Attach event listeners
        this.pauseButton = document.getElementById('btn-pause');
        this.pauseButton?.addEventListener('click', () => this.onPause());
        
        document.getElementById('btn-reset')?.addEventListener('click', () => this.onReset());
        document.getElementById('btn-upload')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) this.onImageUpload(file);
            };
            input.click();
        });
        
        // Config buttons
        document.getElementById('btn-save-config')?.addEventListener('click', () => {
            const nameInput = document.getElementById('config-name-input');
            const name = nameInput?.value.trim() || `Config ${this.savedConfigs.length + 1}`;
            this.saveConfig(name);
            if (nameInput) nameInput.value = '';
        });
        
        document.getElementById('btn-export-config')?.addEventListener('click', () => {
            this.exportConfig();
        });
        
        document.getElementById('btn-import-config')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.importConfig(file);
        });
        
        this.updateConfigList();
    }
    
    createGroupSection(groupName, params) {
        const section = document.createElement('div');
        section.className = 'param-group';
        
        const header = document.createElement('div');
        header.className = 'param-group-header';
        header.textContent = groupName;
        header.onclick = () => {
            section.classList.toggle('collapsed');
        };
        section.appendChild(header);
        
        const content = document.createElement('div');
        content.className = 'param-group-content';
        
        for (const param of params) {
            const control = this.createSliderControl(param);
            content.appendChild(control);
        }
        
        section.appendChild(content);
        return section;
    }
    
    createSliderControl(param) {
        const wrapper = document.createElement('div');
        wrapper.className = 'slider-control';
        
        const label = document.createElement('label');
        label.textContent = param.label;
        label.title = param.hint;
        
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'slider-value';
        valueDisplay.textContent = this.params[param.key].toFixed(param.step < 0.01 ? 3 : 2);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = param.min;
        slider.max = param.max;
        slider.step = param.step;
        slider.value = this.params[param.key];
        slider.id = `slider-${param.key}`;
        
        slider.oninput = (e) => {
            const value = parseFloat(e.target.value);
            this.params[param.key] = value;
            valueDisplay.textContent = value.toFixed(param.step < 0.01 ? 3 : 2);
            this.onParamChange(this.params);
        };
        
        const hint = document.createElement('div');
        hint.className = 'slider-hint';
        hint.textContent = param.hint;
        
        wrapper.appendChild(label);
        wrapper.appendChild(valueDisplay);
        wrapper.appendChild(slider);
        wrapper.appendChild(hint);
        
        return wrapper;
    }
    
    getParams() {
        return this.params;
    }
    
    updateParam(key, value) {
        if (key in this.params) {
                this.params[key] = value;
            const slider = document.getElementById(`slider-${key}`);
            if (slider) {
            slider.value = value;
                const valueDisplay = slider.previousElementSibling;
                if (valueDisplay) {
                    const param = TUNABLE_PARAMS.find(p => p.key === key);
                    valueDisplay.textContent = value.toFixed(param.step < 0.01 ? 3 : 2);
                }
            }
            this.onParamChange(this.params);
        }
    }
    
    updatePauseButton(isPaused) {
        if (this.pauseButton) {
            this.pauseButton.textContent = isPaused ? '▶ Play' : '⏸ Pause';
        }
    }
    
    // Stub methods for compatibility with main.js
    setAutoTuneStatsText() {}
    setAutoTuneKnobScoresText() {}
    updatePipelineStatus() {}
    setMode() {}
    getMode() { return 'spatial'; }
}
