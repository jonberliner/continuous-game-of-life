/**
 * Main application orchestration - supports Spatial and Frequency modes
 */

import { CoreV1Engine } from './core/coreV1Engine.js';
import { FrequencyGoLEngine } from './core/frequencyEngine.js';
import { loadImage, createDefaultImage } from './render/imageLoader.js';
import { ControlsManager } from './ui/controls.js';

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

class AutoTuner {
    constructor() {
        this.stepAccum = 0;
        this.intervalSimSteps = 96;
        this.prevSample = null;
        this.prevDeltaL = null;
        this.prevDeltaC = null;
        this.ema = null;
        this.lastText = '';

        this.allOptimizeKeys = [
            'kernelWidth',
            'innerFraction',
            'radialFalloff',
            'birthCenter',
            'birthWidth',
            'survivalCenter',
            'survivalWidth',
            'transWidth',
            'lifeRateBase',
            'actSurvivalCeilShift',
            'perturbMag',
            'noiseLMag',
            'structuredNoise',
            'colorRateBase',
            'patternCoupling',
            'adoptPeak',
            'fortifyScale',
            'barrierColorDamp',
            'sourceColorAdherence',
            'anchorPullRate',
            'transWidthFloor',
            'aliveEdgeLow',
            'aliveEdgeHigh',
            'colorRateActScale',
            'adoptOnset',
            'adoptFalloff',
            'barrierColorMix',
            'confColorBoost',
            'survivalBarrierBoost',
            'homeoDeadOnset',
            'homeoDeadPeak',
            'homeoBirthShift',
            'homeoBirthCeilShift',
            'homeoSurvivalFloorShift',
            'preActLumScale',
            'preActColorScale',
            'lGateOnset',
            'lGatePeak',
            'wavefrontBoost',
            'anchorBaseStr',
            'anchorBarrierScale',
            'sourcePixelMix',
            'edgeAttenuation',
            'noisePersistence'
        ];
        this.optimizeChunkSize = 20;
        this.chunkOffset = 0;
        this.activeOptimizeKeys = [];
        this.populationSize = 6;
        this.eliteCount = 2;
        this.evalTicksPerCandidate = 4;
        this.cemMean = null;
        this.cemStd = null;
        this.candidates = [];
        this.candidateIndex = 0;
        this.ticksOnCandidate = 0;
        this.scoreAccum = 0;
        this.candidateScores = [];
        this.generation = 0;
        this.weightDriftOffsets = null;
        this.uniformPersist = null;
        this.deadPersist = null;
        this.sampleW = 0;
        this.sampleH = 0;
        this.keyStats = {};
        this.frozenKeys = new Set();
        this.lowHealthGenerations = 0;
        this.lastHealth = 0;
        this.rotateChunkNextGeneration = true;
        this.chunkBestScore = -Infinity;
        this.chunkNoImproveCount = 0;
        this.chunkGenerationsOnSet = 0;
        this.chunkPatienceGenerations = 3;
        this.chunkMinGenerations = 2;
        this.chunkImproveEpsilon = 0.012;
    }

    reset() {
        this.stepAccum = 0;
        this.prevSample = null;
        this.prevDeltaL = null;
        this.prevDeltaC = null;
        this.ema = null;
        this.cemMean = null;
        this.cemStd = null;
        this.candidates = [];
        this.candidateIndex = 0;
        this.ticksOnCandidate = 0;
        this.scoreAccum = 0;
        this.candidateScores = [];
        this.generation = 0;
        this.chunkOffset = 0;
        this.activeOptimizeKeys = [];
        this.weightDriftOffsets = null;
        this.uniformPersist = null;
        this.deadPersist = null;
        this.sampleW = 0;
        this.sampleH = 0;
        this.keyStats = {};
        this.frozenKeys = new Set();
        this.lowHealthGenerations = 0;
        this.lastHealth = 0;
        this.rotateChunkNextGeneration = true;
        this.chunkBestScore = -Infinity;
        this.chunkNoImproveCount = 0;
        this.chunkGenerationsOnSet = 0;
    }

