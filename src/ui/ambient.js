/**
 * Ambient Conway's Game of Life that lives behind the UI.
 *
 * Purely decorative: a coarse, slow, low-contrast grid in the current palette,
 * with fading ghost trails, glider rain, cursor seeding, and the occasional
 * horizontal "tear" glitch. Opacity and the center fade are handled in CSS so
 * the main canvas always stays the focus. Honors prefers-reduced-motion.
 */

import { hexToRgb } from '../render/color.js';

const CELL = 9;               // CSS px per cell
const TICK_MS = 140;          // generation interval
const TRAIL = 6;              // generations a dead cell keeps glowing
const GLIDERS = [
    [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],   // SE
    [[1, 0], [0, 1], [0, 2], [1, 2], [2, 2]],   // SW
];

export class AmbientLife {
    constructor(canvas) {
        this.canvas = canvas;
        if (!canvas) return;
        this.ctx = canvas.getContext('2d');
        this.colors = [[255, 72, 176], [0, 120, 191], [255, 232, 0]];
        this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        this.lastTick = 0;
        this.nextTear = performance.now() + 6000;
        this.tear = null;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('pointermove', (e) => this.seedAt(e.clientX, e.clientY));

        if (this.reduced) {
            this.draw();
            return;
        }
        const loop = (t) => {
            if (!document.hidden && t - this.lastTick > TICK_MS) {
                this.lastTick = t;
                this.step(t);
                this.draw();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    setPalette(colors, background) {
        if (!this.canvas || !Array.isArray(colors) || !colors.length) return;
        this.colors = colors.map(hexToRgb);
        document.documentElement.style.setProperty('--pal-0', colors[0]);
        document.documentElement.style.setProperty('--pal-1', colors[1 % colors.length]);
        document.documentElement.style.setProperty('--pal-2', colors[2 % colors.length]);
        if (background) document.documentElement.style.setProperty('--pal-bg', background);
        if (this.reduced) this.draw();
    }

    resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.cols = Math.ceil(w / CELL);
        this.rows = Math.ceil(h / CELL);
        this.alive = new Uint8Array(this.cols * this.rows);
        this.age = new Uint16Array(this.cols * this.rows);
        this.ghost = new Uint8Array(this.cols * this.rows);
        this.tint = new Uint8Array(this.cols * this.rows);
        for (let i = 0; i < this.alive.length; i++) this.alive[i] = Math.random() < 0.14 ? 1 : 0;
        this.draw();
    }

    idx(x, y) {
        const cx = (x + this.cols) % this.cols;
        const cy = (y + this.rows) % this.rows;
        return cy * this.cols + cx;
    }

    seedAt(px, py) {
        if (!this.alive || this.reduced) return;
        const x = Math.floor(px / CELL);
        const y = Math.floor(py / CELL);
        for (let i = 0; i < 3; i++) {
            this.alive[this.idx(x + Math.floor(Math.random() * 3) - 1, y + Math.floor(Math.random() * 3) - 1)] = 1;
        }
    }

    dropGlider() {
        const shape = GLIDERS[Math.floor(Math.random() * GLIDERS.length)];
        const x = Math.floor(Math.random() * this.cols);
        const y = Math.floor(Math.random() * this.rows);
        for (const [dx, dy] of shape) this.alive[this.idx(x + dx, y + dy)] = 1;
    }

    step(now) {
        const { cols, rows, alive } = this;
        const next = new Uint8Array(alive.length);
        let population = 0;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let n = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx || dy) n += alive[this.idx(x + dx, y + dy)];
                    }
                }
                const i = y * cols + x;
                const on = alive[i] ? (n === 2 || n === 3) : n === 3;
                next[i] = on ? 1 : 0;
                if (on) {
                    population++;
                    this.age[i] = Math.min(65535, this.age[i] + 1);
                    this.ghost[i] = TRAIL;
                    this.tint[i] = Math.floor(this.age[i] / 4);
                } else {
                    this.age[i] = 0;
                    if (this.ghost[i] > 0) this.ghost[i]--;
                }
            }
        }
        this.alive = next;

        // Keep it from ever dying out: glider rain scaled to how empty it is.
        const density = population / alive.length;
        if (density < 0.05 || Math.random() < 0.25) this.dropGlider();
        if (density < 0.015) {
            for (let k = 0; k < 6; k++) this.dropGlider();
        }

        // Occasional horizontal tear: shove a band of rows sideways for a few frames.
        if (now > this.nextTear) {
            const h = 2 + Math.floor(Math.random() * 6);
            this.tear = {
                y: Math.floor(Math.random() * (rows - h)),
                h,
                dx: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.floor(Math.random() * 12)),
                frames: 2 + Math.floor(Math.random() * 3)
            };
            this.nextTear = now + 4000 + Math.random() * 9000;
        }
    }

    draw() {
        const { ctx, cols, rows, colors } = this;
        ctx.clearRect(0, 0, cols * CELL, rows * CELL);
        const tear = this.tear;
        for (let y = 0; y < rows; y++) {
            const shift = tear && y >= tear.y && y < tear.y + tear.h ? tear.dx * CELL : 0;
            for (let x = 0; x < cols; x++) {
                const i = y * cols + x;
                const g = this.ghost[i];
                if (!g) continue;
                const live = this.alive[i];
                // Cells walk through the palette as they age; ghosts fade out in the color they died in.
                const c = colors[this.tint[i] % colors.length];
                const a = live ? 0.9 : (g / TRAIL) * 0.35;
                ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
                const px = x * CELL + shift;
                const inset = live ? 1 : 3;
                ctx.fillRect(px + inset, y * CELL + inset, CELL - inset * 2, CELL - inset * 2);
            }
        }
        if (tear && --tear.frames <= 0) this.tear = null;
    }
}
