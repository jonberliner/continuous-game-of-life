/**
 * Hierarchical sectionizer
 *
 * 1. Build fine base partition from image (edge-guided posterization)
 * 2. Build merge tree (Region Adjacency Graph sorted by color distance)
 * 3. Slider selects how many merges to apply (region-count target)
 *
 * Guarantees monotonic additive refinement:
 *   every boundary at coarse level persists at all finer levels.
 */

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function idx(x, y, w) { return y * w + x; }

// ---- helpers ----

function blurChannel(src, w, h, passes) {
    let cur = new Float32Array(src);
    for (let p = 0; p < passes; p++) {
        const out = new Float32Array(cur.length);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0, n = 0;
                for (let oy = -1; oy <= 1; oy++) {
                    const yy = Math.max(0, Math.min(h - 1, y + oy));
                    for (let ox = -1; ox <= 1; ox++) {
                        const xx = Math.max(0, Math.min(w - 1, x + ox));
                        sum += cur[idx(xx, yy, w)];
                        n++;
                    }
                }
                out[idx(x, y, w)] = sum / n;
            }
        }
        cur = out;
    }
    return cur;
}

class DSU {
    constructor(n) {
        this.parent = new Int32Array(n);
        this.rank = new Int32Array(n);
        for (let i = 0; i < n; i++) this.parent[i] = i;
        this.count = n;
    }
    find(x) {
        while (this.parent[x] !== x) {
            this.parent[x] = this.parent[this.parent[x]];
            x = this.parent[x];
        }
        return x;
    }
    union(a, b) {
        a = this.find(a);
        b = this.find(b);
        if (a === b) return false;
        if (this.rank[a] < this.rank[b]) { const t = a; a = b; b = t; }
        this.parent[b] = a;
        if (this.rank[a] === this.rank[b]) this.rank[a]++;
        this.count--;
        return true;
    }
}

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

// ---- base partition ----

