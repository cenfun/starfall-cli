const { chromium } = require('playwright');
const EC = require('eight-colors');

const Util = require('../core/util.js');

module.exports = async (chrome) => {
    const port = chrome.port;
    const url = `http://localhost:${port}`;
    EC.log(`Connecting to Chrome debugging port: ${url}`);

    //connect to chrome
    const browser = await chromium.connectOverCDP(url);

    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0];

    const href = await page.evaluate(() => {
        return location.href;
    });

    EC.logGreen(`Connected to page: ${href}`);

    const browserDataDir = Util.getBrowserDataDir();

    console.log(browserDataDir);


};
