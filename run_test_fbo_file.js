const { chromium } = require('playwright');
const path = require('path');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    const fileUrl = 'file://' + path.resolve('test_fbo_cache.html');
    await page.goto(fileUrl, { waitUntil: 'load' });
    
    // Wait for window.runTest to be defined
    await page.waitForFunction(() => typeof window.runTest === 'function');
    
    const results = await page.evaluate(() => window.runTest());
    console.log("FBO Cache Reuse Test:", results[0] && results[1] ? "PASS" : "FAIL", results);
    
    await browser.close();
})();