function buildBasePartition(imageData, width, height, edgeDetail) {
    const longSide = Math.max(width, height);
    // Working resolution: 120-380 px on long side
    const segLong = Math.max(100, Math.min(380, Math.round(160 + edgeDetail * 200)));
    const scale = segLong / longSide;
    const sw = Math.max(32, Math.round(width * scale));
    const sh = Math.max(32, Math.round(height * scale));
    const n = sw * sh;

    // Downsample
    const src = imageData.data;
    const rr = new Float32Array(n);
    const gg = new Float32Array(n);
    const bb = new Float32Array(n);
    for (let y = 0; y < sh; y++) {
        const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / sh));
        for (let x = 0; x < sw; x++) {
            const sx = Math.min(width - 1, Math.floor((x + 0.5) * width / sw));
            const i = (sy * width + sx) * 4;
            const k = idx(x, y, sw);
            rr[k] = src[i] / 255;
            gg[k] = src[i + 1] / 255;
            bb[k] = src[i + 2] / 255;
        }
    }

    // Pre-blur (more when edgeDetail is low → smoother regions)
    const blurPasses = Math.max(1, Math.round(3 - edgeDetail * 2));
    const br = blurRGB(rr, gg, bb, sw, sh, blurPasses);

    // Multi-channel Sobel gradient magnitude
    const grad = new Float32Array(n);
    let maxG = 1e-6;
    for (let y = 1; y < sh - 1; y++) {
        for (let x = 1; x < sw - 1; x++) {
            let totalG2 = 0;
            for (const ch of [br.r, br.g, br.b]) {
                const tl = ch[idx(x - 1, y - 1, sw)];
                const tc = ch[idx(x, y - 1, sw)];
                const tr = ch[idx(x + 1, y - 1, sw)];
                const ml = ch[idx(x - 1, y, sw)];
                const mr = ch[idx(x + 1, y, sw)];
                const bl = ch[idx(x - 1, y + 1, sw)];
                const bc = ch[idx(x, y + 1, sw)];
                const brr = ch[idx(x + 1, y + 1, sw)];
                const gx = -tl - 2 * ml - bl + tr + 2 * mr + brr;
                const gy = -tl - 2 * tc - tr + bl + 2 * bc + brr;
                totalG2 += gx * gx + gy * gy;
            }
            const gVal = Math.sqrt(totalG2);
            grad[idx(x, y, sw)] = gVal;
            if (gVal > maxG) maxG = gVal;
        }
    }
    for (let i = 0; i < n; i++) grad[i] /= maxG;

    // Threshold: pixels below threshold are "interior" (non-edge)
    const edgeThresh = 0.04 + (1.0 - edgeDetail) * 0.16;
    const interior = new Uint8Array(n);
    for (let i = 0; i < n; i++) interior[i] = grad[i] < edgeThresh ? 1 : 0;

    // Connected-components on interior pixels
    const labels = new Int32Array(n);
    labels.fill(-1);
    const areas = [];
    let nextLabel = 0;
    for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
            const k = idx(x, y, sw);
            if (!interior[k] || labels[k] >= 0) continue;
            // BFS flood-fill this component
            const queue = [x, y];
            labels[k] = nextLabel;
            let head = 0;
            let area = 0;
            while (head < queue.length) {
                const cx = queue[head++];
                const cy = queue[head++];
                area++;
                for (let d = 0; d < 4; d++) {
                    const nx = cx + DX[d], ny = cy + DY[d];
                    if (nx < 0 || nx >= sw || ny < 0 || ny >= sh) continue;
                    const nk = idx(nx, ny, sw);
                    if (!interior[nk] || labels[nk] >= 0) continue;
                    labels[nk] = nextLabel;
                    queue.push(nx, ny);
                }
            }
            areas[nextLabel] = area;
            nextLabel++;
        }
    }

    // Handle degenerate case: no interior pixels at all
    if (nextLabel === 0) {
        for (let i = 0; i < n; i++) labels[i] = 0;
        areas[0] = n;
        nextLabel = 1;
    }

    // Multi-source BFS to fill ALL unlabeled (edge) pixels
    // Seed from labeled pixels adjacent to unlabeled pixels
    const fillQ = [];
    for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
            const k = idx(x, y, sw);
            if (labels[k] < 0) continue;
            for (let d = 0; d < 4; d++) {
                const nx = x + DX[d], ny = y + DY[d];
                if (nx >= 0 && nx < sw && ny >= 0 && ny < sh && labels[idx(nx, ny, sw)] < 0) {
                    fillQ.push(x, y);
                    break;
                }
            }
        }
    }
    let fHead = 0;
    while (fHead < fillQ.length) {
        const cx = fillQ[fHead++];
        const cy = fillQ[fHead++];
        const cl = labels[idx(cx, cy, sw)];
        for (let d = 0; d < 4; d++) {
            const nx = cx + DX[d], ny = cy + DY[d];
            if (nx < 0 || nx >= sw || ny < 0 || ny >= sh) continue;
            const nk = idx(nx, ny, sw);
            if (labels[nk] >= 0) continue;
            labels[nk] = cl;
            fillQ.push(nx, ny);
        }
    }
    // Safety fallback
    for (let i = 0; i < n; i++) {
        if (labels[i] < 0) labels[i] = 0;
    }

    // Recount areas after fill
    const finalAreas = new Float32Array(nextLabel);
    for (let i = 0; i < n; i++) finalAreas[labels[i]]++;

    // Mean color per region (from blurred channels for stable merging)
    const sumR = new Float32Array(nextLabel);
    const sumG = new Float32Array(nextLabel);
    const sumB = new Float32Array(nextLabel);
    for (let i = 0; i < n; i++) {
        const l = labels[i];
        sumR[l] += br.r[i];
        sumG[l] += br.g[i];
        sumB[l] += br.b[i];
    }
    const meanR = new Float32Array(nextLabel);
    const meanG = new Float32Array(nextLabel);
    const meanB = new Float32Array(nextLabel);
    for (let i = 0; i < nextLabel; i++) {
        const a = Math.max(1, finalAreas[i]);
        meanR[i] = sumR[i] / a;
        meanG[i] = sumG[i] / a;
        meanB[i] = sumB[i] / a;
    }

    // Build Region Adjacency Graph
    const edgeSet = new Map();
    for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
            const k = idx(x, y, sw);
            const l = labels[k];
            // Only check right and down to avoid duplicate edges
            if (x + 1 < sw) {
                const l2 = labels[idx(x + 1, y, sw)];
                if (l !== l2) {
                    const a = Math.min(l, l2), b2 = Math.max(l, l2);
                    const key = a * nextLabel + b2;
                    if (!edgeSet.has(key)) edgeSet.set(key, { a, b: b2 });
                }
            }
            if (y + 1 < sh) {
                const l2 = labels[idx(x, y + 1, sw)];
                if (l !== l2) {
                    const a = Math.min(l, l2), b2 = Math.max(l, l2);
                    const key = a * nextLabel + b2;
                    if (!edgeSet.has(key)) edgeSet.set(key, { a, b: b2 });
                }
            }
        }
    }

    // Merge cost = Euclidean color distance between region means
    // Tiny regions get a bonus (easier to merge) so they don't clutter
    const edges = [];
    edgeSet.forEach(e => {
        const dr = meanR[e.a] - meanR[e.b];
        const dg = meanG[e.a] - meanG[e.b];
        const db = meanB[e.a] - meanB[e.b];
        const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
        const minArea = Math.min(finalAreas[e.a], finalAreas[e.b]);
        // Tiny regions merge more easily (area fraction < 0.5% of image)
        const areaBonus = Math.max(0, 1.0 - minArea / (n * 0.005)) * 0.08;
        const cost = Math.max(0, colorDist - areaBonus);
        edges.push({ a: e.a, b: e.b, cost });
    });
    edges.sort((a, b) => a.cost - b.cost);

    return { sw, sh, n, labels, edges, regionCount: nextLabel, grad };
}

