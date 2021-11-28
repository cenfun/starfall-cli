const fs = require('fs');
const path = require('path');
const Util = require('../core/util.js');

const loadRules = async () => {
    const browser = await Util.launchBrowser({
        name: 'lint rules',
        debug: true
    });
    const page = await browser.newPage();
    await page.goto('https://eslint.org/docs/rules/').catch((e) => {
        Util.logRed(e);
    });

    //await Util.delay(10 * 1000);

    const list = await page.evaluate(() => {
        const ls = [];

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
                ls.push(item);
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
                ls.push(item);
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
                ls.push(item);
            }
        });

        return ls;
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
    const fixableList = [];
    const normalList = [];
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
            fixableList.push(name);
        } else {
            normalList.push(name);
        }
    });

    //check fixable
    const fixableMissingList = [];
    const normalMissingList = [];
    Object.keys(rules).forEach(name => {
        const rule = rules[name];
        if (rule.recommended || rule.deprecated || rule.removed) {
            return;
        }
        const item = eslintrc.rules[name];
        if (!item) {
            if (rule.fixable) {
                fixableMissingList.push(name);
            } else {
                normalMissingList.push(name);
            }
        }
    });

    
    fixableList.forEach((name, i) => {
        Util.logGreen(`fixable ${i + 1}: ${name}`);
    });
    fixableMissingList.forEach((name, i) => {
        Util.logRed(`fixable missing ${i + 1}: ${name}`);
    });

    normalList.forEach((name, i) => {
        Util.logGreen(`normal ${i + 1}: ${name}`);
    });
    normalMissingList.forEach((name, i) => {
        Util.logRed(`normal missing ${i + 1}: ${name}`);
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