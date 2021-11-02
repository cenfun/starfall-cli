const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const ignore = require('ignore');
const Util = require('../core/util.js');
const EC = Util.EC;

const hasGitIgnore = (ig, absP, relP) => {
    if (ig.ignores(`${relP}/.gitignore`)) {
        Util.logYellow(`${relP}/.gitignore has been ignored`);
        return false;
    }
    const confPath = path.resolve(absP, '.gitignore');
    return fs.existsSync(confPath);
};

const getGitIgnoreContent = (p) => {
    const confPath = path.resolve(p, '.gitignore');
    return Util.readFileContentSync(confPath);
};

const getSubIgnoreList = (ig, absRoot, relRoot, relSub) => {
    const subAbsRoot = path.resolve(absRoot, relSub);
    let ignoreList = [];
    const subDirs = [];
    const list = fs.readdirSync(subAbsRoot);
    for (const name of list) {
        const subPath = `${relSub}/${name}`;
        if (ig.ignores(subPath) || ig.ignores(`${subPath}/`)) {
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
        if (ig.ignores(name) || ig.ignores(`${name}/`)) {
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
    const rules = content.split(/\r?\n/).map(item => item.trim()).filter(item => {
        if (!item) {
            return false;
        }
        //remove comment line start with #
        if (item.indexOf('#') === 0) {
            return false;
        }
        return true;
    });
    if (!rules.length) {
        return [];
    }
    //console.log(rules);
    const ig = ignore();
    ig.add(rules);
    return getIgnoreList(ig, absRoot, relRoot);
};

//=========================================================================================

const generateNodeModules = (nmp) => {
    let list = [];
    if (!fs.existsSync(nmp)) {
        return list;
    }
    list = fs.readdirSync(nmp).map(m => {
        return `${nmp}/${m}`;
    });
    list.push(nmp);
    return list;
};

const generateNmList = () => {
    let nmList = [];
    if (fs.existsSync('package-lock.json')) {
        nmList.push('package-lock.json');
    }
    nmList = nmList.concat(generateNodeModules('node_modules'));
    nmList = nmList.concat(generateNodeModules('server/node_modules'));
    return nmList;
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

const cleanModule = async () => {

    shelljs.cd(Util.root);

    const isWindows = (process.platform === 'win32');
    if (isWindows) {
        Util.logYellow('Try following to improve File System performance on Windows:');
        console.log(' 1, Whitelist project folder from Anti Virus');
        console.log(' 2, Whitelist npm/Yarn cache directory from Anti Virus');
        console.log(' 3, Adding node.exe to Windows Defender exclusions');
        console.log(' 4, Disabling Indexing service on Windows or node_modules folder');
        Util.logLine(' ');
    }

    console.log('clean project files ...');

    const time_start = Date.now();

    const nmList = generateNmList();
    await removeListHandler(nmList);

    console.log('generate ignore list ...');
    const ignoreList = generateIgnoreList(Util.root);
    //console.log(ignoreList);
    await removeListHandler(ignoreList);

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

cleanModule.generateIgnoreList = generateIgnoreList;

module.exports = cleanModule;
