with open('app.js', 'r') as f:
    text = f.read()

# Make export execute the engine's export method.
get_blob_old = """async function getExportBlob() {
    let targetWidth = canvas.width * exportSettings.scale;
    let targetHeight = canvas.height * exportSettings.scale;
    let exportCanvas = canvas;
    if (exportSettings.scale < 1.0) {
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = targetWidth;
        exportCanvas.height = targetHeight;
        const ctx = exportCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    }
    
    return new Promise((resolve) => {
        exportCanvas.toBlob((blob) => {
            resolve(blob);
        }, exportSettings.format, exportSettings.quality);
    });
}"""

get_blob_new = """async function getExportBlob() {
    // Invoke M11 offscreen export on the engine
    let exportedObj;
    try {
        exportedObj = engine.export();
    } catch(e) {
        alert("Export failed: " + e.message);
        throw e;
    }
    
    if (!exportedObj) throw new Error("Export returned nothing");

    // Put pixels into a canvas for scaling and encoding
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = exportedObj.width;
    rawCanvas.height = exportedObj.height;
    const ctx = rawCanvas.getContext('2d');
    const imgData = new ImageData(new Uint8ClampedArray(exportedObj.pixels), rawCanvas.width, rawCanvas.height);
    
    // WebGL readPixels is Y-flipped relative to 2D canvas, so we must flip it before encoding.
    // However, engine.render normally renders right-side up onto the screen (because WebGL viewport is bottom-up but DOM is top-down).
    // Let's draw it flipped manually.
    const flipCanvas = document.createElement('canvas');
    flipCanvas.width = rawCanvas.width;
    flipCanvas.height = rawCanvas.height;
    const fctx = flipCanvas.getContext('2d');
    fctx.putImageData(imgData, 0, 0);
    
    ctx.translate(0, rawCanvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(flipCanvas, 0, 0);

    let targetWidth = rawCanvas.width * exportSettings.scale;
    let targetHeight = rawCanvas.height * exportSettings.scale;
    let exportCanvas = rawCanvas;
    
    if (exportSettings.scale < 1.0) {
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = targetWidth;
        exportCanvas.height = targetHeight;
        const ectx = exportCanvas.getContext('2d');
        ectx.drawImage(rawCanvas, 0, 0, targetWidth, targetHeight);
    }
    
    return new Promise((resolve) => {
        exportCanvas.toBlob((blob) => {
            resolve(blob);
        }, exportSettings.format, exportSettings.quality);
    });
}"""

text = text.replace(get_blob_old, get_blob_new)

with open('app.js', 'w') as f:
    f.write(text)