    tick({ mode, engine, controls, params, imageData, simStepsAdvanced }) {
        if (!controls) return;
        if (!params.autoTuneEnabled) {
            controls.setAutoTuneStatsText('Auto Tune disabled.');
            controls.setAutoTuneKnobScoresText('Knob scores will appear when Auto Tune runs.');
            return;
        }
        if (mode !== 'spatial' || typeof engine.readCurrentStatePixels !== 'function') {
            controls.setAutoTuneStatsText('Auto Tune: spatial mode only.');
            return;
        }
        this.stepAccum += Math.max(0, simStepsAdvanced || 0);
        if (this.stepAccum < this.intervalSimSteps) return;
        this.stepAccum -= this.intervalSimSteps;

        const pixels = engine.readCurrentStatePixels();
        const metrics = this.computeMetrics(pixels, engine.width, engine.height, imageData);
        if (!metrics) {
            controls.setAutoTuneStatsText('Auto Tune: warming up metrics...');
            return;
        }
        const smooth = this.smoothMetrics(metrics);
        this.ensureCemInitialized(params, controls);
        if (!this.candidates.length) {
            this.beginGeneration(params, controls);
        }
        const health = this.computeHealth(smooth, params, this.getEffectiveWeights(params));
        const catastrophic = smooth.deadImmediateRatio > 0.88 || smooth.meanLum < 0.05;
        const effectiveHealth = catastrophic ? health * 0.05 : health;
        this.scoreAccum += effectiveHealth;
        this.ticksOnCandidate++;
        if (this.ticksOnCandidate >= this.evalTicksPerCandidate) {
            const avgScore = this.scoreAccum / this.ticksOnCandidate;
            this.candidateScores.push({ score: avgScore, candidate: this.candidates[this.candidateIndex] });
            this.advanceCandidateOrGeneration(params, controls);
        }

        const active = this.candidates[this.candidateIndex];
        const activeLabel = active ? `${this.candidateIndex + 1}/${this.candidates.length}` : 'n/a';
        const text =
            `Health ${(health * 100).toFixed(0)} | ` +
            `act ${smooth.activity.toFixed(3)} | ` +
            `pat ${smooth.pattern.toFixed(3)} | ` +
            `color ${smooth.colorChange.toFixed(3)} | ` +
            `dead ${(smooth.deadRatio * 100).toFixed(0)}% | ` +
            `blk ${(smooth.deadImmediateRatio * 100).toFixed(0)}% | ` +
            `uni ${(smooth.uniformRatio * 100).toFixed(0)}% | ` +
            `flick ${(smooth.flicker * 100).toFixed(0)}% | ` +
            `srcΔ ${smooth.sourceDist.toFixed(3)} | ` +
            `CEM g${this.generation} c${activeLabel} k${this.activeOptimizeKeys.length}`;
        if (text !== this.lastText) {
            this.lastText = text;
            controls.setAutoTuneStatsText(text);
        }
        controls.setAutoTuneKnobScoresText(this.renderKnobScores());
    }

