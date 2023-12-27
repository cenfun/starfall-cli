const fs = require('fs');
const path = require('path');
const semver = require('semver');
const { glob } = require('glob');
const Util = require('../core/util.js');

const getMergedDependencies = function(map, internalComponents, prevDependencies) {
    const mergedDependencies = {};
    // add previous dependencies for dev dependencies
    if (prevDependencies) {
        Object.keys(prevDependencies).forEach((k) => {
            if (internalComponents[k]) {
                return;
            }
            mergedDependencies[k] = prevDependencies[k];
        });
    }

    Object.keys(map).forEach(function(itemName) {
        const itemDependencies = map[itemName];
        Object.keys(itemDependencies).forEach(function(k) {
            if (internalComponents[k]) {
                return;
            }

            const version = itemDependencies[k];
            const existsVersion = mergedDependencies[k];
            if (existsVersion && existsVersion !== version) {
                const e = semver.coerce(existsVersion);
                const v = semver.coerce(version);
                const smaller = semver.lt(e.version, v.version);
                if (smaller) {
                    // no need change if exists smaller
                    return;
                }
            }
            mergedDependencies[k] = version;
        });
    });

    // sort dependencies by A-Z
    return Util.getAscKeyObject(mergedDependencies);
};

const formatDependencies = function(itemDependencies, internalComponents, pVersion) {
    const newDependencies = {};
    if (!itemDependencies) {
        return newDependencies;
    }
    const keys = Object.keys(itemDependencies).sort();
    keys.forEach(function(k) {
        let v = itemDependencies[k];
        if (internalComponents[k]) {
            v = `~${pVersion}`;
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

    const mapDependencies = {};
    const mapDevDependencies = {};
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
        mapDependencies[item.name] = conf.dependencies;
        mapDevDependencies[item.name] = conf.devDependencies;
    });

    // console.log("mapDependencies", mapDependencies);
    // console.log("mapDevDependencies", mapDevDependencies);

    const dependencies = getMergedDependencies(mapDependencies, internalComponents, prevDependencies);
    const devDependencies = getMergedDependencies(mapDevDependencies, internalComponents, prevDevDependencies);

    // console.log(data);
    return {
        dependencies: dependencies,
        devDependencies: devDependencies
    };

};
const updateModule = async () => {

    // install dependencies
    const pc = Util.getProjectConf(true);

    // package.json list
    const packages = [];

    // ====================================================
    // workspaces
    if (Util.isList(pc.workspaces)) {
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
    list.forEach(function(itemName) {
        const fullName = Util.getComponentFullName(itemName);
        // already in workspaces
        const internalComponent = packages.find((it) => it.name === fullName);
        if (internalComponent) {
            internalComponent.internal = true;
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
    // console.log(deps);

    return {
        deps,
        packages
    };
};


module.exports = updateModule;
