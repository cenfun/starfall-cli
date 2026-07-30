import fs from 'fs';
import { writeFile as writeFileAsync, readFile as readFileAsync } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import os from 'os';
import net from 'net';
import axios from 'axios';
import { execSync } from 'child_process';
import rc from 'rc';
import { findUpSync } from 'find-up';

// 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'
import EC from 'eight-colors';
import CG from 'console-grid';

import Gauge from 'gauge';
import { createRequire } from 'module';

const loadModule = createRequire(import.meta.url);
const gauge = new Gauge();

const npmConfig = rc('npm', {
    registry: 'https://registry.npmjs.org/'
});
// console.log(npmConfig);

export const state = {
    id: 'sf',
    name: 'starfall',

    registry: npmConfig.registry,

    option: {},

    // global cache
    projectConf: null,
    projectBranch: '',
    componentConf: {},
    componentList: [],
    componentFolderName: {},
    componentFullName: {},
    componentDependencies: {},

    // global property
    root: '',
    cliRoot: '',
    cliVersion: '',
    componentsRoot: '',
    projectConfPath: '',
    workerLength: 0,
    jobLength: 0,
    tempRoot: '',
    templateCache: {},
    config: {},
    internalDependencies: null,
    command: '',
    jobId: '',
    jobName: '',
    workerId: '',
    componentName: '',
    upgradeTips: ''

};

export function getComponentRoot() {
    // check subs
    state.componentsRoot = formatPath(path.resolve(state.root, 'packages'));
    // have sub components folder
    if (!fs.existsSync(state.componentsRoot)) {
        // Not found subs folder
        // single component
        state.componentsRoot = '';
    }
    return state.componentsRoot;
}

export function getTempRoot() {
    if (state.tempRoot) {
        return state.tempRoot;
    }

    // init temp output
    const tempPath = getConfig('tempPath');
    state.tempRoot = formatPath(path.resolve(state.root, tempPath));
    if (!fs.existsSync(state.tempRoot)) {
        fs.mkdirSync(state.tempRoot, {
            recursive: true
        });
    }

    return state.tempRoot;
}

export function getTemplate(templatePath) {
    if (!state.templateCache) {
        state.templateCache = {};
    }
    let template = state.templateCache[templatePath];
    if (!template) {
        template = readFileSync(templatePath);
        if (template) {
            state.templateCache[templatePath] = template;
        } else {
            logRed(`ERROR: Not found template: ${templatePath}`);
        }
    }
    return template;
}

export function getProjectConf(force) {
    if (force === true) {
        state.projectConf = null;
    }
    if (!state.projectConf) {
        if (!state.projectConfPath) {
            state.projectConfPath = `${state.root}/package.json`;
        }
        state.projectConf = readJSONSync(state.projectConfPath);
    }
    if (force && typeof force === 'string') {
        return state.projectConf[force];
    }
    return state.projectConf;
}

export function saveProjectConf(pc) {
    writeJSONSync(state.projectConfPath, sortPackageKeys(pc));
}

export function mergeOption(... args) {
    const option = {};
    args.forEach((item) => {
        if (!item) {
            return;
        }
        Object.keys(item).forEach((k) => {
            const nv = item[k];
            if (hasOwn(option, k)) {
                const ov = option[k];
                if (ov && typeof ov === 'object') {
                    if (nv && typeof nv === 'object' && !Array.isArray(nv)) {
                        option[k] = mergeOption(ov, nv);
                        return;
                    }
                }
            }
            option[k] = nv;
        });
    });
    return option;
}


const findUpConfig = (customConfigFile) => {
    if (customConfigFile) {
        if (fs.existsSync(customConfigFile)) {
            return customConfigFile;
        }
        // custom config not found
        return;
    }

    const defaultConfigList = [
        'sf.config.js',
        'sf.config.cjs',
        'sf.config.mjs',
        'sf.config.ts',
        'sf.config.json'
    ];

    const configPath = findUpSync(defaultConfigList);
    if (configPath) {
        return configPath;
    }

    // default config not found
};

const parseJsonConfig = (configPath) => {
    const content = readFileSync(configPath);
    try {
        return JSON.parse(content);
    } catch (e) {
        logRed(`ERROR: failed to parse config "${configPath}": ${e.message}`);
    }
};

const resolveConfigOptions = async (configPath) => {
    // json format
    const ext = path.extname(configPath);
    if (ext === '.json') {
        return parseJsonConfig(configPath);
    }

    let configOptions;
    let err;
    try {
        configOptions = await import(pathToFileURL(configPath));
    } catch (ee) {
        err = ee;
    }

    if (err) {
        logRed(`ERROR: failed to load config "${configPath}": ${err && err.message} `);
        return;
    }

    // could be multiple level default
    while (configOptions && configOptions.default) {
        configOptions = configOptions.default;
    }

    return configOptions;
};

export const initConfig = async (customConfig) => {

    const defaultConfig = await resolveConfigOptions(`${state.cliRoot}/sf.config.js`);

    const configPath = findUpConfig(customConfig);
    let configOptions = {};
    if (configPath) {
        configOptions = await resolveConfigOptions(configPath);
    } else {
        if (customConfig) {
            logRed(`ERROR: not found config file: ${customConfig}`);
            process.exit(1);
            return;
        }
    }
    return mergeOption(defaultConfig, configOptions);
};

