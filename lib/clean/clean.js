const fs = require('fs');
const shelljs = require('shelljs');
const ignore = require('ignore');
const Util = require('../core/util.js');
const Ignore = require('../core/ignore.js');
const EC = Util.EC;

const generateExclude = function() {
    let excludeRules = [];

    const excludeSetting = Util.getConfig('clean.exclude');
    if (excludeSetting) {
        excludeRules = excludeRules.concat(Util.toList(excludeSetting));
    }

    if (Util.option.exclude) {
        const excludeOption = `${Util.option.exclude}`.split(',');
        excludeRules = excludeRules.concat(excludeOption);
    }

    if (!excludeRules.length) {
        return;
    }
    const ig = ignore();
    console.log('clean exclude rules:', excludeRules);
    ig.add(excludeRules);
    return ig;
};

// =========================================================================================

const removeListHandler = async (removeList) => {
    const len = removeList.length;
    if (!len) {
        return;
    }
    console.log(`start to remove ${EC.green(len)} items ...`);
    for (const item of removeList) {
        if (!fs.existsSync(`${Util.root}/${item}`)) {
            continue;
        }
        console.log(`removing ${item} ...`);
        const done = await Util.rm(item);
        if (done) {
            console.log(`${EC.green('removed')} ${item}`);
        } else {
            console.log(EC.red(`failed to remove: ${item}`));
        }
    }
};

// =========================================================================================
const generateCleanList = () => {
    console.log('generate ignore list ...');

    const breakdownNodeModules = true;
    let ignoreList = Ignore.getIgnoreList(Util.root, breakdownNodeModules);

    const exclude = generateExclude();
    if (exclude) {
        console.log(`generated ignore items before exclude: ${EC.red(ignoreList.length)}`);
        ignoreList = ignoreList.filter((item) => {
            if (Ignore.isIgnored(exclude, item)) {
                return false;
            }
            return true;
        });
        console.log(`generated ignore items after exclude:: ${EC.red(ignoreList.length)}`);
    } else {
        console.log(`generated ignore items: ${EC.red(ignoreList.length)}`);
    }
    return ignoreList;
};

// =========================================================================================

const cleanModule = async () => {
    const time_start = Date.now();
    console.log('clean project files ...');

    shelljs.cd(Util.root);

    const isWindows = process.platform === 'win32';
    if (isWindows) {
        Util.logCyan('Try following to improve File System performance on win32 platform:');
        console.log(' 1, Whitelist project folder from Anti Virus');
        console.log(' 2, Whitelist npm/Yarn cache directory from Anti Virus');
        console.log(' 3, Adding node.exe to Windows Defender exclusions');
        console.log(' 4, Disabling Indexing service on Windows or node_modules folder');
        Util.logLine();
    }

    const cleanList = generateCleanList();
    //console.log(cleanList);

    //debug
    if (Util.option.debug) {
        Util.logYellow('debug mode does not perform delete operations');
        return;
    }

    await removeListHandler(cleanList);

    if (Util.option.git) {
        await Util.tasksResolver([
            'git reset --hard',
            'git clean -df'
        ]);
    }

    const duration = Date.now() - time_start;
    console.log(`clean duration: ${Util.TF(duration)}`);
    Util.logGreen('clean done');

};

module.exports = cleanModule;
