const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:8000/test_legacy_parity.html', {waitUntil: 'networkidle'});
    const st = {
        u_exposure: 0.5, u_contrast: 0.2, u_highlights: -0.3, u_shadows: 0.4,
        u_temperature: -0.2, u_tint: 0.1, u_saturation: 0.5, u_vibrance: 0.3,
        u_sharpness: 0.5, u_clarity: 0.4, u_grain: 0.2
    };
    for (const k of Object.keys(st)) {
        const res = await page.evaluate(async (key) => {
            const tempSt = { ...window.stObj };
            tempSt[key] = 0; // Turn off one
            return await window.runTestBisect(tempSt);
        }, k);
        console.log("Without", k, "err:", res);
    }
    await browser.close();
})();
