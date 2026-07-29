import semver from 'semver';
import EC from 'eight-colors';
import CG from 'console-grid';
import {
    state, getComponentPath, getComponentConf, getInternalDependencies, hasOwn, getProjectConf, logLine, saveComponentConf, relativePath, logRed, logGreen, tasksResolver, logYellow, getComponentFullName, request, logList, getComponentList
} from '../core/util.js';
import versionModule from '../version/version.js';
// ==============================================================================================
// cd folder before publish
const publishItem = (item) => {
    console.log(`publish component ${item}:`);

    // go to folder first
    const componentPath = state.option.root ? state.root : getComponentPath(item);
    console.log();

    let cmd = `npm publish --registry ${state.registry}`;
    if (state.option.tag) {
        cmd += ` --tag ${state.option.tag}`;
    }

    CG({
        'options': {
            'headerVisible': false
        },
        'columns': [{
            'name': '',
            'maxWidth': 2000
        }],
        'rows': [
            [EC.magenta(`cd ${componentPath}`)],
            [EC.magenta(cmd)]
        ]
    });

    return 0;
};

// ==============================================================================================

const updateJsonVersion = function(componentName, newVersion) {
    const packageJson = getComponentConf(componentName, true);
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

    const internals = getInternalDependencies();
    for (const k in deps) {
        if (hasOwn(internals, k)) {
            deps[k] = subVersion;
        }
    }

    return packageJson;

};

const updateSubComponentsVersion = (list) => {
    const changes = [];
    const newVersion = getProjectConf('version');
    logLine(`update sub components version to: ${newVersion} ...`);
    list.forEach(function(componentName, i) {
        const num = i + 1;
        const packageJson = updateJsonVersion(componentName, newVersion);
        if (packageJson) {
            saveComponentConf(componentName, packageJson);
            console.log(`${num}, version updated and saved: ${componentName}`);
            const componentPath = getComponentPath(componentName);
            const packagePath = relativePath(`${componentPath}/package.json`);
            changes.push(packagePath);
        } else {
            logRed(`ERROR: Fail to read package.json: ${componentName}`);
        }
    });
    logGreen('update sub components version success');
    if (changes.length) {
        return changes;
    }
};

const publishList = (list) => {

    logLine('publish component(s) ...');
    const tasks = [];
    list.forEach(function(item) {
        tasks.push(() => {
            return publishItem(item);
        });
    });

    return tasksResolver(tasks);

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

    if (state.option.override) {
        logYellow('allow override version');
        return 0;
    }

    const fullName = getComponentFullName(name);

    const newVersion = getProjectConf(true).version;
    logLine(`check version: ${fullName}@${newVersion}`);

    console.log('load historical versions ...');

    const url = `${state.registry}${fullName}`;

    const [err, res] = await request({
        url, timeout: 15 * 1000
    });

    if (err) {
        // Not found, may not in
        return 0;
    }

    const has = hasVersion(res, newVersion);
    if (has) {
        logRed(`ERROR: ${fullName}@${newVersion} is existing.`);
        logRed('Try update version or override with option --override (-o)');
        return 1;
    }

    return 0;
};

// ==============================================================================================

const publishProject = async (list, components, newVersion) => {

    console.log('publish list:');
    logList(list);

    if (newVersion) {
        logGreen(`publish with new version: ${newVersion}`);
    }

    const prevVersion = getProjectConf('version');
    let subChanges;

    const tasks = [() => {
        if (newVersion) {
            // change version before build
            return versionModule.updateVersion(newVersion);
        }
        return 0;
    }, () => {
        // always check version
        return checkVersion(list[0]);
    }, () => {
        // for sub components, no need for single component
        if (state.componentsRoot) {
            // include private components
            subChanges = updateSubComponentsVersion(components);
        }
        return 0;
    }, () => {
        // commit new version
        if (newVersion) {
            return versionModule.commitVersion(prevVersion, subChanges);
        }
        return 0;
    }, () => {
        // in last one
        return publishList(list);
    }];

    const exitCode = await tasksResolver(tasks);
    if (exitCode !== 0) {
        process.exit(exitCode);
        return;
    }

    logGreen('ready to publish component(s) ...');

};

const publishModule = function(newVersion) {

    logGreen(`publish registry: ${state.registry}`);

    const components = getComponentList();

    const list = [];
    // root package only without sub components
    if (state.option.root) {
        const pc = getProjectConf();
        list.push(pc.name);
    } else {
        // https://docs.npmjs.com/files/package.json
        // ignore components if private in package.json
        components.forEach(function(item) {
            const componentConf = getComponentConf(item);
            if (componentConf && !componentConf.private) {
                list.push(item);
            } else {
                logYellow(`ignore private component: ${item}`);
            }
        });
    }

    if (!list.length) {
        logYellow('Not found any components to be published');
        process.exit(0);
        return;
    }

    publishProject(list, components, newVersion);

};

export default publishModule;
