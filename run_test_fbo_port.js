const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    await page.goto('http://127.0.0.1:8001/test_fbo_cache.html', { waitUntil: 'load' });
    
    // Wait for window.runTest to be defined
    await page.waitForFunction(() => typeof window.runTest === 'function');
    
    const results = await page.evaluate(() => window.runTest());
    console.log("FBO Cache Reuse Test:", results[0] && results[1] ? "PASS" : "FAIL", results);
    
    await browser.close();
})();
