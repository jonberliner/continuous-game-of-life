/**
 * UI Controls — artist-facing drawers built from TUNABLE_PARAMS.
 *
 * Layout: transport bar (play / restart / speed / snapshot) in the header,
 * then a side panel with the image source, quick actions, one drawer per
 * DRAWERS entry (advanced knobs folded into "fine print"), and saved looks.
 */

import {
    TUNABLE_PARAMS,
    DRAWERS,
    PALETTE_PRESETS,
    DEFAULT_PALETTE,
    MAX_PALETTE_COLORS
} from './tunableParams.js';

const CONFIGS_KEY = 'caConfigs';
const CURRENT_KEY = 'caCurrentLook';
const OPEN_DRAWERS_KEY = 'caOpenDrawers';

function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
}

function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Private windows / blocked storage: the app still works, it just won't remember.
    }
}

function randn() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function hslHex(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(c * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// A roll of the dice that still tends to look intentional: one anchor hue,
// spread by a random harmony, with a ladder of lightness.
function randomPalette() {
    const n = 3 + Math.floor(Math.random() * 3);
    const base = Math.random() * 360;
    const harmonies = [30, 60, 120, 150, 180, 360 / n];
    const step = harmonies[Math.floor(Math.random() * harmonies.length)];
    const colors = [];
    for (let i = 0; i < n; i++) {
        const h = (base + step * i + randn() * 8 + 360) % 360;
        const s = 0.55 + Math.random() * 0.45;
        const l = 0.25 + (i / Math.max(1, n - 1)) * 0.5 + randn() * 0.05;
        colors.push(hslHex(h, s, Math.max(0.08, Math.min(0.92, l))));
    }
    const darkBg = Math.random() < 0.7;
    const background = hslHex(base, 0.3, darkBg ? 0.04 + Math.random() * 0.05 : 0.9 + Math.random() * 0.06);
    return { colors, background };
}

export function speedStepsPerSecond(v) {
    return Math.pow(10, v * 3.3 - 2.0) * 60;
}

const FORMATTERS = {
    deltaTime: (v) => {
        const sps = speedStepsPerSecond(v);
        return sps < 10 ? `${sps.toFixed(1)}/s` : `${Math.round(sps)}/s`;
    },
    angleQuantization: (v) => (v <= 1 ? 'free' : `${Math.round(v)} dirs`),
    spatialFrequency: (v) => `#${Math.round(v)}`,
    memoryFreqScale: (v) => `#${Math.round(v)}`,
    paletteCycle: (v) => (Math.abs(v) < 0.005 ? 'still' : `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}`),
    paletteShift: (v) => `${Math.round(v * 360)}°`,
    radius: (v) => `${(v * 100).toFixed(1)}%`,
    kernelSecondaryRadius: (v) => `${v.toFixed(1)}×`,
};

function formatValue(param, v) {
    const f = FORMATTERS[param.key];
    if (f) return f(v);
    return String(Math.round(((v - param.min) / (param.max - param.min)) * 100));
}

export class ControlsManager {
    /**
     * @param {object} handlers
     *   onParamChange(params), onImageFile(file), onImageUrl(url),
     *   onPause(), onRestart(), onSnapshot()
     */
    constructor(handlers) {
        this.handlers = handlers;
        this.defaults = {};
        for (const p of TUNABLE_PARAMS) this.defaults[p.key] = p.default;
        this.defaults.palette = [...DEFAULT_PALETTE.colors];
        this.defaults.paletteBackground = DEFAULT_PALETTE.background;

        this.params = this.withDefaults(readStorage(CURRENT_KEY, null) || {});
        this.savedConfigs = readStorage(CONFIGS_KEY, []);
        this.openDrawers = new Set(readStorage(OPEN_DRAWERS_KEY, ['palette', 'shape']));
        this.inputs = {};

        this.buildTransport();
        this.buildPanel();
        this.bindGlobalInput();
        this.syncAll();
    }

    withDefaults(params) {
        const out = { ...this.defaults, ...params };
        // Older saved looks can hold values outside today's slider ranges.
        for (const p of TUNABLE_PARAMS) {
            if (p.control === 'checkbox') continue;
            const v = Number(out[p.key]);
            out[p.key] = Number.isFinite(v) ? Math.max(p.min, Math.min(p.max, v)) : p.default;
        }
        out.palette = Array.isArray(out.palette) && out.palette.length
            ? out.palette.slice(0, MAX_PALETTE_COLORS)
            : [...this.defaults.palette];
        return out;
    }

    emit() {
        writeStorage(CURRENT_KEY, this.params);
        this.handlers.onParamChange?.(this.params);
        document.dispatchEvent(new CustomEvent('cgol:palette', {
            detail: { colors: this.params.palette, background: this.params.paletteBackground }
        }));
    }

    // ------------------------------------------------------------------
    //  Transport bar
    // ------------------------------------------------------------------

    buildTransport() {
        const host = document.getElementById('transport');
        if (!host) return;
        host.innerHTML = '';
        this.pauseButton = el('button', {
            class: 'tbtn tbtn-primary', title: 'Pause / play  [space]',
            onclick: () => this.handlers.onPause?.()
        }, '❚❚ pause');
        const restart = el('button', {
            class: 'tbtn', title: 'Restart the simulation from the image  [R]',
            onclick: () => this.handlers.onRestart?.()
        }, '↺ restart');
        const snap = el('button', {
            class: 'tbtn', title: 'Save the current frame as a PNG  [S]',
            onclick: () => this.handlers.onSnapshot?.()
        }, '◉ snapshot');

        const speedParam = TUNABLE_PARAMS.find((p) => p.key === 'deltaTime');
        const speed = el('label', { class: 'speed', title: speedParam.hint },
            el('span', { class: 'speed-label', text: 'speed' }),
            this.makeRange(speedParam),
            this.makeOutput(speedParam)
        );
        host.append(this.pauseButton, restart, speed, snap);
    }

    // ------------------------------------------------------------------
    //  Side panel
    // ------------------------------------------------------------------

    buildPanel() {
        const container = document.querySelector('.controls-container');
        if (!container) {
            console.error('Controls container not found');
            return;
        }
        container.innerHTML = '';
        container.append(
            this.buildSourceSection(),
            this.buildQuickActions(),
            ...DRAWERS.map((d) => this.buildDrawer(d)),
            this.buildConfigsDrawer()
        );
    }

    buildSourceSection() {
        const fileInput = el('input', {
            type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'image-file',
            onchange: (e) => {
                const file = e.target.files[0];
                if (file) this.handlers.onImageFile?.(file);
                e.target.value = '';
            }
        });
        const drop = el('label', { class: 'dropzone', for: 'image-file' },
            el('span', { class: 'dropzone-big', text: 'drop an image' }),
            el('span', { class: 'dropzone-small', text: 'or click to browse · or paste' })
        );
        const urlInput = el('input', {
            type: 'url', class: 'text-input', placeholder: 'https://…/image.jpg',
            'aria-label': 'Image URL'
        });
        const loadUrl = () => {
            const url = urlInput.value.trim();
            if (url) this.handlers.onImageUrl?.(url);
        };
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loadUrl();
        });
        const urlRow = el('div', { class: 'row' },
            urlInput,
            el('button', { class: 'btn', onclick: loadUrl }, 'load')
        );
        return el('section', { class: 'source' },
            el('h2', { class: 'section-title' }, el('span', { class: 'glyph', text: '◧' }), 'Source'),
            drop, fileInput, urlRow,
            el('p', { class: 'fine', text: 'Your image sets the starting light and dark, and its outlines can steer growth (see Image Influence).' })
        );
    }

    buildQuickActions() {
        return el('div', { class: 'quick' },
            el('button', {
                class: 'btn btn-loud', title: 'Nudge every knob a little at random  [M]',
                onclick: () => this.mutate()
            }, '⚂ mutate'),
            el('button', {
                class: 'btn', title: 'Put every knob back to its default. Your palette colors stay.',
                onclick: () => this.resetAll()
            }, '↺ reset knobs')
        );
    }

    buildDrawer(drawer) {
        const params = TUNABLE_PARAMS.filter((p) => p.drawer === drawer.id);
        const main = params.filter((p) => !p.advanced);
        const advanced = params.filter((p) => p.advanced);

        const details = el('details', { class: 'drawer', 'data-drawer': drawer.id });
        if (this.openDrawers.has(drawer.id)) details.open = true;
        details.addEventListener('toggle', () => {
            if (details.open) this.openDrawers.add(drawer.id);
            else this.openDrawers.delete(drawer.id);
            writeStorage(OPEN_DRAWERS_KEY, [...this.openDrawers]);
        });

        const resetBtn = el('button', {
            class: 'drawer-reset', title: `Reset ${drawer.title} to defaults`,
            onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.resetKeys(params.map((p) => p.key));
            }
        }, 'reset');

        const summary = el('summary', {},
            el('span', { class: 'glyph', text: drawer.glyph }),
            el('span', { class: 'drawer-title', text: drawer.title }),
            resetBtn,
            el('span', { class: 'chevron', 'aria-hidden': 'true', text: '+' })
        );

        const body = el('div', { class: 'drawer-body' },
            el('p', { class: 'blurb', text: drawer.blurb })
        );
        if (drawer.id === 'palette') body.append(this.buildPaletteEditor());
        body.append(...main.map((p) => this.buildControl(p)));
        if (advanced.length) {
            body.append(el('details', { class: 'fineprint' },
                el('summary', {}, `fine print · ${advanced.length}`),
                el('div', { class: 'fineprint-body' }, ...advanced.map((p) => this.buildControl(p)))
            ));
        }
        details.append(summary, body);
        return details;
    }

    makeRange(param) {
        const input = el('input', {
            type: 'range', min: param.min, max: param.max, step: param.step,
            id: `knob-${param.key}`, title: 'double-click to reset'
        });
        input.addEventListener('input', () => {
            this.params[param.key] = parseFloat(input.value);
            this.syncKnob(param);
            this.emit();
        });
        input.addEventListener('dblclick', () => this.resetKeys([param.key]));
        this.inputs[param.key] = { ...(this.inputs[param.key] || {}), input };
        return input;
    }

    makeOutput(param) {
        const out = el('output', { class: 'knob-value', for: `knob-${param.key}` });
        this.inputs[param.key] = { ...(this.inputs[param.key] || {}), output: out };
        return out;
    }

    buildControl(param) {
        if (param.control === 'checkbox') {
            const input = el('input', { type: 'checkbox', id: `knob-${param.key}`, role: 'switch' });
            input.addEventListener('change', () => {
                this.params[param.key] = input.checked;
                this.emit();
            });
            this.inputs[param.key] = { input };
            return el('div', { class: 'knob knob-toggle' },
                el('label', { class: 'toggle', for: `knob-${param.key}` },
                    input,
                    el('span', { class: 'toggle-track', 'aria-hidden': 'true' }),
                    el('span', { class: 'knob-label', text: param.label })
                ),
                el('p', { class: 'knob-hint', text: param.hint })
            );
        }
        return el('div', { class: 'knob' },
            el('div', { class: 'knob-head' },
                el('label', { class: 'knob-label', for: `knob-${param.key}`, text: param.label }),
                this.makeOutput(param)
            ),
            this.makeRange(param),
            el('div', { class: 'knob-ends', 'aria-hidden': 'true' },
                el('span', { text: param.lo || '' }),
                el('span', { text: param.hi || '' })
            ),
            el('p', { class: 'knob-hint', text: param.hint })
        );
    }

    // ------------------------------------------------------------------
    //  Palette editor
    // ------------------------------------------------------------------

    buildPaletteEditor() {
        this.swatchRow = el('div', { class: 'swatches' });
        this.bgSwatch = el('input', {
            type: 'color', class: 'swatch swatch-bg', 'aria-label': 'Background color',
            oninput: (e) => {
                this.params.paletteBackground = e.target.value;
                this.syncPalettePreview();
                this.emit();
            }
        });
        this.palettePreview = el('div', { class: 'palette-preview', 'aria-hidden': 'true' });

        const presets = el('div', { class: 'presets' },
            ...PALETTE_PRESETS.map((preset) => el('button', {
                class: 'preset', title: `Use the ${preset.name} palette`,
                style: `--strip: linear-gradient(90deg, ${preset.colors.join(', ')}); --pbg: ${preset.background}`,
                onclick: () => this.setPalette(preset.colors, preset.background)
            }, el('span', { class: 'preset-strip' }), el('span', { class: 'preset-name', text: preset.name })))
        );

        const paste = el('input', {
            type: 'text', class: 'text-input', placeholder: 'paste hex codes or a coolors.co link',
            'aria-label': 'Paste palette colors'
        });
        const applyPaste = () => {
            const found = (paste.value.match(/#?\b[0-9a-f]{6}\b/gi) || []).map((h) => '#' + h.replace('#', '').toLowerCase());
            if (!found.length) {
                this.toast('No 6-digit hex colors found in that.');
                return;
            }
            this.setPalette(found.slice(0, MAX_PALETTE_COLORS), this.params.paletteBackground);
            paste.value = '';
        };
        paste.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') applyPaste();
        });

        return el('div', { class: 'palette-editor' },
            this.palettePreview,
            el('div', { class: 'swatch-block' },
                el('div', { class: 'swatch-col' },
                    el('span', { class: 'mini-label', text: 'colors' }),
                    this.swatchRow
                ),
                el('div', { class: 'swatch-col swatch-col-bg' },
                    el('span', { class: 'mini-label', text: 'background' }),
                    this.bgSwatch
                )
            ),
            el('div', { class: 'row row-tight' },
                el('button', { class: 'btn btn-sm', title: 'Generate a random palette', onclick: () => {
                    const p = randomPalette();
                    this.setPalette(p.colors, p.background);
                } }, '⚂ roll'),
                el('button', { class: 'btn btn-sm', title: 'Reverse the order of your colors', onclick: () => {
                    this.setPalette([...this.params.palette].reverse(), this.params.paletteBackground);
                } }, '⇄ reverse'),
                el('button', { class: 'btn btn-sm', title: 'Shuffle the order of your colors', onclick: () => {
                    const shuffled = [...this.params.palette].sort(() => Math.random() - 0.5);
                    this.setPalette(shuffled, this.params.paletteBackground);
                } }, '≋ shuffle')
            ),
            el('div', { class: 'row' }, paste, el('button', { class: 'btn', onclick: applyPaste }, 'use')),
            el('span', { class: 'mini-label', text: 'presets' }),
            presets,
            el('p', { class: 'fine', text: 'Order matters: neighbouring colors in the strip are the ones that blend into each other.' })
        );
    }

    renderSwatches() {
        if (!this.swatchRow) return;
        this.swatchRow.innerHTML = '';
        this.params.palette.forEach((hex, i) => {
            const input = el('input', {
                type: 'color', class: 'swatch', value: hex, 'aria-label': `Palette color ${i + 1}`,
                oninput: (e) => {
                    this.params.palette[i] = e.target.value;
                    this.syncPalettePreview();
                    this.emit();
                }
            });
            const remove = this.params.palette.length > 1
                ? el('button', {
                    class: 'swatch-remove', title: 'Remove this color', 'aria-label': `Remove color ${i + 1}`,
                    onclick: () => {
                        this.params.palette.splice(i, 1);
                        this.renderSwatches();
                        this.emit();
                    }
                }, '×')
                : null;
            this.swatchRow.append(el('div', { class: 'swatch-wrap' }, input, remove));
        });
        if (this.params.palette.length < MAX_PALETTE_COLORS) {
            this.swatchRow.append(el('button', {
                class: 'swatch swatch-add', title: 'Add a color', 'aria-label': 'Add a color',
                onclick: () => {
                    const last = this.params.palette[this.params.palette.length - 1] || '#ffffff';
                    this.params.palette.push(randomPalette().colors[0] || last);
                    this.renderSwatches();
                    this.emit();
                }
            }, '+'));
        }
        this.syncPalettePreview();
    }

    syncPalettePreview() {
        if (this.bgSwatch) this.bgSwatch.value = this.params.paletteBackground;
        if (!this.palettePreview) return;
        const colors = this.params.palette;
        const loop = [...colors, colors[0]];
        this.palettePreview.style.setProperty('--strip', `linear-gradient(90deg, ${loop.join(', ')})`);
        this.palettePreview.style.setProperty('--pbg', this.params.paletteBackground);
    }

    setPalette(colors, background) {
        this.params.palette = colors.slice(0, MAX_PALETTE_COLORS);
        this.params.paletteBackground = background;
        if (!this.params.paletteOn) this.params.paletteOn = true;
        this.renderSwatches();
        this.syncAll();
        this.emit();
    }

    // ------------------------------------------------------------------
    //  Saved looks
    // ------------------------------------------------------------------

    buildConfigsDrawer() {
        const nameInput = el('input', { type: 'text', class: 'text-input', placeholder: 'name this look…', 'aria-label': 'Look name' });
        const save = () => {
            const name = nameInput.value.trim() || `look #${this.savedConfigs.length + 1}`;
            this.savedConfigs.push({ name, params: structuredClone(this.params), timestamp: Date.now() });
            writeStorage(CONFIGS_KEY, this.savedConfigs);
            nameInput.value = '';
            this.renderConfigList();
            this.toast(`Saved “${name}”`);
        };
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
        });
        const importInput = el('input', {
            type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'import-config',
            onchange: (e) => {
                const file = e.target.files[0];
                if (file) this.importConfig(file);
                e.target.value = '';
            }
        });
        this.configList = el('ul', { class: 'config-list' });

        const details = el('details', { class: 'drawer', 'data-drawer': 'looks' });
        if (this.openDrawers.has('looks')) details.open = true;
        details.addEventListener('toggle', () => {
            if (details.open) this.openDrawers.add('looks');
            else this.openDrawers.delete('looks');
            writeStorage(OPEN_DRAWERS_KEY, [...this.openDrawers]);
        });
        details.append(
            el('summary', {},
                el('span', { class: 'glyph', text: '▣' }),
                el('span', { class: 'drawer-title', text: 'Saved Looks' }),
                el('span', { class: 'chevron', 'aria-hidden': 'true', text: '+' })
            ),
            el('div', { class: 'drawer-body' },
                el('p', { class: 'blurb', text: 'Save every knob and your palette together. Stored in this browser; export to share.' }),
                el('div', { class: 'row' }, nameInput, el('button', { class: 'btn', onclick: save }, 'save')),
                this.configList,
                el('div', { class: 'row row-tight' },
                    el('button', { class: 'btn btn-sm', onclick: () => this.exportConfig() }, '↓ export .json'),
                    el('label', { class: 'btn btn-sm', for: 'import-config' }, '↑ import .json'),
                    importInput
                )
            )
        );
        this.renderConfigList();
        return details;
    }

    renderConfigList() {
        if (!this.configList) return;
        this.configList.innerHTML = '';
        if (!this.savedConfigs.length) {
            this.configList.append(el('li', { class: 'config-empty', text: 'nothing saved yet' }));
            return;
        }
        this.savedConfigs.forEach((config, index) => {
            const strip = Array.isArray(config.params?.palette) ? config.params.palette : null;
            this.configList.append(el('li', { class: 'config-item' },
                el('span', {
                    class: 'config-strip',
                    style: strip ? `background: linear-gradient(90deg, ${strip.join(', ')})` : undefined
                }),
                el('button', { class: 'config-name', title: 'Load this look', text: config.name, onclick: () => this.loadConfig(index) }),
                el('button', { class: 'config-delete', title: 'Delete', 'aria-label': `Delete ${config.name}`, onclick: () => this.deleteConfig(index) }, '×')
            ));
        });
    }

    applyParams(params) {
        this.params = this.withDefaults(structuredClone(params));
        this.renderSwatches();
        this.syncAll();
        this.emit();
    }

    loadConfig(index) {
        const config = this.savedConfigs[index];
        if (!config) return;
        this.applyParams(config.params);
        this.toast(`Loaded “${config.name}”`);
    }

    deleteConfig(index) {
        if (index < 0 || index >= this.savedConfigs.length) return;
        this.savedConfigs.splice(index, 1);
        writeStorage(CONFIGS_KEY, this.savedConfigs);
        this.renderConfigList();
    }

    exportConfig() {
        const config = { name: 'Exported Look', params: this.params, timestamp: Date.now() };
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: 'continuous-life-look.json' });
        a.click();
        URL.revokeObjectURL(url);
    }

    importConfig(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                if (!config.params) throw new Error('missing params');
                this.applyParams(config.params);
                this.toast(`Imported “${config.name || file.name}”`);
            } catch (err) {
                console.error('Failed to import config:', err);
                this.toast("That file isn't a saved look.");
            }
        };
        reader.readAsText(file);
    }

    // ------------------------------------------------------------------
    //  Bulk actions
    // ------------------------------------------------------------------

    resetKeys(keys) {
        for (const key of keys) this.params[key] = this.defaults[key];
        this.syncAll();
        this.emit();
    }

    resetAll() {
        const keep = { palette: this.params.palette, paletteBackground: this.params.paletteBackground };
        this.params = this.withDefaults(keep);
        this.syncAll();
        this.emit();
        this.toast('Knobs reset. Palette kept.');
    }

    mutate() {
        const skip = new Set(['deltaTime', 'spatialFrequency', 'memoryFreqScale', 'paletteCycle']);
        for (const p of TUNABLE_PARAMS) {
            if (p.control === 'checkbox' || skip.has(p.key)) continue;
            const span = p.max - p.min;
            const next = this.params[p.key] + randn() * span * 0.08;
            const snapped = Math.round((next - p.min) / p.step) * p.step + p.min;
            this.params[p.key] = Math.max(p.min, Math.min(p.max, Number(snapped.toFixed(4))));
        }
        this.syncAll();
        this.emit();
        document.body.classList.remove('glitching');
        void document.body.offsetWidth;
        document.body.classList.add('glitching');
    }

    // ------------------------------------------------------------------
    //  Sync + misc
    // ------------------------------------------------------------------

    syncKnob(param) {
        const refs = this.inputs[param.key];
        if (!refs) return;
        const v = this.params[param.key];
        if (param.control === 'checkbox') {
            refs.input.checked = !!v;
            return;
        }
        if (refs.input) {
            refs.input.value = v;
            const pct = ((v - param.min) / (param.max - param.min)) * 100;
            refs.input.style.setProperty('--fill', `${pct}%`);
            const atDefault = Math.abs(v - param.default) < param.step * 0.5;
            refs.input.closest('.knob, .speed')?.classList.toggle('modified', !atDefault);
        }
        if (refs.output) refs.output.textContent = formatValue(param, v);
    }

    syncAll() {
        for (const p of TUNABLE_PARAMS) this.syncKnob(p);
        if (this.swatchRow && !this.swatchRow.childElementCount) this.renderSwatches();
        this.syncPalettePreview();
    }

    bindGlobalInput() {
        document.addEventListener('keydown', (e) => {
            const t = e.target;
            if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) && t.type !== 'range' && t.type !== 'checkbox') return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === ' ') {
                e.preventDefault();
                this.handlers.onPause?.();
            } else if (e.key === 'r' || e.key === 'R') {
                this.handlers.onRestart?.();
            } else if (e.key === 's' || e.key === 'S') {
                this.handlers.onSnapshot?.();
            } else if (e.key === 'm' || e.key === 'M') {
                this.mutate();
            }
        });

        // Drop anywhere: files from the desktop, or images dragged from another tab.
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
                return;
            }
            const text = e.clipboardData?.getData('text/plain')?.trim();
            if (text && /^https?:\/\/\S+$/i.test(text)) this.handlers.onImageUrl?.(text);
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

    updatePauseButton(isPaused) {
        if (this.pauseButton) this.pauseButton.textContent = isPaused ? '▶ play' : '❚❚ pause';
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

    // Kept for main.js call sites that predate the redesign.
    setKernelDiagnosticsText() {}
    setPipelineStatusText() {}
    setAutoTuneStatsText() {}
    setAutoTuneKnobScoresText() {}
}
