const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
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

    Util.CG({
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
    // add previous dependencies for dev dependencies
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

            // conflict version handler
            // for example: module A requires xxx@2.4, but module B requires xxx@3.0
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

    // sort dependencies by A-Z
    return Util.getAscKeyObject(externalDependencies);
};

const formatDependencies = function(itemDependencies, internalComponents, pVersion) {
    const newDependencies = {};
    if (!itemDependencies) {
        return newDependencies;
    }
    const keys = Object.keys(itemDependencies).sort();
    keys.forEach(function(k) {
        let v = itemDependencies[k];
        if (internalComponents[k] && v !== `~${pVersion}`) {
            v = '';
        }
        newDependencies[k] = v;
    });
    return newDependencies;
};

const getDependencies = (packages, pc) => {

    const prevDependencies = pc.dependencies;
    const prevDevDependencies = pc.devDependencies;
    const pVersion = pc.version;

    const internalComponents = {};
    packages.forEach((item) => {
        if (item.internal) {
            internalComponents[item.name] = true;
        }
    });

    const allDependencies = {};
    const allDevDependencies = {};
    packages.forEach(function(item) {

        const conf = item.json;
        conf.dependencies = formatDependencies(conf.dependencies, internalComponents, pVersion);
        conf.devDependencies = formatDependencies(conf.devDependencies, internalComponents, pVersion);

        // reset only sub components version
        if (item.internal) {
            conf.version = pVersion;
        }
        Util.writeJSONSync(item.path, conf);

        // cache dependencies
        allDependencies[item.name] = conf.dependencies;
        allDevDependencies[item.name] = conf.devDependencies;
    });

    // console.log("allDependencies", allDependencies);
    // console.log("allDevDependencies", allDevDependencies);

    const dependencies = getExternalDependencies(allDependencies, internalComponents, prevDependencies);
    const devDependencies = getExternalDependencies(allDevDependencies, internalComponents, prevDevDependencies);

    // console.log(data);
    return {
        dependencies: dependencies,
        devDependencies: devDependencies
    };

};
const updateModule = async (option = {}) => {

    option = {
        silent: false,
        ... option
    };

    // install dependencies
    const pc = Util.getProjectConf(true);

    // package.json list
    const packages = [];

    // ====================================================
    // workspaces
    let isWorkspaces = false;
    if (Util.isList(pc.workspaces)) {
        isWorkspaces = true;
        for (const w of pc.workspaces) {
            const dirs = await glob(w);
            if (dirs) {
                dirs.forEach((dir) => {
                    const p = path.resolve(dir, 'package.json');
                    if (fs.existsSync(p)) {
                        const json = Util.readJSONSync(p);
                        packages.push({
                            name: json.name,
                            json,
                            path: p
                        });
                    }
                });
            }
        }
    }

    // ====================================================
    // default packages components
    const list = Util.getComponentList(true);
    if (!option.silent) {
        Util.logList(list);
    }
    list.forEach(function(itemName) {
        const fullName = Util.getComponentFullName(itemName);
        // already in workspaces
        if (packages.find((it) => it.name === fullName)) {
            return;
        }

        const p = `${Util.getComponentPath(itemName)}/package.json`;
        const json = Util.readJSONSync(p);
        packages.push({
            internal: true,
            name: json.name,
            json,
            path: p
        });
    });

    // console.log(packages);

    // ====================================================
    const deps = getDependencies(packages, pc);
    if (!option.silent) {
        logDependencies(deps);
    }

    // save dependencies
    pc.dependencies = deps.dependencies;
    pc.devDependencies = deps.devDependencies;

    // update components to project if no workspaces
    if (isWorkspaces) {
        console.log('workspaces detected in package.json, ignore child dependencies promotion.');
    } else {
        Util.saveProjectConf(pc);
    }

    return pc;
};


module.exports = updateModule;
