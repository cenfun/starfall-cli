const { chromium } = require('playwright');
const EC = require('eight-colors');

const Util = require('../core/util.js');

const clearConsole = async (page) => {
    console.log('clear console ...');
    await page.evaluate(() => {
        try {
            console.clear();
        } catch {
            // do nothing
        }
    });
};

const fullGC = async (page, session) => {
    await clearConsole(page);

    console.log('full GC ...');

    const max = 6;
    for (let i = 0; i < max; i++) {
        console.log(`GC ${i + 1} ...`);
        await session.send('HeapProfiler.collectGarbage');
        // wait for a while and let GC do the job
        await Util.delay(200);
    }

    await Util.delay(2000);

    console.log('full GC finish');

};

module.exports = async (chrome) => {
    const port = chrome.port;
    const url = `http://localhost:${port}`;
    EC.log(`Connecting to Chrome debugging port: ${url}`);

    // connect to chrome
    const browser = await chromium.connectOverCDP(url);

    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0];

    const href = await page.evaluate(() => {
        return location.href;
    });

    EC.logGreen(`Connected to page: ${href}`);

    const browserDataDir = Util.getBrowserDataDir();

    console.log(browserDataDir);

    const session = await page.context().newCDPSession(page);
    await session.send('HeapProfiler.enable');


    await fullGC(page, session);

    // collect heap size
    // const builtInMetrics = await page.metrics();
    // const size = Util.BF(builtInMetrics.JSHeapUsedSize);
    // console.log(`Heap size: ${size}`);

};
