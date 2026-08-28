const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:8000/test_legacy_parity.html', {waitUntil: 'networkidle'});
    const pairs = [
        { u_exposure: 0.5, u_contrast: 0.2 },
        { u_exposure: 0.5, u_temperature: -0.2 },
        { u_exposure: 0.5, u_saturation: 0.5 }
    ];
    for (const p of pairs) {
        const res = await page.evaluate(async (p) => {
            return await window.runTestBisect(p);
        }, p);
        console.log("Pair", p, "err:", res);
    }
    await browser.close();
})();