    computeMetrics(pixels, width, height, imageData) {
        const stride = Math.max(4, Math.floor(Math.min(width, height) / 80));
        const sw = Math.max(2, Math.floor(width / stride));
        const sh = Math.max(2, Math.floor(height / stride));
        const n = sw * sh;
        this.sampleW = sw;
        this.sampleH = sh;
        const lum = new Float32Array(n);
        const rgb = new Float32Array(n * 3);
        const src = new Float32Array(n * 3);

        let k = 0;
        const srcData = imageData.imageData.data;
        for (let y = 0; y < sh; y++) {
            const py = Math.min(height - 1, y * stride);
            const pySrc = height - 1 - py; // readPixels is bottom-up
            for (let x = 0; x < sw; x++) {
                const px = Math.min(width - 1, x * stride);
                const i = (py * width + px) * 4;
                const r = pixels[i] / 255;
                const g = pixels[i + 1] / 255;
                const b = pixels[i + 2] / 255;
                rgb[k * 3] = r;
                rgb[k * 3 + 1] = g;
                rgb[k * 3 + 2] = b;
                lum[k] = 0.299 * r + 0.587 * g + 0.114 * b;

                const is = (pySrc * width + px) * 4;
                src[k * 3] = srcData[is] / 255;
                src[k * 3 + 1] = srcData[is + 1] / 255;
                src[k * 3 + 2] = srcData[is + 2] / 255;
                k++;
            }
        }

        if (!this.prevSample) {
            this.prevSample = { lum, rgb };
            this.prevDeltaL = new Float32Array(n);
            this.prevDeltaC = new Float32Array(n);
            this.uniformPersist = new Float32Array(n);
            this.deadPersist = new Float32Array(n);
            return null;
        }

        let activity = 0;
        let colorChange = 0;
        let dead = 0;
        let deadImmediate = 0;
        let flicker = 0;
        let sourceDist = 0;
        let gradFine = 0;
        let gradCoarse = 0;
        let gradCount = 0;
        const orientBins = new Float32Array(8);
        let uniform = 0;
        let deadStuck = 0;
        let chromaGrad = 0;
        let chromaCount = 0;
        const deltaL = new Float32Array(n);
        const deltaC = new Float32Array(n);

        for (let i = 0; i < n; i++) {
            const lNow = lum[i];
            const dl = lNow - this.prevSample.lum[i];
            const adl = Math.abs(dl);
            deltaL[i] = dl;
            activity += adl;
            if (lNow < 0.09) deadImmediate++;

            const dr = Math.abs(rgb[i * 3] - this.prevSample.rgb[i * 3]);
            const dg = Math.abs(rgb[i * 3 + 1] - this.prevSample.rgb[i * 3 + 1]);
            const db = Math.abs(rgb[i * 3 + 2] - this.prevSample.rgb[i * 3 + 2]);
            const dc = (dr + dg + db) / 3.0;
            deltaC[i] = dc;
            colorChange += dc;

            const sdr = Math.abs(rgb[i * 3] - src[i * 3]);
            const sdg = Math.abs(rgb[i * 3 + 1] - src[i * 3 + 1]);
            const sdb = Math.abs(rgb[i * 3 + 2] - src[i * 3 + 2]);
            sourceDist += (sdr + sdg + sdb) / 3.0;

            const prevDl = this.prevDeltaL[i];
            const prevDc = this.prevDeltaC[i];
            if ((adl > 0.01 && Math.abs(prevDl) > 0.01 && dl * prevDl < 0) ||
                (dc > 0.01 && Math.abs(prevDc) > 0.01 && (dc - prevDc) * prevDc < 0)) {
                flicker++;
            }
        }

        for (let y = 1; y < sh - 1; y++) {
            for (let x = 1; x < sw - 1; x++) {
                const i = y * sw + x;
                const gx = lum[i + 1] - lum[i - 1];
                const gy = lum[i + sw] - lum[i - sw];
                const mag = Math.sqrt(gx * gx + gy * gy);
                gradFine += mag;
                let cMag = 0.0;
                if (x > 1 && x < sw - 2 && y > 1 && y < sh - 2) {
                    const gcx = lum[i + 2] - lum[i - 2];
                    const gcy = lum[i + 2 * sw] - lum[i - 2 * sw];
                    cMag = Math.sqrt(gcx * gcx + gcy * gcy);
                    gradCoarse += cMag;
                }
                gradCount++;
                if (mag > 1.0e-4) {
                    const ang = Math.atan2(gy, gx);
                    let bin = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 8.0);
                    if (bin < 0) bin = 0;
                    if (bin > 7) bin = 7;
                    orientBins[bin] += mag;
                }

                const localVar =
                    Math.abs(lum[i] - lum[i + 1]) +
                    Math.abs(lum[i] - lum[i - 1]) +
                    Math.abs(lum[i] - lum[i + sw]) +
                    Math.abs(lum[i] - lum[i - sw]);
                const staticish = Math.abs(deltaL[i]) < 0.003 && deltaC[i] < 0.003;
                const uniformNow = localVar < 0.04 && staticish;
                this.uniformPersist[i] = uniformNow ? Math.min(255, this.uniformPersist[i] + 1) : 0;
                if (this.uniformPersist[i] > 3) uniform++;

                const r = rgb[i * 3];
                const g = rgb[i * 3 + 1];
                const b = rgb[i * 3 + 2];
                const maxc = Math.max(r, g, b);
                const minc = Math.min(r, g, b);
                const sat = maxc > 1.0e-5 ? (maxc - minc) / maxc : 0.0;
                const deadNow = lum[i] < 0.09 || (sat > 0.65 && staticish);
                this.deadPersist[i] = deadNow ? Math.min(255, this.deadPersist[i] + 1) : 0;
                if (this.deadPersist[i] > 3) dead++;
                if (this.deadPersist[i] > 6) deadStuck++;

                const rgx = rgb[(i + 1) * 3] - rgb[(i - 1) * 3];
                const rgy = rgb[(i + sw) * 3] - rgb[(i - sw) * 3];
                const ggx = rgb[(i + 1) * 3 + 1] - rgb[(i - 1) * 3 + 1];
                const ggy = rgb[(i + sw) * 3 + 1] - rgb[(i - sw) * 3 + 1];
                const bgx = rgb[(i + 1) * 3 + 2] - rgb[(i - 1) * 3 + 2];
                const bgy = rgb[(i + sw) * 3 + 2] - rgb[(i - sw) * 3 + 2];
                chromaGrad += Math.sqrt(rgx * rgx + rgy * rgy + ggx * ggx + ggy * ggy + bgx * bgx + bgy * bgy) / Math.sqrt(6.0);
                chromaCount++;
            }
        }

        this.prevSample = { lum, rgb };
        this.prevDeltaL = deltaL;
        this.prevDeltaC = deltaC;

        let orientEntropy = 0;
        let orientSum = 0;
        for (let i = 0; i < 8; i++) orientSum += orientBins[i];
        if (orientSum > 1.0e-6) {
            for (let i = 0; i < 8; i++) {
                const p = orientBins[i] / orientSum;
                if (p > 1.0e-6) orientEntropy -= p * Math.log(p);
            }
            orientEntropy /= Math.log(8);
        }
        const fine = gradCount > 0 ? gradFine / gradCount : 0;
        const coarse = gradCount > 0 ? gradCoarse / gradCount : 0;
        const scaleDiv = 1.0 - clamp01(Math.abs(fine - coarse) / 0.08);
        const pattern = clamp01(0.5 * clamp01((fine - 0.02) / 0.10) + 0.25 * orientEntropy + 0.25 * scaleDiv);
        const colorStruct = clamp01((chromaCount > 0 ? chromaGrad / chromaCount : 0) / 0.20);

