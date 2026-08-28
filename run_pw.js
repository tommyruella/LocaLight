const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
    await page.goto('file://' + process.cwd() + '/test_m12_srgb.html', {waitUntil: 'networkidle'});
    const html = await page.content();
    console.log(html.includes('PASS') ? 'TEST SUCCESS' : 'TEST FAILED');
    await browser.close();
})();