export function getConfig(key) {
    return getValue(state.config, key);
}

export const runHook = (hookName, data) => {
    const hook = getConfig(hookName);
    if (hook) {
        const logs = [EC.bg.magenta('[hook]'), EC.magenta(hookName)];
        console.log(logs.join(' '));
        return hook.call(state, data, state);
    }
    return 0;
};

export function getComponentList(force) {
    if (force) {
        state.componentList = [];
    }

    if (isList(state.componentList)) {
        return state.componentList;
    }

    // Resolve the component root lazily now that project initialization is no longer required.
    if (!state.componentsRoot) {
        getComponentRoot();
    }

    // single component
    if (!state.componentsRoot) {
        const pc = getProjectConf();
        state.componentList = [pc.name];
        return state.componentList;
    }

    const componentsPath = `${state.componentsRoot}/`;
    const folderNames = fs.readdirSync(componentsPath);
    folderNames.forEach(function(folderName) {
        const states = fs.statSync(componentsPath + folderName);
        // console.log(states.isDirectory());
        if (states.isDirectory()) {
            const packagePath = `${componentsPath + folderName}/package.json`;
            if (fs.existsSync(packagePath)) {
                state.componentList.push(folderName);
            }
        }
    });

    return state.componentList;
}

export function parseComponentList(componentName, list) {
    componentName = `${componentName}`.trim();
    let blackList = false;
    if (componentName.startsWith('!')) {
        blackList = true;
        componentName = componentName.substr(1);
    }
    const specList = componentName.split(',');
    const map = {};
    specList.forEach(function(item) {
        if (!item) {
            return;
        }
        const matched = inList(item, list);
        if (matched) {
            // exact matching
            map[item] = true;
        } else {
            // fuzzy matching
            list.forEach(function(name) {
                if (name && name.indexOf(item) !== -1) {
                    map[name] = true;
                }
            });
        }
    });

    const newList = [];
    list.forEach((item) => {
        const matched = map[item];
        if (blackList) {
            if (!matched) {
                newList.push(item);
            }
        } else if (matched) {
            newList.push(item);
        }
    });

    return newList;
}

export function sortComponentByInternal(list) {

    const internals = getInternalDependencies();

    // internal dependencies should be sorted

    // sort by internal dependencies
    // it should be built first if it's a dependency

    const folderList = [];
    Object.keys(internals).forEach(function(fullName) {
        folderList.push(getComponentFolderName(fullName));
    });

    list.sort(function(a, b) {
        const ai = folderList.indexOf(a);
        const bi = folderList.indexOf(b);
        if (ai === -1) {
            return 1;
        }
        if (bi === -1) {
            return -1;
        }
        return ai - bi;
    });

    return list;
}

export function getCurrentComponentList(componentNameStr) {
    const list = getComponentList();
    // all
    let newList = list;
    // from args
    if (componentNameStr) {
        newList = parseComponentList(componentNameStr, list);
    }
    newList = sortComponentByInternal(newList);
    return newList;
}

export function getReasonableComponentName(componentNameStr) {
    const list = getCurrentComponentList(componentNameStr);
    // dev only one
    let componentName = list[0];
    if (list.length > 1) {
        componentName = list.find((item) => item === 'app');
        if (!componentName) {
            componentName = list[0];
        }
    }
    return componentName;
}

export function getInternalDependencies(force) {
    if (force) {
        state.internalDependencies = null;
    }
    if (state.internalDependencies) {
        return state.internalDependencies;
    }
    const list = getComponentList(true);

    const fullNames = list.map((itemName) => {
        return getComponentFullName(itemName);
    });

    const internalComponents = {};
    fullNames.forEach(function(fullName) {
        internalComponents[fullName] = true;
    });

    const internals = [];
    fullNames.forEach(function(fullName) {
        const conf = getComponentConf(fullName, true);
        if (!conf || !conf.dependencies) {
            return;
        }
        const ids = [];
        for (const k in conf.dependencies) {
            if (internalComponents[k]) {
                ids.push(k);
            }
        }
        if (!ids.length) {
            return;
        }

        const index = internals.indexOf(fullName);
        if (index === -1) {
            internals.splice.apply(internals, [internals.length, 0].concat(ids));
        } else {
            internals.splice.apply(internals, [index, 0].concat(ids));
        }

    });
    // sort first by dependencies

    const internalDependencies = {};
    internals.forEach((item) => {
        internalDependencies[item] = true;
    });

    state.internalDependencies = internalDependencies;
    return internalDependencies;
}

export function getComponentFolderName(componentName) {
    if (state.componentFolderName[componentName]) {
        return state.componentFolderName[componentName];
    }
    const list = getComponentList();
    list.forEach(function(folderName) {
        // cache for folder name first
        state.componentFolderName[folderName] = folderName;
        // cache for full name
        const conf = getComponentConf(folderName);
        if (conf && conf.name) {
            state.componentFolderName[conf.name] = folderName;
        }
    });
    return state.componentFolderName[componentName] || componentName;
}

export function getComponentFullName(componentName) {
    if (state.componentFullName[componentName]) {
        return state.componentFullName[componentName];
    }
    const conf = getComponentConf(componentName);
    if (conf) {
        state.componentFullName[componentName] = conf.name;
        state.componentFullName[conf.name] = conf.name;
        return conf.name;
    }
    return componentName;
}