        return {
            activity: activity / n,
            colorChange: colorChange / n,
            deadRatio: dead / n,
            deadImmediateRatio: deadImmediate / n,
            deadStuckRatio: deadStuck / n,
            flicker: flicker / n,
            sourceDist: sourceDist / n,
            pattern,
            uniformRatio: uniform / n,
            colorStruct,
            meanLum: lum.reduce((a, b) => a + b, 0) / n
        };
    }

    smoothMetrics(m) {
        if (!this.ema) {
            this.ema = { ...m };
            return this.ema;
        }
        const a = 0.28;
        for (const key of Object.keys(m)) {
            this.ema[key] = this.ema[key] * (1 - a) + m[key] * a;
        }
        return this.ema;
    }

    computeHealth(m, params, weights) {
        const motionBand = 1.0 - clamp01(Math.abs(m.activity - 0.022) / 0.020);
        const patternScore = m.pattern;
        const colorStructScore = 1.0 - clamp01(Math.abs(m.colorStruct - 0.50) / 0.45);
        const colorChangeBand = 1.0 - clamp01(Math.abs(m.colorChange - 0.020) / 0.020);
        const flickerPenalty = clamp01((m.flicker - 0.30) / 0.28);
        const uniformPenalty = clamp01((m.uniformRatio - 0.20) / 0.35);
        const deadPenalty =
            clamp01((m.deadRatio - 0.28) / 0.30) * 0.45 +
            clamp01((m.deadStuckRatio - 0.18) / 0.30) * 0.25 +
            clamp01((m.deadImmediateRatio - 0.45) / 0.40) * 0.20 +
            clamp01((0.20 - m.meanLum) / 0.18) * 0.10;
        const srcTarget = 0.22 - params.sourceColorAdherence * 0.14;
        const sourceScore = 1.0 - clamp01(Math.abs(m.sourceDist - srcTarget) / 0.14);

        const reward =
            weights.motion * motionBand +
            weights.pattern * patternScore +
            weights.colorStruct * colorStructScore +
            weights.colorChange * colorChangeBand +
            weights.source * sourceScore;
        const penalty =
            weights.flicker * flickerPenalty +
            weights.uniform * uniformPenalty +
            weights.dead * deadPenalty;
        const rewardDenom = weights.motion + weights.pattern + weights.colorStruct + weights.colorChange + weights.source + 1e-6;
        const penaltyDenom = weights.flicker + weights.uniform + weights.dead + 1e-6;
        const rewardNorm = reward / rewardDenom;
        const penaltyNorm = penalty / penaltyDenom;
        // Avoid score flattening while strongly penalizing static/black collapse.
        const motionPenalty = clamp01((0.006 - m.activity) / 0.006);
        const colorStallPenalty = clamp01((0.004 - m.colorChange) / 0.004);
        return clamp01(rewardNorm - 0.90 * penaltyNorm - 0.45 * motionPenalty - 0.35 * colorStallPenalty + 0.35);
    }

    ensureCemInitialized(params, controls) {
        if (this.cemMean && this.cemStd) return;
        this.cemMean = {};
        this.cemStd = {};
        for (const key of this.allOptimizeKeys) {
            const v = this.getKeyValue(key, params);
            if (typeof v !== 'number' || Number.isNaN(v)) continue;
            const bounds = this.getKeyBounds(key, params, controls) || { min: v - 1, max: v + 1 };
            const span = Math.max(1e-6, bounds.max - bounds.min);
            this.cemMean[key] = v;
            this.cemStd[key] = span * 0.08;
        }
    }

    beginGeneration(params, controls) {
        this.generation++;
        this.refreshWeightDrift(params);
        this.applyKnobDrift(params, controls);
        if (this.rotateChunkNextGeneration || this.activeOptimizeKeys.length === 0) {
            this.selectActiveKeyChunk();
            this.rotateChunkNextGeneration = false;
            this.chunkBestScore = -Infinity;
            this.chunkNoImproveCount = 0;
            this.chunkGenerationsOnSet = 0;
        }
        this.candidates = [];
        for (let i = 0; i < this.populationSize; i++) {
            const c = {};
            for (const key of this.activeOptimizeKeys) {
                if (!(key in this.cemMean)) continue;
                if (i === 0) {
                    c[key] = this.cemMean[key];
                    continue;
                }
                const sample = this.cemMean[key] + this.randn() * this.cemStd[key];
                const b = this.getKeyBounds(key, params, controls);
                c[key] = b ? Math.max(b.min, Math.min(b.max, sample)) : sample;
            }
            this.candidates.push(c);
        }
        this.candidateScores = [];
        this.candidateIndex = 0;
        this.ticksOnCandidate = 0;
        this.scoreAccum = 0;
        this.applyCandidate(this.candidates[0], controls);
    }

    applyCandidate(candidate, controls) {
        for (const key of Object.keys(candidate)) {
            if (key === 'birthCenter' || key === 'birthWidth' || key === 'survivalCenter' || key === 'survivalWidth') {
                continue;
            }
            controls.setParam(key, candidate[key], false);
        }
        if ('birthCenter' in candidate || 'birthWidth' in candidate) {
            const center = 'birthCenter' in candidate ? candidate.birthCenter : controls.getParams().birthFloor * 0.5 + controls.getParams().birthCeiling * 0.5;
            const width = 'birthWidth' in candidate ? candidate.birthWidth : Math.max(0.01, controls.getParams().birthCeiling - controls.getParams().birthFloor);
            const floor = Math.max(0.0, center - width * 0.5);
            const ceil = Math.min(1.0, center + width * 0.5);
            controls.setParam('birthFloor', floor, false);
            controls.setParam('birthCeiling', ceil, false);
        }
        if ('survivalCenter' in candidate || 'survivalWidth' in candidate) {
            const center = 'survivalCenter' in candidate ? candidate.survivalCenter : controls.getParams().survivalFloor * 0.5 + controls.getParams().survivalCeiling * 0.5;
            const width = 'survivalWidth' in candidate ? candidate.survivalWidth : Math.max(0.01, controls.getParams().survivalCeiling - controls.getParams().survivalFloor);
            const floor = Math.max(0.0, center - width * 0.5);
            const ceil = Math.min(1.0, center + width * 0.5);
            controls.setParam('survivalFloor', floor, false);
            controls.setParam('survivalCeiling', ceil, false);
        }
        controls.emitParamsChanged();
    }

    advanceCandidateOrGeneration(params, controls) {
        this.candidateIndex++;
        this.ticksOnCandidate = 0;
        this.scoreAccum = 0;
        if (this.candidateIndex < this.candidates.length) {
            this.applyCandidate(this.candidates[this.candidateIndex], controls);
            return;
        }

        const influences = this.computeKeyInfluences(this.activeOptimizeKeys, this.candidateScores);
        const keyScores = this.computeKeyScores(this.activeOptimizeKeys, this.candidateScores);
        this.candidateScores.sort((a, b) => b.score - a.score);
        const elites = this.candidateScores.slice(0, this.eliteCount);
        const bestScore = this.candidateScores[0]?.score ?? 0;
        this.lastHealth = bestScore;
        for (const key of this.activeOptimizeKeys) {
            if (!(key in this.cemMean)) continue;
            let mean = 0;
            for (const e of elites) mean += e.candidate[key];
            mean /= Math.max(1, elites.length);
            let variance = 0;
            for (const e of elites) {
                const d = e.candidate[key] - mean;
                variance += d * d;
            }
            variance /= Math.max(1, elites.length);
            const eliteStd = Math.sqrt(Math.max(1e-8, variance));
            this.cemMean[key] = mean;
            this.cemStd[key] = this.cemStd[key] * 0.65 + eliteStd * 0.35;
            const b = this.getKeyBounds(key, params, controls);
            if (b) {
                this.cemMean[key] = Math.max(b.min, Math.min(b.max, this.cemMean[key]));
                const minStd = (b.max - b.min) * 0.005;
                const maxStd = (b.max - b.min) * 0.25;
                this.cemStd[key] = Math.max(minStd, Math.min(maxStd, this.cemStd[key]));
            }
            this.updateKeyStats(key, keyScores[key] ?? bestScore, b, influences[key] ?? 0);
        }

        // Adaptive freeze/unfreeze: lock consistently high-confidence knobs,
        // but release some if health degrades for multiple generations.
        for (const key of this.activeOptimizeKeys) {
            const st = this.keyStats[key];
            if (!st) continue;
            if (st.confidence > 0.78 && st.score > 0.60) this.frozenKeys.add(key);
        }
        if (bestScore < 0.28) this.lowHealthGenerations++;
        else this.lowHealthGenerations = 0;
        if (this.lowHealthGenerations >= 3 && this.frozenKeys.size > 0) {
            const frozenRanked = Array.from(this.frozenKeys)
                .map((k) => ({ key: k, conf: this.keyStats[k]?.confidence ?? 0 }))
                .sort((a, b) => a.conf - b.conf);
            const release = Math.max(1, Math.floor(frozenRanked.length / 3));
            for (let i = 0; i < release; i++) this.frozenKeys.delete(frozenRanked[i].key);
            this.lowHealthGenerations = 0;
        }

        this.chunkGenerationsOnSet++;
        if (bestScore > this.chunkBestScore + this.chunkImproveEpsilon) {
            this.chunkBestScore = bestScore;
            this.chunkNoImproveCount = 0;
        } else {
            this.chunkNoImproveCount++;
        }
        if (this.chunkGenerationsOnSet >= this.chunkMinGenerations &&
            this.chunkNoImproveCount >= this.chunkPatienceGenerations) {
            this.rotateChunkNextGeneration = true;
        }

        const best = this.candidateScores[0]?.candidate;
        if (best) this.applyCandidate(best, controls);
        this.candidates = [];
    }

    selectActiveKeyChunk() {
        let available = this.allOptimizeKeys.filter((k, i, arr) => arr.indexOf(k) === i && (k in this.cemMean) && !this.frozenKeys.has(k));
        if (!available.length) {
            // If everything is frozen, unfreeze the lowest-confidence half.
            const ranked = this.allOptimizeKeys
                .filter((k) => k in this.cemMean)
                .map((k) => ({ key: k, conf: this.keyStats[k]?.confidence ?? 0 }))
                .sort((a, b) => a.conf - b.conf);
            const toUnfreeze = Math.max(1, Math.floor(ranked.length / 2));
            for (let i = 0; i < toUnfreeze; i++) this.frozenKeys.delete(ranked[i].key);
            available = this.allOptimizeKeys.filter((k, i, arr) => arr.indexOf(k) === i && (k in this.cemMean) && !this.frozenKeys.has(k));
        }
        if (!available.length) {
            this.activeOptimizeKeys = [];
            return;
        }
        const chunk = [];
        const start = this.chunkOffset % available.length;
        for (let i = 0; i < Math.min(this.optimizeChunkSize, available.length); i++) {
            chunk.push(available[(start + i) % available.length]);
        }
        this.activeOptimizeKeys = chunk;
        this.chunkOffset = (start + this.optimizeChunkSize) % available.length;
    }

    getKeyValue(key, params) {
        if (key === 'birthCenter') return (params.birthFloor + params.birthCeiling) * 0.5;
        if (key === 'birthWidth') return Math.max(0.01, params.birthCeiling - params.birthFloor);
        if (key === 'survivalCenter') return (params.survivalFloor + params.survivalCeiling) * 0.5;
        if (key === 'survivalWidth') return Math.max(0.01, params.survivalCeiling - params.survivalFloor);
        return params[key];
    }

    getKeyBounds(key, params, controls) {
        if (key === 'birthCenter') return { min: 0.12, max: 0.62 };
        if (key === 'birthWidth') return { min: 0.06, max: 0.34 };
        if (key === 'survivalCenter') return { min: 0.16, max: 0.70 };
        if (key === 'survivalWidth') return { min: 0.08, max: 0.42 };
        return controls.getParamBounds(key);
    }

    updateKeyStats(key, score, bounds, influence) {
        if (!bounds) return;
        const span = Math.max(1e-6, bounds.max - bounds.min);
        const normStd = clamp01(this.cemStd[key] / span);
        const confidence = clamp01(1.0 - normStd);
        const prev = this.keyStats[key] || { score: 0, confidence: 0, influence: 0, updates: 0 };
        const a = 0.25;
        this.keyStats[key] = {
            score: prev.score * (1 - a) + score * a,
            confidence: prev.confidence * (1 - a) + confidence * a,
            influence: prev.influence * (1 - a) + clamp01(Math.abs(influence)) * a,
            updates: prev.updates + 1
        };
    }

    computeKeyInfluences(keys, scoredCandidates) {
        const out = {};
        if (!scoredCandidates || scoredCandidates.length < 3) return out;
        const ys = scoredCandidates.map((s) => s.score);
        const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
        const yVar = ys.reduce((a, b) => a + (b - yMean) * (b - yMean), 0);
        if (yVar < 1e-10) return out;
        for (const key of keys) {
            const xs = scoredCandidates.map((s) => s.candidate[key] ?? 0);
            const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
            let cov = 0;
            let xVar = 0;
            for (let i = 0; i < xs.length; i++) {
                const dx = xs[i] - xMean;
                const dy = ys[i] - yMean;
                cov += dx * dy;
                xVar += dx * dx;
            }
            if (xVar < 1e-10) {
                out[key] = 0;
                continue;
            }
            out[key] = cov / Math.sqrt(xVar * yVar);
        }
        return out;
    }

    computeKeyScores(keys, scoredCandidates) {
        const out = {};
        if (!scoredCandidates || scoredCandidates.length < 4) return out;
        const ys = scoredCandidates.map((s) => s.score);
        const yMin = Math.min(...ys);
        const yMax = Math.max(...ys);
        const ySpan = Math.max(1e-6, yMax - yMin);
        for (const key of keys) {
            const pairs = scoredCandidates
                .map((s) => ({ x: s.candidate[key], y: s.score }))
                .filter((p) => typeof p.x === 'number' && !Number.isNaN(p.x));
            if (pairs.length < 4) {
                out[key] = 0.5;
                continue;
            }
            pairs.sort((a, b) => a.x - b.x);
            const bucket = Math.max(1, Math.floor(pairs.length / 3));
            const low = pairs.slice(0, bucket);
            const high = pairs.slice(pairs.length - bucket);
            const lowScore = low.reduce((a, p) => a + p.y, 0) / low.length;
            const highScore = high.reduce((a, p) => a + p.y, 0) / high.length;
            // If changing this key correlates with better outcomes, score rises above 0.5.
            out[key] = clamp01(0.5 + 0.5 * ((highScore - lowScore) / ySpan));
        }
        return out;
    }

    applyKnobDrift(params, controls) {
        if (!params.autoTuneWeightDriftEnabled) return;
        const amt = Math.max(0, Math.min(0.5, params.autoTuneWeightDrift));
        if (amt <= 0) return;
        const driftScale = amt * 0.20;
        for (const key of this.allOptimizeKeys) {
            if (!(key in this.cemMean) || this.frozenKeys.has(key)) continue;
            const b = this.getKeyBounds(key, params, controls);
            if (!b) continue;
            const span = Math.max(1e-6, b.max - b.min);
            const jitter = this.randn() * span * driftScale;
            this.cemMean[key] = Math.max(b.min, Math.min(b.max, this.cemMean[key] + jitter));
        }
    }

    renderKnobScores() {
        const rows = [];
        for (const key of Object.keys(this.cemMean || {})) {
            const st = this.keyStats[key] || { score: 0, confidence: 0, updates: 0 };
            rows.push({
                key,
                score: st.score,
                conf: st.confidence,
                updates: st.updates,
                frozen: this.frozenKeys.has(key),
                active: this.activeOptimizeKeys.includes(key)
            });
        }
        rows.sort((a, b) => b.score - a.score);
        const top = rows.slice(0, 40);
        const lines = top.map((r) =>
            `${r.frozen ? 'F' : (r.active ? 'A' : ' ')} ${r.key.padEnd(24)} score ${r.score.toFixed(3)} conf ${r.conf.toFixed(2)} infl ${(this.keyStats[r.key]?.influence ?? 0).toFixed(2)} n${r.updates}`
        );
        const header = `Knob Scores (F=frozen, A=active) | frozen ${this.frozenKeys.size} / ${rows.length}`;
        return `${header}\n${lines.join('\n')}`;
    }

    getEffectiveWeights(params) {
        const base = {
            motion: Math.max(0, params.healthWMotion),
            pattern: Math.max(0, params.healthWPattern),
            colorStruct: Math.max(0, params.healthWColorStruct),
            colorChange: Math.max(0, params.healthWColorChange),
            flicker: Math.max(0, params.healthWFlicker),
            uniform: Math.max(0, params.healthWUniform),
            dead: Math.max(0, params.healthWDead),
            source: Math.max(0, params.healthWSource)
        };
        const keys = Object.keys(base);
        if (params.autoTuneWeightDriftEnabled && this.weightDriftOffsets) {
            for (const k of keys) {
                base[k] = Math.max(0, base[k] * (1 + this.weightDriftOffsets[k]));
            }
        }
        return base;
    }

    refreshWeightDrift(params) {
        if (!params.autoTuneWeightDriftEnabled) {
            this.weightDriftOffsets = null;
            return;
        }
        const amt = Math.max(0, Math.min(0.5, params.autoTuneWeightDrift));
        this.weightDriftOffsets = {
            motion: (Math.random() * 2 - 1) * amt,
            pattern: (Math.random() * 2 - 1) * amt,
            colorStruct: (Math.random() * 2 - 1) * amt,
            colorChange: (Math.random() * 2 - 1) * amt,
            flicker: (Math.random() * 2 - 1) * amt,
            uniform: (Math.random() * 2 - 1) * amt,
            dead: (Math.random() * 2 - 1) * amt,
            source: (Math.random() * 2 - 1) * amt
        };
    }

    randn() {
        let u = 0;
        let v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
}

