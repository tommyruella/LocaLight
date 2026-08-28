const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    
    await page.goto('http://localhost:8000/test_legacy_parity.html', {waitUntil: 'networkidle'});
    
    const sliders = ["u_exposure", "u_contrast", "u_highlights", "u_shadows", "u_temperature", "u_tint", "u_saturation", "u_vibrance", "u_sharpness", "u_clarity", "u_grain"];
    
    for (const slider of sliders) {
        const res = await page.evaluate(async (s) => {
            const st = {}; st[s] = 0.5;
            window.complexState = st;
            return await window.runTestBisect(st);
        }, slider);
        console.log("Slider", slider, res);
    }
    await browser.close();
})();
