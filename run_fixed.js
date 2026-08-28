const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8000/test_m10_runner_fixed.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.runTest === 'function');
    const results = await page.evaluate(() => window.runTest());
    console.log(results);
    await browser.close();
})();
