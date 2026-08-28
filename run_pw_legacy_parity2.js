const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    await page.evaluate(async () => {
        window.getErr = () => {
            let maxErr = 0; let mIdx = 0;
            for(let i=0; i<window.out11.length; i++) {
                if (Math.abs(window.out11[i] - window.out12[i]) > maxErr) { maxErr = Math.abs(window.out11[i] - window.out12[i]); mIdx = Math.floor(i/4)*4; }
            }
            return {
                err: maxErr,
                p11: Array.from(window.out11.slice(mIdx, mIdx+4)),
                p12: Array.from(window.out12.slice(mIdx, mIdx+4))
            };
        }
    });
    await page.goto('http://localhost:8000/test_legacy_parity.html', {waitUntil: 'networkidle'});
    const res = await page.evaluate(async () => {
        await window.runTest();
        let maxErr = 0; let mIdx = 0;
        for(let i=0; i<window.out11.length; i++) {
            if (Math.abs(window.out11[i] - window.out12[i]) > maxErr) { maxErr = Math.abs(window.out11[i] - window.out12[i]); mIdx = Math.floor(i/4)*4; }
        }
        return { err: maxErr, p11: Array.from(window.out11.slice(mIdx, mIdx+4)), p12: Array.from(window.out12.slice(mIdx, mIdx+4)) };
    });
    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})();