export function getComponentBuildName(name, postfix = '') {
    let bn = getComponentFullName(name);
    if (bn.indexOf('/') !== -1) {
        bn = bn.split('/').pop();
    }
    return bn + postfix;
}

export function getComponentPath(componentName) {
    if (state.componentsRoot) {
        const folderName = getComponentFolderName(componentName);
        return `${state.componentsRoot}/${folderName}`;
    }
    return state.root;
}

export function getComponentConf(componentName, force) {
    if (force) {
        delete state.componentConf[componentName];
    }
    if (state.componentConf[componentName]) {
        return state.componentConf[componentName];
    }
    const componentPath = getComponentPath(componentName);
    const json = readJSONSync(`${componentPath}/package.json`);
    if (json) {
        state.componentConf[componentName] = json;
    }
    return json;
}

export function saveComponentConf(componentName, conf) {
    if (!conf) {
        return false;
    }
    delete state.componentConf[componentName];
    const componentPath = getComponentPath(componentName);
    return writeJSONSync(`${componentPath}/package.json`, conf);
}

export function copyFileAndMap(filePath, toPath, withMap) {
    fs.cpSync(filePath, toPath, {
        recursive: true
    });
    log(`Copied ${relativePath(filePath)}`);
    if (withMap) {
        const mapFile = getMapFile(filePath);
        if (mapFile) {
            fs.cpSync(mapFile, toPath, {
                recursive: true
            });
            log(`Copied ${relativePath(mapFile)}`);
        }
    }
}

export function copyDir(fromDir, toDir) {
    if (!fs.existsSync(fromDir) || !fs.existsSync(toDir)) {
        return;
    }

    const list = fs.readdirSync(fromDir, {
        withFileTypes: true
    });
    const dirs = [];
    for (const item of list) {
        if (item.isDirectory()) {
            dirs.push(item.name);
        } else if (item.isFile()) {
            fs.copyFileSync(path.resolve(fromDir, item.name), path.resolve(toDir, item.name));
        }
    }

    for (const dir of dirs) {

        const destDir = path.resolve(toDir, dir);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, {
                recursive: true
            });
        }

        copyDir(path.resolve(fromDir, dir), destDir);
    }

}

export function getMapFile(filePath) {
    const mapFile = `${filePath}.map`;
    const isExists = fs.existsSync(mapFile);
    if (isExists) {
        return mapFile;
    }
    return '';
}

