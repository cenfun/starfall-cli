const path = require('path');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const EC = require('eight-colors');
const CG = require('console-grid');
const Util = require('../core/util.js');

const urlToFilename = (url) => {
    const myURL = new URL(url);
    const list = ['audit', myURL.hostname];
    const ps = myURL.pathname.split(/\//g).filter((it) => it).join('-');
    if (ps) {
        list.push(ps);
    }
    return list.join('-');
};


module.exports = async (url) => {
    console.log(`start audit ${url} ...`);

    let lighthouseConfig = Util.getConfig('audit.lighthouseConfig');
    if (Util.option.config) {
        lighthouseConfig = Util.require(Util.option.config);
    }

    const chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless']
    });

    const categories = ['performance', 'accessibility', 'best-practices', 'seo'];

    const options = {
        logLevel: 'info',
        output: 'html',
        onlyCategories: categories,
        port: chrome.port
    };

    const runnerResult = await lighthouse(url, options, lighthouseConfig);

    await chrome.kill();

    const results = runnerResult.lhr.categories;
    //console.log(results);

    CG({
        columns: ['Category', 'Score'],
        rows: categories.map((category) => {
            const item = results[category];
            const s = item.score * 100;
            let score = EC.green(s);
            if (s < 50) {
                score = EC.red(s);
            } else if (s < 90) {
                score = EC.yellow(s);
            }
            return [item.title, score];
        })
    });

    const reportHtml = runnerResult.report;
    const reportPath = path.resolve(Util.getTempRoot(), `${urlToFilename(url)}.html`);
    Util.writeFileContentSync(reportPath, reportHtml);
    EC.logGreen(`Saved audit report: ${Util.relativePath(reportPath)}`);

};
