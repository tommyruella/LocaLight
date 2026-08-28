const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:8000/test_m12_overlay.html', {waitUntil: 'networkidle'});
    const res = await page.evaluate(async () => {
        const gl = document.getElementById('c').getContext('webgl2');
        const pixels = new Float32Array(4 * 4 * 4);
        gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.FLOAT, pixels);
        return Array.from(pixels.slice(0, 4));
    });
    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})();
