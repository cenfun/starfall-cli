const Util = require('../core/util.js');

const logDependencies = function(obj) {
    console.log('project dependencies:');
    const rows = [];
    for (const type in obj) {
        const subs = [];
        const typeObj = obj[type];
        for (const d in typeObj) {
            const v = typeObj[d];
            subs.push({
                name: d,
                version: v
            });
        }
        const typeInfo = {
            name: type,
            version: '',
            subs: subs
        };
        rows.push(typeInfo);
    }

    Util.consoleGrid.render({
        option: {},
        columns: [{
            id: 'name',
            name: 'Name',
            maxWidth: 60
        }, {
            id: 'version',
            name: 'Version'
        }],
        rows: rows
    });
};

const getExternalDependencies = function(allDependencies, internalComponents, prevDependencies) {
    const externalDependencies = {};
    //add previous dependencies for dev dependencies
    if (prevDependencies) {
        Object.keys(prevDependencies).forEach((k) => {
            if (internalComponents[k]) {
                return;
            }
            externalDependencies[k] = prevDependencies[k];
        });
    }

    const externalNames = {};

    Object.keys(allDependencies).forEach(function(itemName) {
        const itemDependencies = allDependencies[itemName];
        Object.keys(itemDependencies).forEach(function(k) {
            if (internalComponents[k]) {
                return;
            }

            //conflict version handler
            //for example: module A requires jquery@2.4, but module B requires jquery@3.0
            const existingName = externalNames[k];
            const existingVersion = externalDependencies[k];
            const newVersion = itemDependencies[k];
            if (existingVersion && existingName && existingVersion !== newVersion) {
                Util.logYellow('conflict existing dependencies:');
                Util.logYellow(` ${k}@${existingVersion} is required by ${existingName}`);
                Util.logYellow(` ${k}@${newVersion} is required by ${itemName}`);
                Util.logYellow(`which resolved to ${k}@${newVersion}`);
            }
            externalDependencies[k] = itemDependencies[k];
            externalNames[k] = itemName;

        });
    });

    //sort dependencies by A-Z
    return Util.getAscKeyObject(externalDependencies);
};

const formatDependencies = function(itemDependencies, internalComponents) {
    const newDependencies = {};
    if (!itemDependencies) {
        return newDependencies;
    }
    const keys = Object.keys(itemDependencies).sort();
    keys.forEach(function(k) {
        let v = itemDependencies[k];
        if (internalComponents[k]) {
            v = '';
        }
        newDependencies[k] = v;
    });
    return newDependencies;
};

const getDependencies = (list, prevDevDependencies) => {

    const internalComponents = {};
    list.forEach(function(itemName) {
        const fullName = Util.getComponentFullName(itemName);
        internalComponents[fullName] = true;
    });

    const allDependencies = {};
    const allDevDependencies = {};
    list.forEach(function(itemName) {
        const conf = Util.getComponentConf(itemName, true);
        conf.dependencies = formatDependencies(conf.dependencies, internalComponents);
        conf.devDependencies = formatDependencies(conf.devDependencies, internalComponents);
        //reset only sub components version
        if (Util.componentsRoot) {
            conf.version = '';
        }
        Util.saveComponentConf(itemName, conf);

        //cache dependencies
        const fullName = Util.getComponentFullName(itemName);
        allDependencies[fullName] = conf.dependencies;
        allDevDependencies[fullName] = conf.devDependencies;
    });

    //console.log("allDependencies", allDependencies);
    //console.log("allDevDependencies", allDevDependencies);

    const dependencies = getExternalDependencies(allDependencies, internalComponents);
    const devDependencies = getExternalDependencies(allDevDependencies, internalComponents, prevDevDependencies);

    //console.log(data);
    return {
        dependencies: dependencies,
        devDependencies: devDependencies
    };

};
const updateModule = function(option = {}) {

    option = {
        silent: false, ... option
    };

    //install dependencies
    const pc = Util.getProjectConf(true);

    const list = Util.getComponentList(true);
    if (!option.silent) {
        Util.logList(list);
    }

    const deps = getDependencies(list, pc.devDependencies);
    if (!option.silent) {
        logDependencies(deps);
    }

    //save dependencies
    pc.dependencies = deps.dependencies;
    pc.devDependencies = deps.devDependencies;

    Util.saveProjectConf(pc);

    return pc;
};


module.exports = updateModule;