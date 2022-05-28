const axios = require('axios');
const semver = require('semver');
const Util = require('../core/util.js');
const versionModule = require('../version/version.js');
// ==============================================================================================
// cd folder before publish
const publishItem = (item) => {
    console.log(`publish component ${item} ...`);

    // go to folder first
    const componentPath = Util.getComponentPath(item);
    const tasks = [() => {
        return Util.goTo(componentPath);
    }];
    if (Util.option.debug) {
        tasks.push(() => {
            Util.logYellow(`ignore "npm publish" in debug mode: ${item}`);
            return 0;
        });
    } else {
        let cmd = `npm publish --registry ${Util.registry}`;
        if (Util.option.tag) {
            cmd += ` --tag ${Util.option.tag}`;
        }
        tasks.push(cmd);
    }

    return Util.tasksResolver(tasks);
};

// ==============================================================================================

const updateJsonVersion = function(componentName, newVersion) {
    const packageJson = Util.getComponentConf(componentName, true);
    if (!packageJson) {
        return null;
    }

    // update package self version
    packageJson.version = newVersion;

    // update internal dependencies version
    const deps = packageJson.dependencies;
    if (!deps) {
        return packageJson;
    }

    let subVersion = `~${newVersion}`;
    if (semver.prerelease(newVersion)) {
        subVersion = newVersion;
    }

    const internals = Util.getInternalDependencies();
    for (const k in deps) {
        if (Util.hasOwn(internals, k)) {
            deps[k] = subVersion;
        }
    }

    return packageJson;

};

const updateSubComponentsVersion = (list) => {
    const changes = [];
    const newVersion = Util.getProjectConf('version');
    Util.logLine(`update sub components version to: ${newVersion} ...`);
    list.forEach(function(componentName, i) {
        const num = i + 1;
        const packageJson = updateJsonVersion(componentName, newVersion);
        if (packageJson) {
            Util.saveComponentConf(componentName, packageJson);
            console.log(`${num}, version updated and saved: ${componentName}`);
            const componentPath = Util.getComponentPath(componentName);
            const packagePath = Util.relativePath(`${componentPath}/package.json`);
            changes.push(packagePath);
        } else {
            Util.logRed(`ERROR: Fail to read package.json: ${componentName}`);
        }
    });
    Util.logGreen('update sub components version success');
    if (changes.length) {
        return changes;
    }
};

const publishList = (list) => {

    Util.logLine('publish component(s) ...');
    const tasks = [];
    list.forEach(function(item) {
        tasks.push(() => {
            return publishItem(item);
        });
    });

    return Util.tasksResolver(tasks);

};

// ==============================================================================================

const hasVersion = function(json, newVersion) {
    if (!json || !json.versions) {
        return false;
    }
    let has = false;
    Object.keys(json.versions).forEach(function(v) {
        if (v === newVersion) {
            has = true;
        }
    });
    return has;
};

// do NOT override version
const checkVersion = async (name) => {

    if (Util.option.override) {
        Util.logYellow('sets option to allow override version');
        return 0;
    }

    const fullName = Util.getComponentFullName(name);

    const newVersion = Util.getProjectConf(true).version;
    Util.logLine(`check version: ${fullName}@${newVersion}`);

    console.log('load historical versions ...');

    const url = `${Util.registry}${fullName}`;

    let failed;
    const res = await axios.get(url, {
        timeout: 15 * 1000
    }).catch(function(e) {
        Util.logRed(e);
        failed = true;
    });

    if (failed) {
        // Not found, may not in
        return 0;
    }

    const has = hasVersion(res, newVersion);
    if (has) {
        Util.logRed(`ERROR: ${fullName}@${newVersion} is existing.`);
        Util.logRed('Try update version or override with option --override (-o)');
        return 1;
    }

    return 0;
};

// ==============================================================================================

const publishProject = async (list, components, newVersion) => {

    console.log('publish list:');
    Util.logList(list);

    if (newVersion) {
        Util.logGreen(`publish with new version: ${newVersion}`);
    }

    const prevVersion = Util.getProjectConf('version');
    let subChanges;

    const tasks = [() => {
        if (newVersion) {
            console.log('do not check version exist if has new version to be committed');
            // change version before build
            return versionModule.updateVersion(newVersion);
        }
        return 0;
    }, () => {
        // always check version
        return checkVersion(list[0]);
    }, () => {
        // for sub components, no need for single component
        if (Util.componentsRoot) {
            // include private components
            subChanges = updateSubComponentsVersion(components);
        }
        return 0;
    }, () => {
        if (newVersion) {
            return versionModule.commitVersion(prevVersion, subChanges);
        }
        return 0;
    }, () => {
        // in last one
        return publishList(list);
    }];

    const exitCode = await Util.tasksResolver(tasks);
    if (exitCode !== 0) {
        process.exit(exitCode);
        return;
    }

    await versionModule.tagVersion();

    Util.logGreen('publish component(s) success');

};

const publishModule = function(newVersion) {

    Util.logGreen(`publish registry: ${Util.registry}`);

    const components = Util.getComponentList();
    const list = [];
    // https://docs.npmjs.com/files/package.json
    // ignore components if private in package.json
    components.forEach(function(item) {
        const componentConf = Util.getComponentConf(item);
        if (componentConf && !componentConf.private) {
            list.push(item);
        } else {
            Util.logYellow(`ignore private component: ${item}`);
        }
    });

    if (!list.length) {
        Util.logYellow('Not found any components to be published');
        process.exit(0);
        return;
    }

    publishProject(list, components, newVersion);

};

module.exports = publishModule;
