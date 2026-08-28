const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            headless: "new"
        });
        const page = await browser.newPage();
        
        console.log("Puppeteer script started");
        await page.goto('http://127.0.0.1:8000/test_m9_runner.html', {waitUntil: 'networkidle0'});
        
        await page.waitForFunction('!!window.runTest');
        
        const result = await page.evaluate(async () => {
            return await window.runTest();
        });
        
        console.log("RUNTIME RESULT:");
        console.log(result);
        await browser.close();
    } catch (e) {
        console.error("Puppeteer Error:", e);
    }
})();
