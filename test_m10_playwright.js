const { chromium } = require('playwright');
const path = require('path');

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        console.log("Playwright testing M10 Real Effects...");
        
        await page.goto('http://127.0.0.1:8000/test_m10_runner.html', { waitUntil: 'networkidle' });
        
        await page.waitForFunction('!!window.runTest');
        
        const result = await page.evaluate(async () => {
            return await window.runTest();
        });
        
        console.log("\n==============================");
        console.log("RUNTIME RESULT (JSON):");
        console.log(result);
        console.log("==============================\n");
        
        await browser.close();
    } catch (e) {
        console.error("Playwright Error:", e);
    }
})();
