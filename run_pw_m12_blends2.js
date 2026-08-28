const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    await page.goto('http://localhost:8000/test_m12_blends.html', {waitUntil: 'networkidle'});
    const res = await page.evaluate(async () => {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return "NO WEBGL2";
        const r = await window.runTest();
        return r;
    });
    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})();
