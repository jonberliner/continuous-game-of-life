/**
 * UI Controls - Clean Core V1 Parameters Only
 * All parameters exposed, organized by group, plus the palette editor.
 */

import { TUNABLE_PARAMS, PALETTE_PRESETS, DEFAULT_PALETTE, MAX_PALETTE_COLORS } from './tunableParams.js';

export class ControlsManager {
    /**
     * @param {object} handlers
     *   onParamChange(params), onImageFile(file), onImageUrl(url),
     *   onPause(), onRestart(), onSnapshot()
     */
    constructor(handlers) {
        this.handlers = handlers;
        this.onParamChange = (params) => this.handlers.onParamChange?.(params);

        // Initialize params from TUNABLE_PARAMS
        this.params = this.defaultParams();

        // Load saved configs from localStorage
        this.loadSavedConfigs();

        this.buildUI();
        this.bindGlobalInput();
    }

    defaultParams() {
        const params = {};
        for (const p of TUNABLE_PARAMS) {
            params[p.key] = p.default;
        }
        params.palette = [...DEFAULT_PALETTE.colors];
        params.paletteBackground = DEFAULT_PALETTE.background;
        return params;
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
            params: structuredClone(this.params),
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

    applyParams(params) {
        // Fill in anything older configs don't have (e.g. palette).
        this.params = { ...this.defaultParams(), ...structuredClone(params) };
        if (!Array.isArray(this.params.palette) || !this.params.palette.length) {
            this.params.palette = [...DEFAULT_PALETTE.colors];
        }
        this.rebuildSliders();
        this.renderSwatches();
        this.emitParams();
    }

    loadConfig(index) {
        if (index >= 0 && index < this.savedConfigs.length) {
            this.applyParams(this.savedConfigs[index].params);
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
                    this.applyParams(config.params);
                }
            } catch (err) {
                console.error('Failed to import config:', err);
                this.toast("That file isn't a saved config.");
            }
        };
        reader.readAsText(file);
    }

    resetToDefaults() {
        const keep = { palette: this.params.palette, paletteBackground: this.params.paletteBackground };
        this.applyParams({ ...this.defaultParams(), ...keep });
        this.toast('All sliders reset to defaults (palette colors kept).');
    }

    rebuildSliders() {
        // Update all slider values
        for (const param of TUNABLE_PARAMS) {
            const slider = document.getElementById(`slider-${param.key}`);
            if (slider && param.key in this.params) {
                if (param.control === 'checkbox') {
                    slider.checked = !!this.params[param.key];
                } else {
                    slider.value = this.params[param.key];
                    const valueDisplay = slider.previousElementSibling;
                    if (valueDisplay) {
                        valueDisplay.textContent = this.params[param.key].toFixed(param.step < 0.01 ? 3 : 2);
                    }
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
            const name = document.createElement('span');
            name.className = 'config-name';
            name.textContent = config.name;
            const load = document.createElement('button');
            load.className = 'config-load-btn';
            load.textContent = 'Load';
            load.addEventListener('click', () => this.loadConfig(index));
            const del = document.createElement('button');
            del.className = 'config-delete-btn';
            del.textContent = '×';
            del.addEventListener('click', () => this.deleteConfig(index));
            item.append(name, load, del);
            container.appendChild(item);
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
                <button id="btn-snapshot">📸 Snapshot</button>
                <button id="btn-defaults">↺ Reset Sliders</button>
            </div>
            <div class="url-row">
                <input type="url" id="image-url-input" placeholder="…or paste an image URL" class="config-input">
                <button id="btn-load-url">Load URL</button>
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
            <div id="pipeline-status" class="slider-hint">Pipeline status unavailable</div>
            <div id="kernel-diagnostics" class="slider-hint">Kernel diagnostics warming up...</div>
        `;
        container.appendChild(header);

        // Group parameters by group (Palette first so it's easy to find)
        const groups = {};
        for (const param of TUNABLE_PARAMS) {
            if (!groups[param.group]) {
                groups[param.group] = [];
            }
            groups[param.group].push(param);
        }
        const order = Object.keys(groups).sort((a, b) => (a === 'Palette' ? -1 : b === 'Palette' ? 1 : 0));

        // Create collapsible sections for each group
        for (const groupName of order) {
            const section = this.createGroupSection(groupName, groups[groupName]);
            container.appendChild(section);
        }

        // Attach event listeners
        this.pauseButton = document.getElementById('btn-pause');
        this.pauseButton?.addEventListener('click', () => this.handlers.onPause?.());

        document.getElementById('btn-reset')?.addEventListener('click', () => this.handlers.onRestart?.());
        document.getElementById('btn-snapshot')?.addEventListener('click', () => this.handlers.onSnapshot?.());
        document.getElementById('btn-defaults')?.addEventListener('click', () => this.resetToDefaults());
        document.getElementById('btn-upload')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) this.handlers.onImageFile?.(file);
            };
            input.click();
        });

        const urlInput = document.getElementById('image-url-input');
        const loadUrl = () => {
            const url = urlInput?.value.trim();
            if (url) this.handlers.onImageUrl?.(url);
        };
        document.getElementById('btn-load-url')?.addEventListener('click', loadUrl);
        urlInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loadUrl();
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
        this.renderSwatches();
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

        if (groupName === 'Palette') {
            content.appendChild(this.createPaletteEditor());
        }

        for (const param of params) {
            const control = this.createParamControl(param);
            content.appendChild(control);
        }

        section.appendChild(content);
        return section;
    }

    // ------------------------------------------------------------------
    //  Palette editor
    // ------------------------------------------------------------------

    createPaletteEditor() {
        const wrap = document.createElement('div');
        wrap.className = 'palette-editor';
        wrap.innerHTML = `
            <div class="palette-preview"></div>
            <div class="swatch-block">
                <div class="swatch-col">
                    <span class="mini-label">Colors (click to change)</span>
                    <div class="swatches"></div>
                </div>
                <div class="swatch-col swatch-col-bg">
                    <span class="mini-label">Background</span>
                    <input type="color" class="swatch swatch-bg" aria-label="Background color">
                </div>
            </div>
            <div class="url-row">
                <input type="text" class="config-input palette-paste" placeholder="Paste hex codes or a coolors.co link">
                <button class="palette-paste-btn">Use</button>
            </div>
            <div class="presets"></div>
        `;
        this.swatchRow = wrap.querySelector('.swatches');
        this.palettePreview = wrap.querySelector('.palette-preview');
        this.bgSwatch = wrap.querySelector('.swatch-bg');
        this.bgSwatch.addEventListener('input', (e) => {
            this.params.paletteBackground = e.target.value;
            this.syncPalettePreview();
            this.emitParams();
        });

        const paste = wrap.querySelector('.palette-paste');
        const applyPaste = () => {
            const found = (paste.value.match(/#?\b[0-9a-f]{6}\b/gi) || []).map((h) => '#' + h.replace('#', '').toLowerCase());
            if (!found.length) {
                this.toast('No 6-digit hex colors found in that.');
                return;
            }
            this.setPalette(found, this.params.paletteBackground);
            paste.value = '';
        };
        wrap.querySelector('.palette-paste-btn').addEventListener('click', applyPaste);
        paste.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') applyPaste();
        });

        const presets = wrap.querySelector('.presets');
        for (const preset of PALETTE_PRESETS) {
            const btn = document.createElement('button');
            btn.className = 'preset';
            btn.title = `Use the ${preset.name} palette`;
            btn.style.setProperty('--strip', `linear-gradient(90deg, ${preset.colors.join(', ')})`);
            btn.style.setProperty('--pbg', preset.background);
            btn.innerHTML = '<span class="preset-strip"></span><span class="preset-name"></span>';
            btn.querySelector('.preset-name').textContent = preset.name;
            btn.addEventListener('click', () => this.setPalette(preset.colors, preset.background));
            presets.appendChild(btn);
        }
        return wrap;
    }

    renderSwatches() {
        if (!this.swatchRow) return;
        this.swatchRow.innerHTML = '';
        this.params.palette.forEach((hex, i) => {
            const cell = document.createElement('div');
            cell.className = 'swatch-wrap';
            const input = document.createElement('input');
            input.type = 'color';
            input.className = 'swatch';
            input.value = hex;
            input.setAttribute('aria-label', `Palette color ${i + 1}`);
            input.addEventListener('input', (e) => {
                this.params.palette[i] = e.target.value;
                this.syncPalettePreview();
                this.emitParams();
            });
            cell.appendChild(input);
            if (this.params.palette.length > 1) {
                const remove = document.createElement('button');
                remove.className = 'swatch-remove';
                remove.title = 'Remove this color';
                remove.textContent = '×';
                remove.addEventListener('click', () => {
                    this.params.palette.splice(i, 1);
                    this.renderSwatches();
                    this.emitParams();
                });
                cell.appendChild(remove);
            }
            this.swatchRow.appendChild(cell);
        });
        if (this.params.palette.length < MAX_PALETTE_COLORS) {
            const add = document.createElement('button');
            add.className = 'swatch swatch-add';
            add.title = 'Add a color';
            add.textContent = '+';
            add.addEventListener('click', () => {
                this.params.palette.push(this.params.palette[this.params.palette.length - 1] || '#ffffff');
                this.renderSwatches();
                this.emitParams();
            });
            this.swatchRow.appendChild(add);
        }
        this.syncPalettePreview();
    }

    syncPalettePreview() {
        if (this.bgSwatch) this.bgSwatch.value = this.params.paletteBackground;
        if (!this.palettePreview) return;
        const colors = this.params.palette;
        this.palettePreview.style.setProperty('--strip', `linear-gradient(90deg, ${[...colors, colors[0]].join(', ')})`);
        this.palettePreview.style.setProperty('--pbg', this.params.paletteBackground);
    }

    setPalette(colors, background) {
        this.params.palette = colors.slice(0, MAX_PALETTE_COLORS);
        this.params.paletteBackground = background;
        this.params.paletteOn = true;
        this.rebuildSliders();
        this.renderSwatches();
        this.emitParams();
    }

    // ------------------------------------------------------------------
    //  Param controls
    // ------------------------------------------------------------------

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
            this.emitParams();
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

    createCheckboxControl(param) {
        const wrapper = document.createElement('div');
        wrapper.className = 'slider-control';

        const label = document.createElement('label');
        label.textContent = param.label;
        label.title = param.hint;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `slider-${param.key}`;
        checkbox.checked = !!this.params[param.key];
        checkbox.style.marginTop = '6px';
        checkbox.style.marginBottom = '6px';

        checkbox.onchange = (e) => {
            this.params[param.key] = !!e.target.checked;
            this.emitParams();
        };

        const hint = document.createElement('div');
        hint.className = 'slider-hint';
        hint.textContent = param.hint;

        wrapper.appendChild(label);
        wrapper.appendChild(checkbox);
        wrapper.appendChild(hint);

        return wrapper;
    }

    createParamControl(param) {
        if (param.control === 'checkbox') {
            return this.createCheckboxControl(param);
        }
        return this.createSliderControl(param);
    }

    emitParams() {
        this.onParamChange(this.params);
        document.dispatchEvent(new CustomEvent('cgol:palette', {
            detail: { colors: this.params.palette, background: this.params.paletteBackground }
        }));
    }

    // ------------------------------------------------------------------
    //  Drop / paste images anywhere, keyboard shortcuts
    // ------------------------------------------------------------------

    bindGlobalInput() {
        document.addEventListener('keydown', (e) => {
            const t = e.target;
            if (t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && t.type !== 'range' && t.type !== 'checkbox') return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === ' ') {
                e.preventDefault();
                this.handlers.onPause?.();
            }
        });

        let dragDepth = 0;
        const veil = document.getElementById('dropveil');
        window.addEventListener('dragenter', (e) => {
            if (!e.dataTransfer?.types?.some((t) => t === 'Files' || t === 'text/uri-list')) return;
            dragDepth++;
            veil?.classList.add('on');
        });
        window.addEventListener('dragleave', () => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (!dragDepth) veil?.classList.remove('on');
        });
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDepth = 0;
            veil?.classList.remove('on');
            const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
            if (file) {
                this.handlers.onImageFile?.(file);
                return;
            }
            const url = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
            if (url && /^https?:/i.test(url.trim())) this.handlers.onImageUrl?.(url.trim().split('\n')[0]);
        });

        window.addEventListener('paste', (e) => {
            const t = e.target;
            if (t instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(t.tagName)) return;
            const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
            if (item) {
                const file = item.getAsFile();
                if (file) this.handlers.onImageFile?.(file);
            }
        });
    }

    toast(message) {
        const node = document.getElementById('toast');
        if (!node) return;
        node.textContent = message;
        node.classList.remove('on');
        void node.offsetWidth;
        node.classList.add('on');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => node.classList.remove('on'), 3200);
    }

    getParams() {
        return this.params;
    }

    updateParam(key, value) {
        if (key in this.params) {
            this.params[key] = value;
            this.rebuildSliders();
            this.emitParams();
        }
    }

    updatePauseButton(isPaused) {
        if (this.pauseButton) {
            this.pauseButton.textContent = isPaused ? '▶ Play' : '⏸ Pause';
        }
        document.body.classList.toggle('paused', isPaused);
    }

    setVitals({ motion, color }) {
        const hud = document.getElementById('hud');
        if (!hud) return;
        const bar = (v) => {
            const n = Math.max(0, Math.min(8, Math.round(v * 8)));
            return '▮'.repeat(n) + '▯'.repeat(8 - n);
        };
        hud.textContent = `MOTION ${bar(motion)}  COLOR ${bar(color)}`;
    }

    // Stub methods for compatibility with main.js
    setAutoTuneStatsText() {}
    setAutoTuneKnobScoresText() {}
    setPipelineStatusText(text) {
        const el = document.getElementById('pipeline-status');
        if (el) el.textContent = text;
    }
    setKernelDiagnosticsText(text) {
        const el = document.getElementById('kernel-diagnostics');
        if (el) el.textContent = text;
    }
    updatePipelineStatus() {}
    setMode() {}
    getMode() { return 'spatial'; }
}