export function getFileName(title, maxLen = 60) {
    title = String(title);
    title = title.toLowerCase();
    title = title.replace(/[\\/":|*?<>]/g, '');
    // remove chinese
    title = title.replace(/[\u4e00-\u9fa5]/g, '');
    title = title.trim();
    title = title.replace(/[^0-9a-zA-Z-]/g, '-');
    title = title.replace(/\s+/g, '-');
    if (title.length > maxLen) {
        title = title.substr(0, maxLen);
    }
    return title;
}

export function formatPath(str) {
    if (str) {
        str = str.replace(/\\/g, '/');
    }
    return str;
}

export function relativePath(p, root) {
    p = `${p}`;
    root = `${root || state.root}`;
    let rp = path.relative(root, p);
    rp = formatPath(rp);
    return rp;
}

export function require(filePath) {
    // console.log("require conf path: " + filePath);
    const isExists = fs.existsSync(filePath);
    if (isExists) {
        // console.log("fileModule", fileModule);
        return loadModule(filePath);
    }
}

export function getGitCommit(silent) {
    if (!isGitProject()) {
        return '';
    }

    const sh = runCommand('git log -1 --pretty=format:%h', silent);
    if (sh.code) {
        logRed(sh.stderr);
        return '';
    }
    let commit = `${sh.stdout}`;
    commit = commit.replace(/\n/g, '');
    return commit;
}

export function parseBranchName(stdout) {
    let branchName = `${stdout}`;
    branchName = branchName.trim();
    branchName = branchName.split(/\n/).pop();
    // if met HEAD: origin/HEAD -> origin/develop
    branchName = branchName.split('->').pop();
    branchName = branchName.split('origin/').pop();
    branchName = branchName.trim();
    return branchName;
}

export const getGitBranch = async () => {
    if (!isGitProject()) {
        return '';
    }

    if (state.projectBranch) {
        return state.projectBranch;
    }

    const tasks = [];

    tasks.push('git rev-parse --abbrev-ref HEAD');

    // for local branch
    tasks.push((option) => {
        const branchName = parseBranchName(option.stdout);
        if (branchName === 'HEAD') {
            return 'git branch -r --points-at HEAD';
        }
        option.branchName = branchName;
        option.cmd = '';
        return 0;
    });

    // for points at branch
    tasks.push((option) => {
        if (option.cmd) {
            const branchName = parseBranchName(option.stdout);
            if (!branchName) {
                return 'git branch -r --contains HEAD --sort=committerdate';
            }
            option.branchName = branchName;
            option.cmd = '';
        }
        return 0;
    });

    // for contains branch
    tasks.push((option) => {
        if (option.cmd) {
            const branchName = parseBranchName(option.stdout);
            option.branchName = branchName;
        }
        return 0;
    });

    const option = {
        branchName: '',
        silent: true
    };
    await tasksResolver(tasks, option);

    const branch = option.branchName || 'master';
    state.projectBranch = branch;
    return branch;
};

export function isGitProject() {
    const pathHooksTo = `${state.root}/.git`;
    if (fs.existsSync(pathHooksTo)) {
        return true;
    }
    return false;
}

export const updateVersion = (version) => {
    // update project version
    const pc = getProjectConf(true);
    pc.version = version;
    saveProjectConf(pc);
};

export const getCLIVersion = () => {
    if (state.cliVersion) {
        return state.cliVersion;
    }
    const pkg = require(`${state.cliRoot}/package.json`);
    if (pkg) {
        state.cliVersion = pkg.version;
    }
    return state.cliVersion;
};

export const isDebugging = () => {
    const debugArgRegex = /--inspect(?:-brk|-port)?|--debug-port/;
    const execArgv = process.execArgv.slice();
    if (execArgv.some((arg) => arg.match(debugArgRegex))) {
        return true;
    }
    if (state.option.debug) {
        return true;
    }
    return false;
};

export const goTo = (p) => {
    logCyan(`go to: ${p}`);
    try {
        process.chdir(p);
        return 0;
    } catch (error) {
        logRed(error.message);
        return error.code || 1;
    }
};

export const runCommand = (cmd, silent = false) => {
    try {
        return {
            code: 0,
            stdout: execSync(cmd, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            }),
            stderr: ''
        };
    } catch (error) {
        return {
            code: error.status || 1,
            stdout: `${error.stdout || ''}`,
            stderr: `${error.stderr || error.message || ''}`
        };
    }
};

export const exec = (cmd, option) => {
    const silent = Boolean(option.silent);
    if (!silent) {
        logCyan(`exec: ${cmd}`);
    }
    const sh = runCommand(cmd, silent);
    option.stderr = sh.stderr;
    option.stdout = sh.stdout;
    if (sh.code) {
        logRed(sh.stderr);
    }
    return sh.code;
};

export async function tasksResolver(list, option = {}) {

    const itemHandler = async (item, o) => {
        // change string to exec(cmd)
        if (typeof item === 'string') {
            o.cmd = item;
            item = (oo) => {
                return exec(oo.cmd, oo);
            };
        }

        const exitCode = await item.call(this, option);

        if (typeof exitCode === 'function' || (typeof exitCode === 'string' && exitCode.length > 1)) {
            return itemHandler(exitCode, option);
        }

        return exitCode;
    };

    for (const item of list) {
        const exitCode = await itemHandler(item, option);
        // return if has error and not ignore error
        if (exitCode !== 0 && !option.ignoreError) {
            EC.logRed(`ERROR: task terminated with code: ${exitCode}`);
            return exitCode;
        }
    }

    return 0;
}

export function readdir(p) {
    return new Promise((resolve) => {
        fs.readdir(p, (err, list) => {
            if (err) {
                resolve([]);
                return;
            }
            resolve(list);
        });
    });
}

export function stat(p) {
    return new Promise((resolve) => {
        fs.lstat(p, (err, stats) => {
            if (err) {
                resolve(null);
                return;
            }
            resolve(stats);
        });
    });
}

export function rm(p) {
    return new Promise((resolve) => {
        fs.rm(p, {
            recursive: true,
            force: true,
            maxRetries: 10
        }, (err) => {
            if (err) {
                console.error(err);
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

export function rmSync(p) {
    let ok = true;
    try {
        fs.rmSync(p, {
            recursive: true,
            force: true,
            maxRetries: 10
        });
    } catch (err) {
        console.error(err);
        ok = false;
    }
    return ok;
}

export function forEachTree(tree, callback) {
    if (!tree) {
        return;
    }
    Object.keys(tree).forEach(function(item) {
        forEachTree(tree[item], callback);
        callback(item);
    });
}

export function forEachFile(dir, extList, callback) {
    if (!fs.existsSync(dir)) {
        return;
    }
    const list = fs.readdirSync(dir);
    list.forEach(function(name) {
        const abs = path.resolve(dir, name);
        const info = fs.statSync(abs);
        if (info.isDirectory()) {
            forEachFile(abs, extList, callback);
        } else if (!isList(extList) || extList.includes(path.extname(name)) || extList.includes(name)) {
            callback(name, dir);
        }
    });
}

export function forEachModule(p, callback, nested) {
    const nm = path.resolve(p, 'node_modules');
    if (!fs.existsSync(nm)) {
        return;
    }
    const list = fs.readdirSync(nm);
    list.forEach(function(moduleName) {
        const modulePath = path.resolve(nm, moduleName);
        const info = fs.statSync(modulePath);
        if (!info.isDirectory()) {
            return;
        }
        // scoped module
        if (moduleName.indexOf('@') === 0) {
            const scopedList = fs.readdirSync(modulePath);
            scopedList.forEach(function(scopedModuleName) {
                const scopedModulePath = path.resolve(modulePath, scopedModuleName);
                const stats = fs.statSync(scopedModulePath);
                if (!stats.isDirectory()) {
                    return;
                }
                scopedModuleName = `${moduleName}/${scopedModuleName}`;
                callback(scopedModuleName, scopedModulePath, nested);
                forEachModule(scopedModulePath, callback, true);
            });
            return;
        }
        // normal module
        callback(moduleName, modulePath, nested);
        forEachModule(modulePath, callback, true);
    });
}

export function editFile(from, callback, dest) {
    const content = readFileSync(from);
    const editedContent = callback.call(this, content);
    // compare string
    if (editedContent === content) {
        return content;
    }
    dest = dest || from;
    writeFileSync(dest, editedContent);
    return editedContent;
}

export function editJSON(from, callback, dest) {
    const json = readJSONSync(from);
    const editedJson = callback.call(this, json);
    // can not compare json object
    dest = dest || from;
    writeJSONSync(dest, editedJson);
    return editedJson;
}

export function sortPackageKeys(json = {}) {
    // https://docs.npmjs.com/cli/v8/configuring-npm/package-json
    const orders = [
        'name',
        'version',
        'description',
        'private',

        'type',
        'main',
        'browser',
        'module',

        'bin',
        'exports',
        'types',

        'scripts',

        'workspaces',
        'files',

        'man',
        'directories',

        'keywords',
        'license',
        'author',
        'repository',
        'homepage',
        'bugs',
        'contributors',
        'funding',

        'dependencies',
        'devDependencies',
        'peerDependencies',
        'peerDependenciesMeta',
        'bundleDependencies',
        'optionalDependencies',
        'overrides',

        'engines',
        'os',
        'cpu',

        'config',
        'publishConfig'
    ];

    // auto add license
    json.license = json.license || 'MIT';

    const keys = Object.keys(json);

    // not in keys -1
    keys.forEach((key) => {
        if (orders.indexOf(key) === -1) {
            orders.push(key);
        }
    });

    keys.sort(function(a, b) {
        const ai = orders.indexOf(a);
        const bi = orders.indexOf(b);
        return ai - bi;
    });

    const sorted = {};
    keys.forEach(function(k) {
        sorted[k] = json[k];
    });
    return sorted;
}

export function readFileSync(filePath) {
    if (fs.existsSync(filePath)) {
        // Returns: <string> | <Buffer>
        const buf = fs.readFileSync(filePath);
        if (Buffer.isBuffer(buf)) {
            return buf.toString('utf8');
        }
        return buf;
    }
}

export const readFile = async (filePath) => {
    if (fs.existsSync(filePath)) {
        const buf = await readFileAsync(filePath).catch((e) => {
            console.log(e);
        });
        if (Buffer.isBuffer(buf)) {
            return buf.toString('utf8');
        }
        return buf;
    }
};

export function writeFileSync(filePath, content) {
    if (!fs.existsSync(filePath)) {
        const p = path.dirname(filePath);
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p, {
                recursive: true
            });
        }
    }
    fs.writeFileSync(filePath, content);
}

export const writeFile = async (filePath, content) => {
    if (!fs.existsSync(filePath)) {
        const p = path.dirname(filePath);
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p, {
                recursive: true
            });
        }
    }
    await writeFileAsync(filePath, content).catch((e) => {
        console.log(e);
    });
};

export function readJSONSync(filePath) {
    // do NOT use require, it has cache
    const content = readFileSync(filePath);
    if (content) {
        return JSON.parse(content);
    }
}

export function writeJSONSync(filePath, json) {
    let content = jsonString(json, 4);
    if (!content) {
        logRed('Invalid JSON object');
        return false;
    }
    // end of line
    const EOL = getEOL();
    content = content.replace(/\r|\n/g, EOL);
    content += EOL;
    return writeFileSync(filePath, content);
}

export function jsonParse(str) {

    if (typeof str !== 'string') {
        return str;
    }

    if (!str) {
        return null;
    }

    let json = null;

    // remove BOM \ufeff
    str = str.replace(/^\uFEFF/, '');

    // remove comments
    const reg = /("([^\\"]*(\\.)?)*")|('([^\\']*(\\.)?)*')|(\/{2,}.*?(\r|\n))|(\/\*(\n|.)*?\*\/)/g;
    str = str.replace(reg, function(word) {
        return (/^\/{2,}/).test(word) || (/^\/\*/).test(word) ? '' : word;
    });

    str = str.replace(/\r/g, '');
    str = str.replace(/\n/g, '');

    try {
        json = JSON.parse(str);
    } catch (e) {
        console.log(e);
    }

    return json;
}

export function jsonString(obj, spaces) {

    if (typeof obj === 'string') {
        return obj;
    }

    if (!spaces) {
        spaces = 2;
    }

    let str = '';
    try {
        str = JSON.stringify(obj, null, spaces);
    } catch (e) {
        console.log(e);
    }

    return str;
}

export function getAscKeyObject(obj) {
    const ascObj = {};
    if (obj) {
        Object.keys(obj).sort().forEach(function(k) {
            ascObj[k] = obj[k];
        });
    }
    return ascObj;
}

export function getEOL(content) {
    if (!content) {
        return os.EOL;
    }
    const nIndex = content.lastIndexOf('\n');
    if (nIndex === -1) {
        return os.EOL;
    }
    if (content.substr(nIndex - 1, 1) === '\r') {
        return '\r\n';
    }
    return '\n';
}

export function getCost(time_start, red_duration) {
    const duration = Date.now() - time_start;
    const cost = ` (cost ${DTF(duration)})`;
    if (red_duration && duration >= red_duration) {
        return EC.red(cost);
    }
    return cost;
}

export function shortGuid(guid, last) {
    guid = String(guid);
    if (guid) {
        const list = guid.split('-');
        if (last) {
            guid = list.pop();
        } else {
            guid = list.shift();
        }
    }
    return guid;
}

export function generateGUID() {
    return [8, 4, 4, 4, 12].map(function(idx) {
        const double = idx * 2;
        return Math.ceil(Math.random() * parseFloat(`1e${double > 18 ? 18 : double}`))
            .toString(16)
            .substring(0, idx);
    }).join('-');
}

export const generatePort = (startPort) => {
    return new Promise((resolve) => {
        const server = net.createServer().listen(startPort);
        server.on('listening', function() {
            server.close();
            resolve(startPort);
        });
        server.on('error', function(err) {
            if (err.code === 'EADDRINUSE') {
                generatePort(startPort + 1).then((port) => {
                    resolve(port);
                });
            } else {
                resolve(startPort);
            }
        });
    });
};

export const getInternalIp = () => {
    const n = os.networkInterfaces();
    // console.log(n);
    const list = [];
    for (const k in n) {
        const inter = n[k];
        for (const j in inter) {
            const item = inter[j];
            if (item.family === 'IPv4' && !item.internal) {
                const a = item.address;
                console.log(`Internal IP: ${a}`);
                if (a.startsWith('192.') || a.startsWith('10.')) {
                    list.push(a);
                }
            }
        }
    }
    return list.pop();
};

export const getPublicIp = async () => {
    const apis = [
        'https://icanhazip.com/',
        'https://api.ipify.org/',
        'http://ip.cip.cc/'
    ];
    let pip = '';
    for (const api of apis) {
        let ok = true;
        const res = await axios.get(api, {
            timeout: 2000
        }).catch(function(e) {
            ok = false;
        });
        if (ok && res.data) {
            pip = `${res.data}`.trim();
            break;
        }
    }
    return pip;
};

export const request = async (options) => {
    let err;
    const res = await axios(options).catch((e) => {
        err = e;
    });
    return [err, res];
};

export function removeColor(char) {
    return `${char}`.replace(/\033\[(\d+)m/g, '');
}

export function addColor(text, color, html) {
    if (html) {
        return `<span style="color:${color};">${text}</span>`;
    }
    const colorNameMap = {
        orange: 'yellow'
    };
    color = colorNameMap[color] || color;
    const fn = EC[color];
    if (typeof fn === 'function') {
        return fn(text);
    }
    return text;
}

export function min(current, value) {
    if (typeof current !== 'number' || isNaN(current)) {
        return value;
    }
    if (typeof value !== 'number' || isNaN(value)) {
        return current;
    }
    return Math.min(current, value);
}

export function max(current, value) {
    if (typeof current !== 'number' || isNaN(current)) {
        return value;
    }
    if (typeof value !== 'number' || isNaN(value)) {
        return current;
    }
    return Math.max(current, value);
}

export const getCoveragePercent = (v, t) => {
    let per = 0;
    if (t) {
        per = v / t;
    }
    const str = PF(v, t);
    if (per >= 0.8) {
        return EC.green(str);
    }
    if (per >= 0.5) {
        return EC.yellow(str);
    }
    if (per >= 0) {
        return EC.red(str);
    }
    return str;
};

export function gaugeOutput() {
    gauge.disable();
    console.log.apply(console, arguments);
    gauge.enable();
}

export function gaugeShow(msg, num, total) {
    let per = 0;
    if (total) {
        per = num / total;
    }
    gauge.show(msg, per);
}

export function gaugeHide() {
    gauge.disable();
}

export function log() {
    const list = [];
    const logName = state.jobName || state.command;
    if (logName) {
        list.push(EC.magenta(`[${logName}]`));
    }

    const workerJobHandler = () => {
        if (state.workerId && state.workerLength > 1) {
            list.push(EC.blue(`[w${state.workerId}]`));
        }

        if (state.jobId && state.jobLength > 1) {
            list.push(EC.cyan(`[j${state.jobId}]`));
        }
    };
    workerJobHandler();

    const args = Array.from(arguments);
    if (!args.length && state.componentName) {
        list.push(state.componentName);
    }

    const logs = list.concat(args);
    const msg = logs.join(' ');
    console.log(msg);
    return msg;
}

export function logEnd() {
    const list = [];
    const endName = state.jobName || state.command;
    if (endName) {
        list.push(EC.bg.magenta(`[${endName}]`));
    }

    const args = Array.from(arguments);
    if (args.length) {
        // first one to green, ends with success default
        args[0] = EC.green(args[0]);
    }
    const logs = list.concat(args);

    const msg = logs.join(' ');
    console.log(msg);
    return msg;
}

export function logLine(afterStr = '') {
    let msg = '================================================================================';
    if (afterStr) {
        msg += `\n${afterStr}`;
    }
    console.log(msg);
    return msg;
}

export function logRed(msg) {
    return EC.logRed(msg);
}

export function logGreen(msg) {
    return EC.logGreen(msg);
}

export function logYellow(msg) {
    return EC.logYellow(msg);
}

export function logBlue(msg) {
    return EC.logBlue(msg);
}

export function logMagenta(msg) {
    return EC.logMagenta(msg);
}

export function logCyan(msg) {
    return EC.logCyan(msg);
}

export function logList(list, force) {
    if (list.length < 2 && !force) {
        console.log(list);
        return list;
    }
    const rows = [];
    list.forEach((item, i) => {
        rows.push({
            index: i + 1,
            name: item
        });
    });
    return CG({
        columns: [{
            id: 'index',
            name: 'No.',
            type: 'number',
            maxWidth: 5
        }, {
            id: 'name',
            name: 'Name'
        }],
        rows: rows
    });
}

export function logObject(obj, align) {
    const rows = [];
    const forEachAll = (o, list) => {
        for (const name in o) {
            const value = o[name];
            const item = {
                name: name,
                value: value
            };
            if (value && typeof value === 'object') {
                item.value = '';
                item.subs = [];
                forEachAll(value, item.subs);
            }
            list.push(item);
        }
    };
    forEachAll(obj, rows);

    return CG({
        options: {
            headerVisible: false
        },
        columns: [{
            id: 'name',
            maxWidth: 300,
            align: align ? align : ''
        }, {
            id: 'value',
            maxWidth: 300
        }],
        rows: rows
    });
}

export function logOS(version) {

    const rows = [];

    rows.push({
        name: `${state.name}-cli`,
        value: `v${version}`
    });

    rows.push({
        name: 'Node.js',
        value: process.version
    });

    rows.push({
        name: 'Hostname',
        value: os.hostname()
    });

    rows.push({
        name: 'Platform',
        value: os.platform()
    });

    rows.push({
        name: 'CPUs',
        value: os.cpus().length
    });

    // https://juejin.im/post/5c71324b6fb9a049d37fbb7c
    const totalmem = os.totalmem();
    const totalmemStr = BF(totalmem);
    const freemem = os.freemem();
    const freememStr = BF(freemem);
    const sysUsageStr = PF(totalmem - freemem, totalmem);
    rows.push({
        name: 'Memory',
        value: `free: ${freememStr} / total: ${totalmemStr} = ${sysUsageStr}`
    });

    const memoryUsage = process.memoryUsage();
    const nodeUsageList = [];
    nodeUsageList.push(`rss: ${BF(memoryUsage.rss)}`);
    nodeUsageList.push(`ext: ${BF(memoryUsage.external)}`);
    nodeUsageList.push(`heap: ${PF(memoryUsage.heapUsed, memoryUsage.heapTotal)}`);
    const nodeUsageStr = nodeUsageList.join(' ');
    rows.push({
        name: 'Process',
        value: nodeUsageStr
    });

    CG({
        options: {
            headerVisible: false
        },
        columns: [{
            id: 'name'
        }, {
            id: 'value',
            maxWidth: 100
        }],
        rows: rows
    });
}

export function token(len) {
    let str = Math.random().toString().substr(2);
    if (len) {
        str = str.substr(0, toNum(len));
    }
    return str;
}

export function replace(str, obj, defaultValue) {
    str = `${str}`;
    if (!obj) {
        return str;
    }
    str = str.replace(/\{([^}{]+)\}/g, function(match, key) {
        if (!hasOwn(obj, key)) {
            if (typeof defaultValue !== 'undefined') {
                return defaultValue;
            }
            return match;
        }
        let val = obj[key];
        if (typeof val === 'function') {
            val = val(obj, key);
        }
        if (typeof val === 'undefined') {
            val = '';
        }
        return val;
    });
    return str;
}

export function zero(s, l = 2) {
    s = `${s}`;
    return s.padStart(l, '0');
}

export function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

export function isNum(num) {
    if (typeof num !== 'number' || isNaN(num)) {
        return false;
    }
    const isInvalid = function(n) {
        if (n === Number.MAX_VALUE || n === Number.MIN_VALUE || n === Number.NEGATIVE_INFINITY || n === Number.POSITIVE_INFINITY) {
            return true;
        }
        return false;
    };
    if (isInvalid(num)) {
        return false;
    }
    return true;
}

export function toNum(num, toInt) {
    if (typeof num !== 'number') {
        num = parseFloat(num);
    }
    if (isNaN(num)) {
        num = 0;
    }
    if (toInt && !Number.isInteger(num)) {
        num = Math.round(num);
    }
    return num;
}

export function clamp(num, minValue, maxValue) {
    return Math.max(Math.min(num, maxValue), minValue);
}

export function isDate(date) {
    if (!date || !(date instanceof Date)) {
        return false;
    }
    // is Date Object but Date {Invalid Date}
    if (isNaN(date.getTime())) {
        return false;
    }
    return true;
}

export function toDate(input) {
    if (isDate(input)) {
        return input;
    }
    // fix time zone issue by use "/" replace "-"
    const inputHandler = function(it) {
        if (typeof it !== 'string') {
            return it;
        }
        // do NOT change ISO format: 2020-03-20T19:10:38.358Z
        if (it.indexOf('T') !== -1) {
            return it;
        }
        it = it.split('-').join('/');
        return it;
    };
    input = inputHandler(input);
    let date = new Date(input);
    if (isDate(date)) {
        return date;
    }
    date = new Date();
    return date;
}

export function dateFormat(date, format) {
    date = toDate(date);
    // default format
    format = format || 'yyyy-MM-dd';
    // year
    if ((/([Y|y]+)/).test(format)) {
        const yyyy = `${date.getFullYear()}`;
        format = format.replace(RegExp.$1, yyyy.substr(4 - RegExp.$1.length));
    }
    const o = {
        'M+': date.getMonth() + 1,
        '[D|d]+': date.getDate(),
        '[H|h]+': date.getHours(),
        'm+': date.getMinutes(),
        's+': date.getSeconds(),
        '[Q|q]+': Math.floor((date.getMonth() + 3) / 3),
        'S': date.getMilliseconds()
    };
    const doubleNumberHandler = function() {
        for (const k in o) {
            if (hasOwn(o, k)) {
                const reg = new RegExp(`(${k})`).test(format);
                if (!reg) {
                    continue;
                }
                const str = `${o[k]}`;
                format = format.replace(RegExp.$1, RegExp.$1.length === 1 ? str : `00${str}`.substr(str.length));
            }
        }
    };
    doubleNumberHandler();
    return format;
}

export function getTimestamp(date = new Date(), option = {}) {
    option = {
        weekday: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        timeZoneName: 'short',
        ... option
    };
    return new Intl.DateTimeFormat('en-US', option).format(date);
}

export function isList(data) {
    if (data && data instanceof Array && data.length > 0) {
        return true;
    }
    return false;
}

export function inList(item, list) {
    if (!isList(list)) {
        return false;
    }
    return list.includes(item);
}

export function toList(data, separator) {
    if (data instanceof Array) {
        return data;
    }
    if (typeof data === 'string' && (typeof separator === 'string' || separator instanceof RegExp)) {
        return data.split(separator);
    }
    if (typeof data === 'undefined' || data === null) {
        return [];
    }
    return [data];
}

export function isMatch(item, attr) {
    if (item === attr) {
        return true;
    }
    if (item && attr && typeof attr === 'object') {
        for (const k in attr) {
            if (item[k] !== attr[k]) {
                return false;
            }
        }
        return true;
    }
    return false;
}

export function getListItem(list, attr) {
    if (isList(list)) {
        for (let i = 0, l = list.length; i < l; i++) {
            const item = list[i];
            if (isMatch(item, attr)) {
                return item;
            }
        }
    }
    return null;
}

export function delListItem(list, attr) {
    if (!isList(list)) {
        return list;
    }
    const matchIndexList = [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (isMatch(item, attr)) {
            matchIndexList.push(i);
        }
    }
    matchIndexList.reverse();
    matchIndexList.forEach(function(index) {
        list.splice(index, 1);
    });
    return list;
}

export function doubleMerge(a, b) {
    if (a && b) {
        for (const k in b) {
            let v = b[k];
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                v = {
                    ... a[k], ... v
                };
            }
            a[k] = v;
        }
    }
    return a;
}

export function getValue(data, dotPathStr, defaultValue) {
    if (!dotPathStr) {
        return defaultValue;
    }
    let current = data;
    const list = dotPathStr.split('.');
    const lastKey = list.pop();
    while (current && list.length) {
        const item = list.shift();
        current = current[item];
    }
    if (current && hasOwn(current, lastKey)) {
        const value = current[lastKey];
        if (typeof value !== 'undefined') {
            return value;
        }
    }
    return defaultValue;
}

export function getDefinedValue(list, key, defaultValue) {
    list = toList(list);
    for (let i = 0, l = list.length; i < l; i++) {
        const item = list[i];
        if (item && hasOwn(item, key)) {
            return item[key];
        }
    }
    return defaultValue;
}

export function delay(ms) {
    return new Promise((resolve) => {
        if (ms) {
            setTimeout(resolve, ms);
        } else {
            setImmediate(resolve);
        }
    });
}

export function debounce(callback, wait = 100) {
    let timeout;
    const handler = function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            callback.apply(this, arguments);
        }, wait);
    };
    handler.cancel = () => {
        clearTimeout(timeout);
    };
    return handler;
}

