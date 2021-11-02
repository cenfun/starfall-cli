const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');

const Util = require('../core/util.js');
const reportHandler = require('./diff-report.js');

const getNameInfo = (str) => {

    str = str.trim();

    const info = {};

    //get option first
    const oList = str.split('?');
    const vStr = oList[0];
    const oStr = oList[1];
    if (oStr) {
        const params = new URLSearchParams(oStr);
        const pSrc = params.get('src');
        if (pSrc) {
            info.src = pSrc;
        }
        info.format = params.has('format');
        const pAb = params.get('ab');
        if (pAb) {
            info.ab = pAb;
        }
    }
    const list = vStr.trim().split('@');
    //@scope/name@a@b
    if (list[0]) {
        info.name = list.shift();
    } else {
        info.name = `${list.shift()}@${list.shift()}`;
    }

    if (list.length) {
        info.ab = list.join(',');
    }

    //console.log(info);

    return info;
};

const initItem = (item, parent) => {
    if (!item) {
        return;
    }
    if (typeof(item) === 'string') {
        return getNameInfo(item);
    }
    if (typeof(item) === 'object') {
        if (item.name && typeof(item.name) === 'string') {
            return item;
        }
    }
};

const initTreeList = (parent, key, flatList) => {
    let list = parent[key];
    if (!Util.isList(list)) {
        return;
    }
    list = list.map(function(item) {
        if (!item) {
            return;
        }
        if (Util.isList(item.subs)) {
            if (parent.ab) {
                item.parentAb = parent.ab;
            }
            initTreeList(item, 'subs', flatList);
            return item;
        }
        const newItem = initItem(item, parent);
        if (!newItem) {
            return;
        }
        const parentAb = parent.ab || parent.parentAb;
        if (!newItem.ab && parentAb) {
            newItem.ab = parentAb;
        }
        flatList.push(newItem);
        return newItem;
        
    });
    list = list.filter(item => item);
    parent[key] = list;
};

const getJobList = (config, jobFolder) => {

    //console.log(option);
    let flatList = [];
    initTreeList(config, 'list', flatList);
    //filter same name items
    const nameMap = {};
    flatList.forEach(function(item) {
        nameMap[item.name] = item;
    });
    flatList = Object.values(nameMap);

    console.log(`diff list: ${flatList.length}`);

    //console.log(JSON.stringify(config, null, 2));
    //console.log(flatList);

    //check npm publish registry
    const infoRegistry = Util.getSetting('infoRegistry');
    if (!infoRegistry) {
        Util.logRed('require infoRegistry in conf.cli.js');
        return null;
    }

    const jobList = [];
    flatList.forEach(function(item) {
        const outputPath = `${jobFolder}/${item.name}`;
        if (!fs.existsSync(outputPath)) {
            shelljs.mkdir('-p', outputPath);
        }
        const job = {
            jobFolder: jobFolder,
            infoRegistry: infoRegistry,
            outputPath: outputPath,
            ... item
        };

        jobList.push(job);
    });
    return jobList;
};

const diffStart = async (config) => {

    let jobFolder = path.resolve(Util.getTempRoot(), 'diff');
    jobFolder = Util.relativePath(jobFolder);

    if (Util.option.clean) {
        if (fs.existsSync(jobFolder)) {
            console.log('Clean diff workspace ...');
            await Util.rm(jobFolder);
            await Util.delay(500);
        }
    }

    if (!fs.existsSync(jobFolder)) {
        shelljs.mkdir('-p', jobFolder);
    }

    const jobList = await getJobList(config, jobFolder);
    if (!jobList) {
        return 1;
    }
    return Util.startWorker({
        name: 'diff',
        workerEntry: path.resolve(__dirname, 'diff-worker.js'),
        jobTimeout: 2 * 60 * 1000,
        jobList: jobList,
        jobFolder: jobFolder,
        reportHandler: (report) => {
            return reportHandler(report, config);
        }
    });
};

const getListFromProject = (componentName) => {
    const list = [];
    const components = Util.getCurrentComponentList(componentName);
    components.forEach(function(item) {
        const componentConf = Util.getComponentConf(item);
        const fullName = Util.getComponentFullName(item);
        if (componentConf && (componentConf.repository)) {
            list.push(fullName);
        } else {
            //list.push(fullName);
            Util.logYellow(`Not found repository setting in package.json, ignore component: ${item}`);
        }
    });
    return list;
};

const diffModule = async (componentName) => {
    let config = {
        ab: Util.option.ab
    };
    let spec = Util.option.spec;
    if (spec) {
        spec += '';
        //try config path
        const configPath = path.resolve(Util.root, spec);
        if (fs.existsSync(configPath)) {
            const json = Util.readJSONSync(configPath);
            if (!json) {
                Util.logRed(`Failed to read config: ${spec}`);
                process.exit(1);
                return;
            }
            config = Object.assign(config, json);
        } else {
            //support any component out of this repository
            config.list = spec.split(',');
        }
    } else {
        //if diff component in mono project, need init project info 
        if (!Util.initProject()) {
            Util.logRed('Please execute command in your project root.');
            return;
        }
        config.list = getListFromProject(componentName);
    }

    if (!Util.isList(config.list)) {
        Util.logRed('ERROR: Not found any names/components to be diffed');
        return;
    }

    const exitCode = await diffStart(config);
    //always exit no matter exit code is 0
    process.exit(exitCode);

};

module.exports = diffModule;
