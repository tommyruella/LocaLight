const { chromium } = require('playwright');

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:8000/test_m11_resolution.html', { waitUntil: 'networkidle' });
        
        await page.waitForFunction('!!window.runTest');
        const res = await page.evaluate(async () => await window.runTest());
        
        console.log("Playwright testing M11...");
        console.log("==============================");
        console.log("RUNTIME RESULT (JSON):");
        console.log(res);
        console.log("==============================");
        
        await browser.close();
    } catch (e) {
        console.error("Playwright Error:", e);
    }
})();
