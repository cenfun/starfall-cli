
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
        Util.logRed(`Invalid dir: ${dir}`);
        return [];
    }
    if (!fs.existsSync(dir)) {
        Util.logRed(`Not found dir: ${dir}`);
        return [];
    }
    return fs.readdirSync(dir);
};

const isIgnored = (ig, name) => {
    if (ig && name) {
        return ig.ignores(`${name}`) || ig.ignores(`${name}/`);
    }
};

const generateIgnoreList = (absDir, relDir, ig, ignoreList, breakdownNodeModules) => {
    const subDirs = [];
    const list = getDirList(absDir);
    list.forEach((name) => {
        const relPath = `${relDir}${name}`;
        if (relPath === '.git') {
            return;
        }
        if (isIgnored(ig, relPath)) {
            if (relPath === 'node_modules' && breakdownNodeModules) {
                console.log('breakdown node_modules ...');
                getDirList(path.resolve(absDir, name)).forEach((m) => {
                    ignoreList.push(`${name}/${m}`);
                });
            }
            ignoreList.push(relPath);
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
        generateIgnoreList(subAbsDir, subRelDir, ig, ignoreList);
    });

};

// =====================================================================================================

const createIgnore = (rules) => {
    const ig = ignore();
    ig.add(rules);
    return ig;
};

const generateGitIgnoreItems = (root) => {
    const ls = [];
    const from = root || process.cwd();
    let parentIg;
    Util.forEachFile(from, ['.gitignore'], function(fileName, filePath) {
        const relPath = path.relative(from, filePath);
        // not support absolute path
        if (parentIg && isIgnored(parentIg, relPath)) {
            return;
        }
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
        parentIg = ig;
    });
    return ls;
};

// cache projectIgnores
let projectIgnores;
const generateProjectIgnores = (root) => {
    if (!projectIgnores) {
        projectIgnores = generateGitIgnoreItems(root);
    }
    return projectIgnores;
};

// =====================================================================================================

const getIgnoreList = (root, breakdownNodeModules) => {
    root = path.resolve(root || Util.root);
    const igs = generateProjectIgnores(root);
    if (!Util.isList(igs)) {
        return [];
    }
    // console.log(igs);
    const ignoreList = [];
    igs.forEach((item) => {
        const absDir = item.path;
        const relDir = '';
        generateIgnoreList(absDir, relDir, item.ig, ignoreList, breakdownNodeModules);
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
