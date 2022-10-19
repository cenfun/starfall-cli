const path = require('path');
const lighthouse = require('lighthouse');
const reportGenerator = require('lighthouse/report/generator/report-generator');
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

const getColorScore = (s) => {
    if (s < 50) {
        return EC.red(s);
    }
    if (s < 90) {
        return EC.yellow(s);
    }
    return EC.green(s);
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

    // remove 'accessibility', 'pwa'
    const categories = ['performance', 'best-practices', 'seo'];

    const options = {
        logLevel: 'info',
        output: 'html',
        onlyCategories: categories,
        port: chrome.port
    };

    const runnerResult = await lighthouse(url, options, lighthouseConfig);

    await chrome.kill();


    // =============================================================================
    const json = reportGenerator.generateReport(runnerResult.lhr, 'json');
    const audits = JSON.parse(json).audits;
    // console.log(audits);

    const performanceAudits = ['first-contentful-paint', 'interactive', 'total-blocking-time', 'largest-contentful-paint'];

    // =============================================================================
    const categoryResults = runnerResult.lhr.categories;
    CG({
        columns: [{
            id: 'name',
            name: 'Category'
        }, {
            id: 'score',
            name: 'Score',
            align: 'center'
        }, {
            id: 'value',
            name: 'Value',
            align: 'right'
        }],
        rows: categories.map((category) => {
            const item = categoryResults[category];
            const score = getColorScore(item.score * 100);
            const row = {
                name: item.title,
                score: score,
                value: ''
            };
            if (category === 'performance') {
                row.subs = performanceAudits.map((id) => {
                    const it = audits[id];
                    // console.log(it);
                    return {
                        name: it.title,
                        score: getColorScore(it.score * 100),
                        value: it.displayValue
                    };
                });
            }
            return row;
        })
    });

    // =============================================================================
    const reportHtml = runnerResult.report;
    const reportPath = path.resolve(Util.getTempRoot(), `${urlToFilename(url)}.html`);
    Util.writeFileContentSync(reportPath, reportHtml);
    EC.logGreen(`Saved audit report: ${Util.relativePath(reportPath)}`);

};
