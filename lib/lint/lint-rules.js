const fs = require('fs');
const path = require('path');
const playwright = require('playwright');
const EC = require('eight-colors');
const Util = require('../core/util.js');

const launchBrowser = async () => {
    const time_start = Date.now();
    const defaultViewport = Util.getDefaultViewport();
    Util.logMsg('lint rules', `[browser] default viewport ${JSON.stringify(defaultViewport)}`);

    const cacheDir = Util.getBrowserDataCacheDir();

    //playwright will clean cache by self
    const browserOption = {
        downloadsPath: cacheDir,
        tracesDir: cacheDir,
        args: Util.getBrowserLaunchArgs(),
        ignoreDefaultArgs: Util.getBrowserLaunchIgnoreArgs(),
        defaultViewport: defaultViewport
    };

    //devtools for debug
    //If this option is true, the headless option will be set false
    browserOption.devtools = true;
    
        
    Util.logMsg('lint rules', '[browser] launch ...');
    const browserType = Util.getBrowserType();
    const browser = await playwright[browserType].launch(browserOption);
    
    const v = await browser.version();
    Util.logMsg('lint rules', `[browser] ${EC.green('launched')} ${browserType} ${v}${Util.getCost(time_start, 3000)}`);
    return browser;
};

const loadRules = async () => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto('https://eslint.org/docs/rules/').catch((e) => {
        Util.logRed(e);
    });

    //await Util.delay(10 * 1000);

    const list = await page.evaluate(() => {
        const list = [];

        //rules
        const tables = document.querySelectorAll('table.rule-list');
        Array.from(tables).forEach(table => {
            const trs = table.querySelectorAll('tr');
            Array.from(trs).forEach(tr => {
                const item = {};
                const tds = tr.querySelectorAll('td');
                Array.from(tds).forEach((td, i) => {
                    const v = (`${td.innerText}`).trim();
                    if (i === 0 && v) {
                        item.recommended = true;
                        return;
                    }
                    if (i === 1 && v) {
                        item.fixable = true;
                        return;
                    }
                    if (i === 3) {
                        item.name = v;
                    }
                });
                list.push(item);
            });
        });

        //Deprecated
        const deprecated = document.querySelector('.deprecated-rules');
        const deprecatedTrs = deprecated.querySelectorAll('tr');
        Array.from(deprecatedTrs).forEach(tr => {
            const item = {
                deprecated: true
            };
            const tds = tr.querySelectorAll('td');
            let valid;
            Array.from(tds).forEach((td, i) => {
                const v = (`${td.innerText}`).trim();
                if (i === 0 && v) {
                    item.name = v;
                    valid = true;
                    return;
                }
                if (i === 1 && v && v !== '(no replacement)') {
                    item.replaced = v;
                }
            });
            if (valid) {
                list.push(item);
            }
        });

        const removed = document.querySelector('.removed-rules');
        const removedTrs = removed.querySelectorAll('tr');
        Array.from(removedTrs).forEach(tr => {
            const item = {
                removed: true
            };
            const tds = tr.querySelectorAll('td');
            let valid;
            Array.from(tds).forEach((td, i) => {
                const v = (`${td.innerText}`).trim();
                if (i === 0 && v) {
                    item.name = v;
                    valid = true;
                    return;
                }
                if (i === 1 && v && v !== '(no replacement)') {
                    item.replaced = v;
                }
            });
            if (valid) {
                list.push(item);
            }
        });

        return list;
    });

    //console.log(list);

    await page.close();
    await browser.close();
    const rules = {};
    list.sort((a, b) => {
        const au = a.name.toUpperCase();
        const bu = b.name.toUpperCase();
        return au > bu ? 1 : -1;
    });

    list.forEach(item => {
        rules[item.name] = item;
    });
    return rules;
};

const checkRules = (rules) => {
    const eslintrc = Util.require(path.resolve('.eslintrc.js'));

    //check deprecated/removed/recommended
    Object.keys(eslintrc.rules).forEach(name => {
        const rule = rules[name];
        if (!rule) {
            if (name.indexOf('/') === -1) {
                Util.logRed(`not found: ${name}`);
            }
            return;
        }
        if (rule.deprecated) {
            Util.logRed(`deprecated: ${name}`);
            return;
        }
        if (rule.removed) {
            Util.logRed(`removed: ${name}`);
            return;
        }
        if (rule.recommended) {
            Util.logRed(`recommended: ${name}`);
            return;
        }
        if (rule.fixable) {
            Util.logGreen(`fixable: ${name}`);
        } else {
            console.log(`normal: ${name}`);
        }
    });

    //check fixable
    let i = 1;
    Object.keys(rules).forEach(name => {
        const rule = rules[name];
        if (!rule.fixable) {
            return;
        }
        const item = eslintrc.rules[name];
        if (!item) {
            Util.logRed(`miss fixable rule ${i}: ${name}`);
            i++;
        }
    });

};


module.exports = async () => {

    const rulesPath = path.resolve(Util.getTempRoot(), 'eslint-rules.json');

    if (fs.existsSync(rulesPath)) {
        const json = Util.readJSONSync(rulesPath);
        if (json) {
            return checkRules(json);
        }
    }
    
    
    const rules = await loadRules();
    Util.writeJSONSync(rulesPath, rules, true);
    Util.logGreen(`eslint rules saved: ${Util.relativePath(rulesPath)}`);
    
    return checkRules(rules);

};