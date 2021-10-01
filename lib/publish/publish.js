const shelljs = require("shelljs");
const semver = require("semver");
const Util = require("../core/util.js");
const precommitModule = require("../precommit/precommit.js");
const versionModule = require("../version/version.js");
//==============================================================================================
//cd folder before publish
const publishItem = (item) => {
    console.log(`publish component ${item} ...`);

    //go to folder first
    const componentPath = Util.getComponentPath(item);
    const tasks = [() => {
        return Util.goTo(componentPath);
    }];
    if (Util.option.debug) {
        tasks.push(() => {
            console.log(`ignore publish in debug mode: ${item}`);
            return 0;
        });
    } else {
        let cmd = `npm publish --registry ${Util.option.publishRegistry}`;
        if (Util.option.tag) {
            cmd += ` --tag ${Util.option.tag}`;
        }
        tasks.push(cmd);
    }

    return Util.tasksResolver(tasks);
};

//==============================================================================================

const updateJsonVersion = function(componentName, newVersion) {
    const packageJson = Util.getComponentConf(componentName, true);
    if (!packageJson) {
        return null;
    }

    //update package self version
    packageJson.version = newVersion;

    //update internal dependencies version
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
        if (internals.hasOwnProperty(k)) {
            deps[k] = subVersion;
        }
    }

    return packageJson;

};

const updateSubComponentsVersion = (list) => {
    const newVersion = Util.getProjectConf("version");
    Util.logStart(`update sub components version to: ${newVersion} ...`);
    list.forEach(function(componentName, i) {
        const num = i + 1;
        const packageJson = updateJsonVersion(componentName, newVersion);
        if (packageJson) {
            Util.saveComponentConf(componentName, packageJson);
            console.log(`${num}, version updated and saved: ${componentName}`);
        } else {
            Util.logRed(`ERROR: Fail to read package.json: ${componentName}`);
        }
    });
    Util.logGreen("update sub components version success");
};

const publishList = (list) => {

    //for sub components, no need for single component
    if (Util.componentsRoot) {
        updateSubComponentsVersion(list);
    }

    Util.logStart("publish component(s) to npm registry ...");
    const tasks = [];
    list.forEach(function(item) {
        tasks.push(() => {
            return publishItem(item);
        });
    });

    return Util.tasksResolver(tasks);

};


//==============================================================================================

const hasVersion = function(content, newVersion) {
    let has = false;
    let str = `{"versions":${content}}`;
    str = str.replace(/\n/g, "");
    str = str.replace(/'/g, '"');
    const json = Util.jsonParse(str);
    if (!json) {
        console.log(str);
        return has;
    }
    json.versions.forEach(function(v) {
        if (v === newVersion) {
            has = true;
        }
    });
    return has;
};

//do NOT override version
const checkVersion = (name) => {

    if (Util.option.override) {
        Util.logYellow("sets option to allow override version");
        return 0;
    }

    const fullName = Util.getComponentFullName(name);

    const newVersion = Util.getProjectConf(true).version;
    Util.logStart(`check version: ${fullName}@${newVersion}`);

    console.log("load historical versions ...");

    const sh = shelljs.exec(`npm view ${fullName} versions`, {
        silent: true
    });
    if (sh.code) {
        //Not found, may not in the npm registry.
        console.log(sh.stderr);
        return 0;
    }

    const has = hasVersion(sh.stdout, newVersion);
    if (has) {
        Util.logRed(`ERROR: ${fullName}@${newVersion} is existing.`);
        Util.logRed("Try update version or override with option --override (-o)");
        return 1;
    }

    return 0;
};

//==============================================================================================

const publishProject = async (list, newVersion) => {

    console.log("publish list:");
    Util.logList(list);

    if (newVersion) {
        Util.logGreen(`publish with new version: ${newVersion}`);
    }

    const prevVersion = Util.getProjectConf("version");

    const tasks = [() => {
        if (newVersion) {
            console.log("do not check version exist if has new version to be committed");
            //change version before build 
            return versionModule.updateVersion(newVersion);
        }
        return 0;
    }, () => {
        //always check version
        return checkVersion(list[0]);
    }, () => {
        if (newVersion) {
            return versionModule.commitVersion(prevVersion);
        }
        return 0;
    }, () => {
        //in last one
        return publishList(list);
    }];

    const exitCode = await Util.tasksResolver(tasks);
    if (exitCode !== 0) {
        process.exit(exitCode);
        return;
    }

    await versionModule.tagVersion();

    Util.logGreen("publish component(s) success");

};

const publishModule = function(newVersion) {

    //check npm publish registry
    const publishRegistry = Util.getSetting("publishRegistry");
    if (!publishRegistry) {
        Util.logRed("publish require publishRegistry in conf.cli.js");
        process.exit(1);
        return;
    }

    Util.option.publishRegistry = publishRegistry;
    Util.logGreen(`publish registry:${publishRegistry}`);

    const components = Util.getComponentList();
    const list = [];
    //https://docs.npmjs.com/files/package.json#repository
    //"repository": "npm/npm"
    //ignore components if no repository in package.json
    components.forEach(function(item) {
        const componentConf = Util.getComponentConf(item);
        if (componentConf && (componentConf.repository)) {
            list.push(item);
        } else {
            Util.logYellow(`Not found repository setting in package.json, ignore component: ${item}`);
        }
    });

    if (!list.length) {
        Util.logYellow("Not found any components to be published");
        process.exit(0);
        return;
    }

    publishProject(list, newVersion);

};

module.exports = publishModule;
