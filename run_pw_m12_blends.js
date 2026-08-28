const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:8000/test_m12_blends.html', {waitUntil: 'networkidle'});
    const res = await page.evaluate(async () => await window.runTest());
    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})();