class ContinuousGameOfLife {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.engine = null;
        this.mode = 'spatial'; // 'spatial' or 'frequency'
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        
        this.imageData = null;
        this.simAccumulator = 0;
        this.fixedSimulationDelta = 0.2; // Keep simulation dynamics stable; speed controls rate only.
        this.autoTuner = new AutoTuner();
        
        this.init();
    }
    
    async init() {
        // Create default image
        const defaultImg = createDefaultImage(512, 512);
        this.imageData = defaultImg;
        
        // Initialize canvas and engine
        this.setupCanvas();
        this.createEngine();
        
        // Setup controls
        this.controls = new ControlsManager(
            (params) => this.onParamChange(params),
            (file) => this.onImageUpload(file),
            () => this.togglePause(),
            () => this.reset(),
            (mode) => this.switchMode(mode)  // New: mode switcher
        );
        this.updatePipelineStatus(this.controls.getParams());
        
        // Start animation
        this.start();
    }
    
    setupCanvas() {
        this.canvas.width = this.imageData.width;
        this.canvas.height = this.imageData.height;
    }
    
    createEngine() {
        if (this.engine) {
            this.engine.destroy();
        }
        
        if (this.mode === 'spatial') {
            this.engine = new CoreV1Engine(
                this.canvas,
                this.imageData.width,
                this.imageData.height,
                this.imageData.imageData
            );
        } else {
            this.engine = new FrequencyGoLEngine(
                this.canvas,
                this.imageData.width,
                this.imageData.height,
                this.imageData.imageData,
                false // Don't recreate canvas
            );
        }
        this.autoTuner.reset();
    }
    
    switchMode(mode) {
        if (mode === this.mode) return;
        
        const wasRunning = this.isRunning;
        this.stop();
        
        this.mode = mode;
        
        // When switching modes, we DO need to recreate the canvas
        this.recreateCanvasForMode(mode);
        this.createEngine();
        
        // Re-fetch canvas reference
        this.canvas = document.getElementById('glCanvas');
        
        if (wasRunning) {
            this.start();
        } else {
            this.engine.render();
        }
        this.updatePipelineStatus(this.controls ? this.controls.getParams() : null);
    }
    
    recreateCanvasForMode(mode) {
        const parent = this.canvas.parentElement;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        if (!parent) {
            throw new Error('Canvas has no parent element');
        }
        
        // Remove old canvas
        this.canvas.remove();
        
        // Create new canvas
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'glCanvas';
        newCanvas.width = canvasWidth;
        newCanvas.height = canvasHeight;
        parent.appendChild(newCanvas);
        
        this.canvas = newCanvas;
    }
    
    async onImageUpload(file) {
        try {
            const wasRunning = this.isRunning;
            this.stop();
            
            const loadedImage = await loadImage(file);
            this.imageData = loadedImage;
            
            this.setupCanvas();
            this.createEngine();
            
            if (wasRunning) {
                this.start();
            } else {
                this.engine.render();
            }
        } catch (error) {
            console.error('Failed to load image:', error);
            alert('Failed to load image. Please try another file.');
        }
    }
    
    onParamChange(params) {
        this.updatePipelineStatus(params);
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        this.controls.updatePauseButton(this.isPaused);
    }
    
    reset() {
        const wasRunning = this.isRunning;
        this.stop();
        
        this.engine.reset();
        this.simAccumulator = 0;
        this.engine.render();
        
        if (wasRunning) {
            this.start();
        }
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.controls.updatePauseButton(false);
        this.animate();
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    animate() {
        if (!this.isRunning) return;
        
        if (!this.isPaused) {
            const params = this.controls.getParams();
            this.updatePipelineStatus(params);
            // Logarithmic time scale: slider [0,1] maps to simRate via 10^(s*3.3 - 2)
            //   0.00 → 0.01 steps/frame  (1 step every ~2s at 60fps — watch individual steps)
            //   0.50 → ~0.45 steps/frame  (~27 steps/sec — slow contemplation)
            //   0.65 → ~1.4  steps/frame  (~84 steps/sec — current default feel)
            //   1.00 → ~20   steps/frame  (~1200 steps/sec — 10x current max)
            let simRate = Math.pow(10, params.deltaTime * 3.3 - 2.0);
            if (params.coreMinimalMode) {
                // Core debugging mode should never appear frozen from under-stepping.
                simRate = Math.max(simRate, 0.6);
            }
            const autoTuneTurboFactor = params.autoTuneEnabled ? 4.0 : 1.0;
            this.simAccumulator += simRate * autoTuneTurboFactor;

            const stepParams = {
                ...params,
                deltaTime: this.fixedSimulationDelta
            };

            let steps = 0;
            const maxStepsPerFrame = params.autoTuneEnabled ? 120 : 20;
            while (this.simAccumulator >= 1.0 && steps < maxStepsPerFrame) {
                this.engine.step(stepParams);
                this.simAccumulator -= 1.0;
                steps++;
            }

            this.engine.render();
            this.autoTuner.tick({
                mode: this.mode,
                engine: this.engine,
                controls: this.controls,
                params,
                imageData: this.imageData,
                simStepsAdvanced: steps
            });
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    updatePipelineStatus(params) {
        if (!this.controls || typeof this.controls.setPipelineStatusText !== 'function') return;
        const modeLabel = this.mode === 'spatial' ? 'Spatial' : 'Frequency';
        const stackLabel = params && params.coreMinimalMode ? 'Core Minimal (modular baseline)' : 'Legacy Full Stack';
        this.controls.setPipelineStatusText(`Pipeline: ${modeLabel} + ${stackLabel}`);
    }
}

// Initialize the application when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ContinuousGameOfLife();
    });
} else {
    new ContinuousGameOfLife();
}
