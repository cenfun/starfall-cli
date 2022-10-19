
const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const Util = require('../core/util.js');

const getGitIgnoreContent = (p, n) => {
    const confPath = path.resolve(p, n);
    return Util.readFileContentSync(confPath);
};

const getGitIgnoreRules = (content) => {
    return content.split(/\r?\n/).map((item) => item.trim()).filter((item) => {
        if (!item) {
            return false;
        }
        // remove comment line start with #
        if (item.indexOf('#') === 0) {
            return false;
        }
        return true;
    });
};

const getDirList = (dir) => {
    if (!dir) {
        Util.logRed(`[ignore] Invalid dir: ${dir}`);
        return [];
    }
    if (!fs.existsSync(dir)) {
        Util.logRed(`[ignore] Not found dir: ${dir}`);
        return [];
    }
    return fs.readdirSync(dir);
};

const isIgnored = (ig, name) => {
    if (ig && name) {
        return ig.ignores(`${name}`) || ig.ignores(`${name}/`);
    }
};

const generateIgnoreList = (igList, absDir, relDir, ig, breakdownNodeModules) => {
    const subDirs = [];
    const list = getDirList(absDir);
    list.forEach((name) => {
        if (name === '.git') {
            return;
        }
        const relPath = `${relDir}${name}`;
        if (isIgnored(ig, relPath)) {
            if (relPath === 'node_modules' && breakdownNodeModules) {
                console.log('[ignore] breakdown node_modules ...');
                getDirList(path.resolve(absDir, name)).forEach((m) => {
                    igList.push(`${name}/${m}`);
                });
            }
            igList.push(relPath);
            return;
        }
        const info = fs.statSync(path.resolve(absDir, name));
        if (info.isDirectory()) {
            subDirs.push(name);
        }
    });

    subDirs.forEach((subName) => {
        const subAbsDir = path.resolve(absDir, subName);
        const subRelDir = `${relDir}${subName}/`;
        generateIgnoreList(igList, subAbsDir, subRelDir, ig);
    });

};

// =====================================================================================================

const createIgnore = (rules) => {
    const ig = ignore();
    ig.add(rules);
    return ig;
};

const forEachGitIgnore = function(dir, callback) {

    const fileName = '.gitignore';
    let filePath;
    let subs = [];

    const list = fs.readdirSync(dir);

    list.forEach(function(subName) {
        const subAbs = path.resolve(dir, subName);
        const info = fs.statSync(subAbs);
        if (info.isDirectory()) {
            if (subName === '.git' || subName === 'node_modules') {
                console.log(`[ignore] ignore ${Util.relativePath(subAbs)}`);
                return;
            }
            subs.push(subName);
            return;
        }

        if (subName === fileName) {
            filePath = dir;
        }
    });

    if (filePath) {
        subs = callback(filePath, fileName, subs);
    }

    if (!Util.isList(subs)) {
        return;
    }

    subs.forEach((subName) => {
        const subDir = path.resolve(dir, subName);
        forEachGitIgnore(subDir, callback);
    });

};

const generateGitIgnoreItems = (root, deep = false) => {
    console.log(`[ignore] generating .gitignore (deep: ${deep}) ...`);
    const st = Date.now();
    const ls = [];
    const from = root || process.cwd();

    forEachGitIgnore(from, (filePath, fileName, subs) => {

        const content = getGitIgnoreContent(filePath, fileName);
        if (!content) {
            return;
        }
        const rules = getGitIgnoreRules(content);
        if (!rules.length) {
            return;
        }
        const ig = createIgnore(rules);

        ls.push({
            path: filePath,
            ig
        });

        if (!deep) {
            return;
        }

        // console.log(subs);

        subs = subs.filter((subName) => {
            return !isIgnored(ig, subName);
        });

        // console.log(subs);

        return subs;

    });

    const duration = Date.now() - st;

    console.log(`[ignore] generated .gitignore list: ${ls.length} (cost ${Util.DTF(duration)})`);
    return ls;
};

// cache projectIgnores
let projectIgnores;
const generateProjectIgnores = (root, deep) => {
    if (!projectIgnores) {
        projectIgnores = generateGitIgnoreItems(root, deep);
    }
    return projectIgnores;
};

// =====================================================================================================

const getIgnoreList = (root, breakdownNodeModules) => {
    root = path.resolve(root || Util.root);
    const igs = generateProjectIgnores(root, true);
    if (!Util.isList(igs)) {
        return [];
    }
    // console.log(igs);

    let ignoreList = [];

    igs.forEach((item) => {
        let igList = [];
        const absDir = item.path;
        const relDir = '';
        generateIgnoreList(igList, absDir, relDir, item.ig, breakdownNodeModules);

        // root no .gitignore, but subs has multiple .gitignore

        const rootRel = path.relative(root, absDir);
        if (rootRel) {
            igList = igList.map((it) => {
                return `${rootRel}/${it}`;
            });
        }

        ignoreList = ignoreList.concat(igList);

    });

    return ignoreList;
};

const isProjectIgnored = function(name) {
    const igs = generateProjectIgnores(Util.root);
    if (!Util.isList(igs)) {
        return false;
    }
    for (const item of igs) {
        if (isIgnored(item.ig, name)) {
            return true;
        }
    }
    return false;
};

module.exports = {
    getIgnoreList,
    createIgnore,
    isIgnored,
    isProjectIgnored
};
