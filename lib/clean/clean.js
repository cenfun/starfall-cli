import fs from 'fs';
import EC from 'eight-colors';
import ignore from 'ignore';
import {
    state, getConfig, toList, rm, logCyan, logLine, logYellow, tasksResolver, TF, logGreen
} from '../core/util.js';
import Ignore from '../core/ignore.js';

const generateExclude = function() {
    let excludeRules = [];

    const excludeSetting = getConfig('clean.exclude');
    if (excludeSetting) {
        excludeRules = excludeRules.concat(toList(excludeSetting));
    }

    if (state.option.exclude) {
        const excludeOption = `${state.option.exclude}`.split(',');
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
        if (!fs.existsSync(`${state.root}/${item}`)) {
            continue;
        }
        console.log(`removing ${item} ...`);
        const done = await rm(item);
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
    let ignoreList = Ignore.getIgnoreList(state.root, breakdownNodeModules);

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
        if (ignoreList.length) {
            console.log(`generated ignore items: ${EC.red(ignoreList.length)}`);
        }
    }
    return ignoreList;
};

// =========================================================================================

const cleanModule = async () => {
    const time_start = Date.now();
    console.log('clean project files ...');

    process.chdir(state.root);

    const isWindows = process.platform === 'win32';
    if (isWindows) {
        logCyan('Try following to improve File System performance on win32 platform:');
        console.log(' 1, Whitelist project folder from Anti Virus');
        console.log(' 2, Whitelist npm/Yarn cache directory from Anti Virus');
        console.log(' 3, Adding node.exe to Windows Defender exclusions');
        console.log(' 4, Disabling Indexing service on Windows or node_modules folder');
        logLine();
    }

    const cleanList = generateCleanList();
    // console.log(cleanList);

    // debug
    if (state.option.debug) {
        logYellow('debug mode does not perform delete operations');
        return;
    }

    await removeListHandler(cleanList);

    if (state.option.git) {
        await tasksResolver([
            'git reset --hard',
            'git clean -df'
        ]);
    }

    const duration = Date.now() - time_start;
    console.log(`clean duration: ${TF(duration)}`);
    logGreen('clean done');

};

export default cleanModule;
