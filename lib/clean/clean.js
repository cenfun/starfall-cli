const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const ignore = require('ignore');
const Util = require('../core/util.js');
const EC = Util.EC;

const generateExclude = function() {
    let excludeRules = [];

    const excludeSetting = Util.getSetting('clean.exclude');
    if (excludeSetting) {
        excludeRules = excludeRules.concat(Util.toList(excludeSetting));
    }

    const excludeOption = `${Util.option.exclude}`;
    if (excludeOption) {
        excludeRules = excludeRules.concat(excludeOption.split(','));
    }

    if (!excludeRules.length) {
        return;
    }
    const ig = ignore();
    console.log('clean exclude rules:', excludeRules);
    ig.add(excludeRules);
    return ig;
};

const isIgnore = function(ig, name) {
    return ig.ignores(`${name}`) || ig.ignores(`${name}/`);
};

//=========================================================================================

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

//=========================================================================================

const hasGitIgnore = (ig, absP, relP) => {
    const confPath = path.resolve(absP, '.gitignore');
    if (!fs.existsSync(confPath)) {
        return false;
    }
    if (isIgnore(ig, `${relP}/.gitignore`)) {
        Util.logYellow(`${relP}/.gitignore has been ignored`);
        return false;
    }
    return true;
};

const getGitIgnoreContent = (p) => {
    const confPath = path.resolve(p, '.gitignore');
    return Util.readFileContentSync(confPath);
};

const getGitIgnoreRules = (content) => {
    return content.split(/\r?\n/).map(item => item.trim()).filter(item => {
        if (!item) {
            return false;
        }
        //remove comment line start with #
        if (item.indexOf('#') === 0) {
            return false;
        }
        return true;
    });
};

const getSubIgnoreList = (ig, absRoot, relRoot, relSub) => {
    const subAbsRoot = path.resolve(absRoot, relSub);
    let ignoreList = [];
    const subDirs = [];
    const list = fs.readdirSync(subAbsRoot);
    for (const name of list) {
        const subPath = `${relSub}/${name}`;
        if (isIgnore(ig, subPath)) {
            ignoreList.push(relRoot + subPath);
            continue;
        }
        const info = fs.statSync(path.resolve(absRoot, subPath));
        if (info.isDirectory()) {
            subDirs.push(subPath);
        }
    }

    subDirs.forEach(item => {
        const subIgnoreList = getSubIgnoreList(ig, absRoot, relRoot, item);
        ignoreList = ignoreList.concat(subIgnoreList);
    });

    //handle sub .gitignore in one sub level
    if (hasGitIgnore(ig, subAbsRoot, relSub)) {
        const subRelRoot = [relRoot, relSub].filter(item => item).join('/');
        const newIgnoreList = generateIgnoreList(subAbsRoot, `${subRelRoot}/`);
        ignoreList = ignoreList.concat(newIgnoreList);
    }

    return ignoreList;
};

const getIgnoreList = (ig, absRoot, relRoot) => {
    let ignoreList = [];
    const subDirs = [];
    const list = fs.readdirSync(absRoot);
    for (const name of list) {
        if (isIgnore(ig, name)) {
            if (name === 'node_modules') {
                //breakdown node_modules
                console.log('breakdown node_modules ...');
                const nmList = fs.readdirSync(path.resolve(absRoot, name)).map(m => {
                    return `${relRoot + name}/${m}`;
                });
                ignoreList = ignoreList.concat(nmList);
            }
            ignoreList.push(relRoot + name);
            continue;
        }
        const info = fs.statSync(path.resolve(absRoot, name));
        if (info.isDirectory() && name !== '.git') {
            subDirs.push(name);
        }
    }

    subDirs.forEach(function(relSub) {
        const subIgnoreList = getSubIgnoreList(ig, absRoot, relRoot, relSub);
        ignoreList = ignoreList.concat(subIgnoreList);
    });

    return ignoreList;
};

const generateIgnoreList = (absRoot, relRoot = '') => {
    const content = getGitIgnoreContent(absRoot);
    if (!content) {
        return [];
    }
    const rules = getGitIgnoreRules(content);
    if (!rules.length) {
        return [];
    }
    //console.log(rules);
    const ig = ignore();
    ig.add(rules);
    return getIgnoreList(ig, absRoot, relRoot);
};

//=========================================================================================
const generateCleanList = () => {
    console.log('generate ignore list ...');
    let ignoreList = generateIgnoreList(Util.root);
    const exclude = generateExclude();
    if (exclude) {
        console.log(`generated ignore items before exclude: ${ignoreList.length}`);
        ignoreList = ignoreList.filter(item => {
            if (isIgnore(exclude, item)) {
                return false;
            }
            return true;
        });
        console.log(`generated ignore items after exclude:: ${ignoreList.length}`);
    } else {
        console.log(`generated ignore items: ${ignoreList.length}`);
    }
    return ignoreList;
};

//=========================================================================================

const cleanModule = async () => {
    const time_start = Date.now();
    console.log('clean project files ...');

    shelljs.cd(Util.root);

    const isWindows = (process.platform === 'win32');
    if (isWindows) {
        Util.logCyan('Try following to improve File System performance on win32 platform:');
        console.log(' 1, Whitelist project folder from Anti Virus');
        console.log(' 2, Whitelist npm/Yarn cache directory from Anti Virus');
        console.log(' 3, Adding node.exe to Windows Defender exclusions');
        console.log(' 4, Disabling Indexing service on Windows or node_modules folder');
        Util.logLine(' ');
    }
    
    const cleanList = generateCleanList();
    //console.log(cleanList);
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

cleanModule.generateCleanList = generateCleanList;

module.exports = cleanModule;
