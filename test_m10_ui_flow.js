const { chromium } = require('playwright');

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        await page.addInitScript(() => {
            window.uniformMap = new Map();
            window.recordedUniforms = {};
            
            const origGet = WebGL2RenderingContext.prototype.getUniformLocation;
            WebGL2RenderingContext.prototype.getUniformLocation = function(program, name) {
                const loc = origGet.call(this, program, name);
                if (loc) {
                    window.uniformMap.set(loc, name);
                }
                return loc;
            };
            
            const orig1f = WebGL2RenderingContext.prototype.uniform1f;
            WebGL2RenderingContext.prototype.uniform1f = function(loc, v) {
                if (window.uniformMap.has(loc)) {
                    window.recordedUniforms[window.uniformMap.get(loc)] = v;
                }
                return orig1f.call(this, loc, v);
            };
            
            // Auto-load an image to bypass the home screen
            window.addEventListener('load', () => {
                const srcCanvas = document.createElement('canvas');
                srcCanvas.width = 64; srcCanvas.height = 64;
                const file = new File([new Uint8Array(10)], "dummy.png", {type: "image/png"});
                // Actually, app.js expects a real image. 
                // We can just trigger the file input with a real image.
            });
        });
        
        await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle' });
        
        // Create a dummy image
        const buffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
        
        // Upload image to bypass home screen
        await page.setInputFiles('#file-input-home', {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: buffer
        });
        
        // Wait for the workspace to be visible
        await page.waitForSelector('#editor-workspace', { state: 'visible' });
        
        // Select the halation slider
        const slider = await page.$('input[data-uniform="u_halation"]');
        if (!slider) throw new Error("Halation slider not found!");
        
        // Set its value to 50
        await slider.evaluate(node => {
            node.value = 50;
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
        });
        
        // Wait a frame for rendering
        await page.waitForTimeout(100);
        
        const uniforms = await page.evaluate(() => window.recordedUniforms);
        
        console.log("UI Flow Test: set slider to 50 -> expected u_halation = 0.5");
        console.log("Actual captured u_halation:", uniforms['u_halation']);
        
        await browser.close();
    } catch (e) {
        console.error("Playwright Error:", e);
    }
})();
