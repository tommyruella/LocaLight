const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log(msg.text()));
    await page.goto('http://127.0.0.1:8000/test_m11_resolution.html', { waitUntil: 'networkidle' });
    
    await page.evaluate(async () => {
        try {
            await window.runTest();
        } catch(e) {
            console.error(e);
        }
    });
    
    await browser.close();
})();
