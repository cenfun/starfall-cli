import fs from 'fs';
import path from 'path';
import semver from 'semver';
import { glob } from 'glob';
import {
    getAscKeyObject, writeJSONSync, getProjectConf, isList, readJSONSync
} from '../core/util.js';

const getMergedDependencies = function(map, prevDependencies) {
    const mergedDependencies = {};
    // add previous dependencies
    if (prevDependencies) {
        Object.keys(prevDependencies).forEach((k) => {
            mergedDependencies[k] = prevDependencies[k];
        });
    }

    Object.keys(map).forEach(function(itemName) {
        const itemDependencies = map[itemName] || {};
        Object.keys(itemDependencies).forEach(function(k) {
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
    return getAscKeyObject(mergedDependencies);
};

const getDependencies = (packages, pc) => {

    const prevDependencies = pc.dependencies;
    const prevDevDependencies = pc.devDependencies;

    const mapDependencies = {};
    const mapDevDependencies = {};
    packages.forEach(function(item) {
        const conf = item.json;
        writeJSONSync(item.path, conf);

        // cache dependencies
        mapDependencies[item.name] = conf.dependencies;
        mapDevDependencies[item.name] = conf.devDependencies;
    });

    const dependencies = getMergedDependencies(mapDependencies, prevDependencies);
    const devDependencies = getMergedDependencies(mapDevDependencies, prevDevDependencies);

    // console.log(data);
    return {
        dependencies: dependencies,
        devDependencies: devDependencies
    };

};
const updateModule = async () => {

    // install dependencies
    const pc = getProjectConf(true);

    // package.json list
    const packages = [];

    // ====================================================
    // workspaces
    if (isList(pc.workspaces)) {
        for (const w of pc.workspaces) {
            const dirs = await glob(w);
            if (dirs) {
                dirs.forEach((dir) => {
                    const p = path.resolve(dir, 'package.json');
                    if (fs.existsSync(p)) {
                        const json = readJSONSync(p);
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

    // console.log(packages);

    // ====================================================
    const deps = getDependencies(packages, pc);
    // console.log(deps);

    return {
        deps,
        packages
    };
};


export default updateModule;
