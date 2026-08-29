const { chromium } = require('playwright');

async function testBrowser(browserType, name) {
    console.log(`\n--- Testing on ${name} ---`);
    const browser = await browserType.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    let crash = false;
    page.on('pageerror', err => { console.error(`[ERROR]`, err); crash = true; });
    
    await page.goto('http://localhost:8000/', {waitUntil: 'networkidle'});
    
    // Upload
    await (await page.$('#file-input-home')).setInputFiles('test_asset_1.jpg');
    await page.waitForTimeout(1000);
    
    // Tweak
    const slider = await page.$('input[data-uniform="u_exposure"]');
    await slider.fill('50');
    await slider.dispatchEvent('change');
    await page.waitForTimeout(500);
    
    // Check Canvas
    const px = await page.evaluate(() => {
        const c = document.getElementById('main-canvas');
        const gl = c.getContext('webgl2', { preserveDrawingBuffer: true }) || c.getContext('webgl', { preserveDrawingBuffer: true });
        const p = new Uint8Array(4);
        gl.readPixels(c.width/2, c.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
        return Array.from(p);
    });
    
    if (px && px[3] > 0) console.log(`[PASS] Valid pixels rendered: ${px}`);
    else { console.error(`[FAIL] Canvas empty`); crash = true; }
    
    // Save to DB by clicking Back
    await page.click('#btn-back');
    await page.waitForTimeout(500);
    
    const dbProjects = await page.evaluate(() => {
        return new Promise((resolve) => {
            const req = indexedDB.open('LocalightDB', 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(['projects'], 'readonly');
                const st = tx.objectStore('projects');
                const ga = st.getAll();
                ga.onsuccess = () => resolve(ga.result);
                ga.onerror = () => resolve([]);
            };
            req.onerror = () => resolve([]);
        });
    });
    
    if (dbProjects.length > 0 && dbProjects[0].state.pipelineVersion === 2) {
        console.log(`[PASS] DB Save successful, V2 architecture confirmed.`);
    } else {
        console.error(`[FAIL] DB Save failed or not V2.`);
        crash = true;
    }
    
    await browser.close();
    return !crash;
}

testBrowser(chromium, "Chromium").then(res => {
    if (!res) process.exit(1);
    console.log("\n[PASS] M14 Field Validation successful.");
});
