const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    await page.goto('http://localhost:8000/test_m12_stress_16f.html', {waitUntil: 'networkidle'});
    const res = await page.evaluate(async () => await window.runTest());
    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})();
