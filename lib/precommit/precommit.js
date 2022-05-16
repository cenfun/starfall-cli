const Util = require('../core/util.js');
const lint = require('../lint/lint.js');
const test = require('../test/test.js');
const build = require('../build/build.js');

const getInfoFromPath = function(filePath, projectName) {
    const list = filePath.split(/\/+|\\+/);
    const srcIndex = list.indexOf('src');
    const testIndex = list.indexOf('test');

    //empty is single component
    let name = '';
    let type = '';
    if (srcIndex !== -1) {
        name = list[srcIndex - 1] || projectName;
        type = 'src';
    } else if (testIndex !== -1) {
        name = list[testIndex - 1] || projectName;
        type = 'test';
    }

    if (name) {
        return {
            name,
            type
        };
    }
};


const getChangedNames = function(fileList) {

    let projectName = '';
    if (!Util.componentsRoot) {
        const pc = Util.getProjectConf();
        projectName = pc.name;
    }

    const changedNames = {};
    fileList.forEach(function(filePath) {
        const info = getInfoFromPath(filePath, projectName);
        if (info) {
            if (!changedNames[info.name]) {
                changedNames[info.name] = [];
            }
            changedNames[info.name].push(info.type);
        }
    });
    return changedNames;
};

const filterList = function(list, type) {
    let ls = list.filter((item) => {
        if (item) {
            if (typeof (item) === 'object' && !item[type]) {
                return false;
            }
            return true;
        }
        return false;
    });
    ls = ls.map((item) => {
        if (typeof (item) === 'object') {
            return item.name;
        }
        return item;
    });
    return ls;
};

const precommitList = (list) => {

    const precommitEnable = Util.getConfig('precommit.enable');
    const enable = `${precommitEnable}`.toLowerCase();
    if (!enable) {
        Util.logYellow('precommit disabled');
        return 0;
    }

    console.log(`precommit: ${enable}`);

    const lintList = filterList(list, 'lint');
    const buildList = filterList(list, 'build');
    const testList = filterList(list, 'test');

    const tasks = [() => {
        //run lint first
        if (enable.indexOf('lint') === -1) {
            Util.logYellow('Disabled lint on pre-commit');
            return 0;
        }
        return lint.lintList(lintList);
    }, () => {
        //run build next
        if (enable.indexOf('build') === -1) {
            Util.logYellow('Disabled build on pre-commit');
            return 0;
        }
        return build.buildList(buildList);
    }, () => {
        //run test last
        if (enable.indexOf('test') === -1) {
            Util.logYellow('Disabled test on pre-commit');
            return 0;
        }
        if (Util.option.pass) {
            Util.logYellow('Pass without test');
            return 0;
        }
        return test.testList(testList);
    }];

    return Util.tasksResolver(tasks);

};

const precommitStart = async (list) => {

    if (!list.length) {
        Util.logRed('ERROR: Not found Component');
        process.exit(1);
        return;
    }
    const startTime = Date.now();
    const exitCode = await precommitList(list);
    if (exitCode === 0) {
        const duration = Date.now() - startTime;
        const cost = duration.toLocaleString();
        const time = Util.TF(duration);
        Util.logGreen(`finish precommit (lint + build + test) and cost ${cost}ms (${time})`);
    }
    //always exit no matter exit code is 0
    process.exit(exitCode);

};


const getRelatedComponent = function(name, changedNames) {

    /*
    changedNames = {
        name1: ["src", "test"],
        name2: ["src"]
    };
    */
    //self changed, do all
    if (changedNames[name]) {
        return name;
    }
    //self dependency src changed, do test only
    const d = Util.getComponentDependencies(name);
    const deps = d.modules;
    const changedNameList = Object.keys(changedNames).filter((n) => {
        if (Util.inList('src', changedNames[n])) {
            return true;
        }
        return false;
    });
    if (!changedNameList.length) {
        return;
    }
    for (let i = 0, l = changedNameList.length; i < l; i++) {
        const n = changedNameList[i];
        const fullName = Util.getComponentFullName(n);
        if (Util.inList(fullName, deps)) {
            return {
                name: name,
                test: true
            };
        }
    }
};

//from git commit
const precommitGitFiles = function(files) {
    const fileList = (`${files}`).split('\n');
    const changedNames = getChangedNames(fileList);
    const allComponentList = Util.getComponentList();
    const currentList = [];
    for (let i = 0, l = allComponentList.length; i < l; i++) {
        const name = allComponentList[i];
        const relatedComponent = getRelatedComponent(name, changedNames);
        if (relatedComponent) {
            currentList.push(relatedComponent);
        }
    }
    console.log('commit components: ', currentList);

    //for debug test
    //process.exit(1);

    //nothing to do if no files change on git commit
    if (currentList.length) {
        precommitStart(currentList);
    }

};


const precommitModule = function(componentName, files) {

    //console.log("componentName and files: ", componentName, files);
    if (componentName === 'gitfiles') {
        precommitGitFiles(files);
        return;
    }

    //from CLI
    const list = Util.getCurrentComponentList(componentName);
    precommitStart(list);

};

module.exports = precommitModule;
