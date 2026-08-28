const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('http://127.0.0.1:8000/test_m7_runner.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.runTest === 'function');
    const results = await page.evaluate(() => window.runTest());
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
})();