export function BF(v, places = 1, base = 1024) {
    v = toNum(v, true);
    if (v === 0) {
        return '0B';
    }
    let prefix = '';
    if (v < 0) {
        v = Math.abs(v);
        prefix = '-';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    for (let i = 0, l = units.length; i < l; i++) {
        const minValue = Math.pow(base, i);
        const maxValue = Math.pow(base, i + 1);
        if (v > minValue && v < maxValue) {
            const unit = units[i];
            v = prefix + (v / minValue).toFixed(places) + unit;
            break;
        }
    }
    return v;
}

export function DF(timestamp) {
    const t = toDate(timestamp);
    let d = t.getFullYear().toString();
    d += `-${zero(t.getMonth() + 1)}`;
    d += `-${zero(t.getDate())}`;
    return d;
}

export function PF(v, t = 1, digits = 1) {
    v = toNum(v);
    t = toNum(t);
    let per = 0;
    if (t) {
        per = v / t;
    }
    return `${(per * 100).toFixed(digits)}%`;
}

export function TF(v, unit, digits = 1) {
    v = toNum(v, true);
    if (unit) {
        if (unit === 's') {
            v = (v / 1000).toFixed(digits);
        } else if (unit === 'm') {
            v = (v / 1000 / 60).toFixed(digits);
        } else if (unit === 'h') {
            v = (v / 1000 / 60 / 60).toFixed(digits);
        }
        return NF(v) + unit;
    }
    const s = v / 1000;
    const hours = Math.floor(s / 60 / 60);
    const minutes = Math.floor((s - hours * 60 * 60) / 60);
    const seconds = Math.round(s - hours * 60 * 60 - minutes * 60);
    return `${hours}:${zero(minutes)}:${zero(seconds)}`;
}

export function DTF(v, maxV) {
    maxV = maxV || v;
    if (maxV > 60 * 1000) {
        return TF(v);
    }
    return TF(v, 'ms');
}

export function NF(v) {
    v = toNum(v);
    return v.toLocaleString();
}

