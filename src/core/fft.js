/**
 * 2D FFT utilities for frequency-domain processing
 * Using separable 1D FFTs (row-wise then column-wise)
 */

export class FFT2D {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        
        // Pre-compute twiddle factors for efficiency
        this.precomputeTwiddles();
    }
    
    precomputeTwiddles() {
        // For now, we'll compute on the fly
        // Can optimize later with lookup tables
    }
    
    // 1D FFT using Cooley-Tukey algorithm
    fft1D(input, inverse = false) {
        const n = input.length / 2; // Complex numbers (real, imag pairs)
        if (n <= 1) return input;
        
        // Bit-reversal permutation
        const output = new Float32Array(input.length);
        for (let i = 0; i < n; i++) {
            const j = this.reverseBits(i, Math.log2(n));
            output[j * 2] = input[i * 2];
            output[j * 2 + 1] = input[i * 2 + 1];
        }
        
        // Cooley-Tukey butterfly operations
        for (let size = 2; size <= n; size *= 2) {
            const halfSize = size / 2;
            const step = (inverse ? 2 : -2) * Math.PI / size;
            
            for (let i = 0; i < n; i += size) {
                for (let k = 0; k < halfSize; k++) {
                    const angle = step * k;
                    const twiddleReal = Math.cos(angle);
                    const twiddleImag = Math.sin(angle);
                    
                    const evenIdx = (i + k) * 2;
                    const oddIdx = (i + k + halfSize) * 2;
                    
                    const oddReal = output[oddIdx];
                    const oddImag = output[oddIdx + 1];
                    
                    // Multiply odd by twiddle factor
                    const tempReal = oddReal * twiddleReal - oddImag * twiddleImag;
                    const tempImag = oddReal * twiddleImag + oddImag * twiddleReal;
                    
                    // Butterfly
                    output[oddIdx] = output[evenIdx] - tempReal;
                    output[oddIdx + 1] = output[evenIdx + 1] - tempImag;
                    output[evenIdx] += tempReal;
                    output[evenIdx + 1] += tempImag;
                }
            }
        }
        
        // Normalize for inverse transform
        if (inverse) {
            for (let i = 0; i < output.length; i++) {
                output[i] /= n;
            }
        }
        
        return output;
    }
    
    reverseBits(x, bits) {
        let result = 0;
        for (let i = 0; i < bits; i++) {
            result = (result << 1) | (x & 1);
            x >>= 1;
        }
        return result;
    }
    
    // 2D FFT using separable approach
    fft2D(imageData, inverse = false) {
        const { width, height } = this;
        const real = new Float32Array(width * height);
        const imag = new Float32Array(width * height);
        
        // Extract grayscale or single channel
        for (let i = 0; i < width * height; i++) {
            real[i] = imageData[i * 4] / 255.0; // Use R channel
            imag[i] = 0;
        }
        
        // Row-wise FFT
        const rowData = new Float32Array(width * 2);
        for (let y = 0; y < height; y++) {
            // Extract row
            for (let x = 0; x < width; x++) {
                rowData[x * 2] = real[y * width + x];
                rowData[x * 2 + 1] = imag[y * width + x];
            }
            
            // Transform
            const transformed = this.fft1D(rowData, inverse);
            
            // Write back
            for (let x = 0; x < width; x++) {
                real[y * width + x] = transformed[x * 2];
                imag[y * width + x] = transformed[x * 2 + 1];
            }
        }
        
        // Column-wise FFT
        const colData = new Float32Array(height * 2);
        for (let x = 0; x < width; x++) {
            // Extract column
            for (let y = 0; y < height; y++) {
                colData[y * 2] = real[y * width + x];
                colData[y * 2 + 1] = imag[y * width + x];
            }
            
            // Transform
            const transformed = this.fft1D(colData, inverse);
            
            // Write back
            for (let y = 0; y < height; y++) {
                real[y * width + x] = transformed[y * 2];
                imag[y * width + x] = transformed[y * 2 + 1];
            }
        }
        
        return { real, imag };
    }
    
    // Forward transform for RGB image
    forwardRGB(imageData) {
        const channels = [];
        
        // Process each channel
        for (let c = 0; c < 3; c++) {
            const channelData = new Uint8Array(this.width * this.height * 4);
            for (let i = 0; i < this.width * this.height; i++) {
                channelData[i * 4] = imageData[i * 4 + c];
            }
            channels.push(this.fft2D(channelData, false));
        }
        
        return channels; // Array of {real, imag} for R, G, B
    }
    
    // Inverse transform back to RGB image
    inverseRGB(channels) {
        const imageData = new Uint8Array(this.width * this.height * 4);
        
        // Process each channel
        for (let c = 0; c < 3; c++) {
            const { real, imag } = channels[c];
            
            // Reconstruct image data for this channel
            const channelImage = new Uint8Array(this.width * this.height * 4);
            for (let i = 0; i < this.width * this.height; i++) {
                channelImage[i * 4] = real[i] * 255;
            }
            
            const inverse = this.fft2D(channelImage, true);
            
            // Write to output
            for (let i = 0; i < this.width * this.height; i++) {
                imageData[i * 4 + c] = Math.max(0, Math.min(255, inverse.real[i] * 255));
            }
        }
        
        // Alpha channel
        for (let i = 0; i < this.width * this.height; i++) {
            imageData[i * 4 + 3] = 255;
        }
        
        return imageData;
    }
    
    // Compute amplitude (magnitude) from complex number
    getAmplitude(real, imag) {
        const amplitude = new Float32Array(real.length);
        for (let i = 0; i < real.length; i++) {
            amplitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        }
        return amplitude;
    }
    
    // Compute phase from complex number
    getPhase(real, imag) {
        const phase = new Float32Array(real.length);
        for (let i = 0; i < real.length; i++) {
            phase[i] = Math.atan2(imag[i], real[i]);
        }
        return phase;
    }
    
    // Reconstruct complex from amplitude and phase
    fromPolar(amplitude, phase) {
        const real = new Float32Array(amplitude.length);
        const imag = new Float32Array(amplitude.length);
        for (let i = 0; i < amplitude.length; i++) {
            real[i] = amplitude[i] * Math.cos(phase[i]);
            imag[i] = amplitude[i] * Math.sin(phase[i]);
        }
        return { real, imag };
    }
}
