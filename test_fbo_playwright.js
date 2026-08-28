const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log(msg.text()));
    await page.goto('http://127.0.0.1:8000/test_fbo_cache.html', { waitUntil: 'networkidle' });
    
    const results = await page.evaluate(() => window.runTest());
    console.log("FBO Cache Reuse Test:", results[0] && results[1] ? "PASS" : "FAIL", results);
    
    await browser.close();
})();
