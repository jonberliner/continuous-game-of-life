/**
 * Image loading and resizing utilities
 */

export function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const resizedData = resizeImage(img, 1080);
                resolve(resizedData);
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(file);
    });
}

export function resizeImage(img, maxSize) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let width = img.width;
    let height = img.height;
    
    // Calculate new dimensions maintaining aspect ratio
    if (width > height) {
        if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
        }
    } else {
        if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
        }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Draw resized image
    ctx.drawImage(img, 0, 0, width, height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    
    return {
        width,
        height,
        imageData,
        canvas
    };
}

export function createDefaultImage(width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = width;
    canvas.height = height;
    
    // Create a gradient pattern
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, width / 2
    );
    
    gradient.addColorStop(0, '#ff00ff');
    gradient.addColorStop(0.5, '#00ffff');
    gradient.addColorStop(1, '#ffff00');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add some noise/detail
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 50;
        data[i] += noise;     // R
        data[i + 1] += noise; // G
        data[i + 2] += noise; // B
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    return {
        width,
        height,
        imageData: ctx.getImageData(0, 0, width, height),
        canvas
    };
}
