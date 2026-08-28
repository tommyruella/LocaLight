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
                if (loc) window.uniformMap.set(loc, name);
                return loc;
            };
            
            const orig1f = WebGL2RenderingContext.prototype.uniform1f;
            WebGL2RenderingContext.prototype.uniform1f = function(loc, v) {
                if (window.uniformMap.has(loc)) {
                    window.recordedUniforms[window.uniformMap.get(loc)] = v;
                }
                return orig1f.call(this, loc, v);
            };
        });
        
        await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle' });
        
        const buffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
        await page.setInputFiles('#file-input-home', { name: 'test.png', mimeType: 'image/png', buffer });
        await page.waitForSelector('#editor-workspace', { state: 'visible' });
        
        let results = [];
        const effects = ['u_sharpness', 'u_clarity', 'u_halation', 'u_grain', 'u_noise'];
        
        for (let eff of effects) {
            const slider = await page.$(`input[data-uniform="${eff}"]`);
            if (!slider) {
                results.push({ test: `UI flow for ${eff}`, pass: false, error: 'Slider not found' });
                continue;
            }
            
            let passed = true;
            for (let val of [0, 50, 100]) {
                await slider.evaluate((node, v) => {
                    node.value = v;
                    node.dispatchEvent(new Event('input', { bubbles: true }));
                    node.dispatchEvent(new Event('change', { bubbles: true }));
                }, val);
                
                await page.waitForTimeout(50); // wait for render
                
                const uniforms = await page.evaluate(() => window.recordedUniforms);
                const actual = uniforms[eff];
                const expected = val / 100.0;
                
                if (Math.abs(actual - expected) > 0.001) passed = false;
            }
            
            results.push({ test: `UI flow for ${eff} (0, 50, 100)`, pass: passed });
        }
        
        console.log("==============================");
        console.log("UI FLOW TEST RESULT (JSON):");
        console.log(JSON.stringify(results));
        console.log("==============================");
        
        await browser.close();
    } catch (e) {
        console.error(e);
    }
})();