function blurRGB(rr, gg, bb, w, h, passes) {
    let cr = new Float32Array(rr);
    let cg = new Float32Array(gg);
    let cb = new Float32Array(bb);
    for (let p = 0; p < passes; p++) {
        const nr = new Float32Array(cr.length);
        const ng = new Float32Array(cg.length);
        const nb = new Float32Array(cb.length);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sr = 0, sg = 0, sb = 0, n = 0;
                for (let oy = -1; oy <= 1; oy++) {
                    const yy = Math.max(0, Math.min(h - 1, y + oy));
                    for (let ox = -1; ox <= 1; ox++) {
                        const xx = Math.max(0, Math.min(w - 1, x + ox));
                        const k = idx(xx, yy, w);
                        sr += cr[k]; sg += cg[k]; sb += cb[k];
                        n++;
                    }
                }
                const k = idx(x, y, w);
                nr[k] = sr / n;
                ng[k] = sg / n;
                nb[k] = sb / n;
            }
        }
        cr = nr; cg = ng; cb = nb;
    }
    return { r: cr, g: cg, b: cb };
}

// ---- render a specific level from the hierarchy ----

function renderLevel(base, width, height, simplification, boundaryLeakage) {
    const { sw, sh, n, labels, edges, regionCount, grad } = base;

    // Map simplification to target region count (log-scale for perceptual linearity)
    const minRegions = Math.max(2, Math.ceil(regionCount * 0.008));
    const maxRegions = regionCount;
    const logMin = Math.log(Math.max(2, minRegions));
    const logMax = Math.log(Math.max(3, maxRegions));
    const t = clamp01(simplification);
    const targetRegions = Math.round(Math.exp(logMin + (logMax - logMin) * t));

    // Merge until we reach target
    const dsu = new DSU(regionCount);
    for (let i = 0; i < edges.length && dsu.count > targetRegions; i++) {
        dsu.union(edges[i].a, edges[i].b);
    }

    // Remap labels to consecutive IDs
    const remap = new Map();
    let nextID = 0;
    const outLabels = new Int32Array(n);
    for (let i = 0; i < n; i++) {
        const root = dsu.find(labels[i]);
        let mapped = remap.get(root);
        if (mapped === undefined) {
            mapped = nextID++;
            remap.set(root, mapped);
        }
        outLabels[i] = mapped;
    }

    // Hard boundary: where adjacent pixels have different labels
    const hard = new Uint8Array(n);
    for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
            const k = idx(x, y, sw);
            const l = outLabels[k];
            for (let d = 0; d < 4; d++) {
                const nx = x + DX[d], ny = y + DY[d];
                if (nx < 0 || nx >= sw || ny < 0 || ny >= sh) continue;
                if (outLabels[idx(nx, ny, sw)] !== l) { hard[k] = 1; break; }
            }
        }
    }

    // Soft boundary for simulation permeability
    const leakage = clamp01(boundaryLeakage);
    const softPasses = Math.max(1, Math.round(2 + leakage * 4));
    const hardFloat = new Float32Array(n);
    for (let i = 0; i < n; i++) hardFloat[i] = hard[i];
    const softBoundary = blurChannel(hardFloat, sw, sh, softPasses);

    // Pre-compute distinct debug colors per region (golden-ratio hue spacing)
    const regionColors = new Uint8Array(nextID * 3);
    for (let i = 0; i < nextID; i++) {
        const hue = (i * 0.618033988749895) % 1.0;
        const sat = 0.55 + (i % 3) * 0.12;
        const val = 0.70 + (i % 5) * 0.05;
        const rgb = hsvToRgb(hue, sat, val);
        regionColors[i * 3] = rgb[0];
        regionColors[i * 3 + 1] = rgb[1];
        regionColors[i * 3 + 2] = rgb[2];
    }

    // Upscale to full resolution
    const regionData = new Uint8Array(width * height * 4);
    const boundaryData = new Uint8Array(width * height * 4);
    const debugData = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
        const sy = Math.max(0, Math.min(sh - 1, Math.floor((y + 0.5) * sh / height)));
        for (let x = 0; x < width; x++) {
            const sx = Math.max(0, Math.min(sw - 1, Math.floor((x + 0.5) * sw / width)));
            const sk = idx(sx, sy, sw);
            const label = outLabels[sk];
            const o = (y * width + x) * 4;

            // Region ID (2 bytes)
            regionData[o] = label & 255;
            regionData[o + 1] = (label >> 8) & 255;
            regionData[o + 2] = 0;
            regionData[o + 3] = 255;

            // Soft boundary
            const sb = Math.round(clamp01(softBoundary[sk]) * 255);
            boundaryData[o] = sb;
            boundaryData[o + 1] = 0;
            boundaryData[o + 2] = 0;
            boundaryData[o + 3] = 255;

            // Debug: colored regions with dark outlines
            if (hard[sk]) {
                debugData[o] = 25;
                debugData[o + 1] = 25;
                debugData[o + 2] = 25;
            } else {
                debugData[o] = regionColors[label * 3];
                debugData[o + 1] = regionColors[label * 3 + 1];
                debugData[o + 2] = regionColors[label * 3 + 2];
            }
            debugData[o + 3] = 255;
        }
    }

    return { regionData, boundaryData, debugData };
}

function hsvToRgb(h, s, v) {
    const h6 = h * 6;
    const fi = Math.floor(h6);
    const f = h6 - fi;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));
    let r, g, b;
    switch (fi % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        default: r = v; g = p; b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ---- public API ----

export function createSectionHierarchy(imageData, width, height, opts = {}) {
    const edgeDetail = clamp01(opts.edgeDetail ?? 0.62);
    const base = buildBasePartition(imageData, width, height, edgeDetail);
    return { base, width, height };
}

export function getSectionTexturesFromHierarchy(hierarchy, opts = {}) {
    const simplification = clamp01(opts.simplification ?? 0.35);
    const boundaryLeakage = clamp01(opts.boundaryLeakage ?? 0.18);
    return renderLevel(hierarchy.base, hierarchy.width, hierarchy.height, simplification, boundaryLeakage);
}
