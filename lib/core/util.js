const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const axios = require('axios');
const rimraf = require('rimraf');
const shelljs = require('shelljs');
const flatdep = require('flatdep');
const JSON5 = require('json5');
const open = require('open');
const MPW = require('multi-process-worker');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const playwright = require('playwright');
const rc = require('rc');

// 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'
const EC = require('eight-colors');
const CG = require('console-grid');

const Gauge = require('gauge');
const gauge = new Gauge();

// get system number of cpus
const numCPUs = os.cpus().length;
// test single process
// numCPUs = 1;

const npmConfig = rc('npm', {
    registry: 'https://registry.npmjs.org/'
});
// console.log(npmConfig);

const Util = {
    id: 'sf',
    name: 'starfall',
    EC: EC,
    CG: CG,

    numCPUs: numCPUs,
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
    nmRoot: '',
    cliVersion: '',
    componentsRoot: '',
    projectConfPath: '',
    workerLength: 0,
    jobLength: 0,

    initProject: function() {

        Util.cliConf = null;
        Util.projectConf = null;
        Util.projectBranch = '';
        Util.componentConf = {};
        Util.componentList = [];
        Util.componentFolderName = {};
        Util.componentFullName = {};
        Util.componentDependencies = {};

        Util.projectConfPath = path.resolve(Util.root, 'package.json');

        // check project package.json file
        if (!fs.existsSync(Util.projectConfPath)) {
            Util.logRed(`ERROR: Not found package.json: ${Util.projectConfPath}`);
            return false;
        }

        const pc = Util.getProjectConf();
        if (!pc) {
            Util.logRed(`ERROR: Can NOT read package.json: ${Util.projectConfPath}`);
            return false;
        }

        Util.componentsRoot = Util.getComponentRoot();

        return true;
    },

    getComponentRoot: function() {
        // check subs
        Util.componentsRoot = Util.formatPath(path.resolve(Util.root, 'packages'));
        // have sub components folder
        if (!fs.existsSync(Util.componentsRoot)) {
            // Not found subs folder
            // single component
            Util.componentsRoot = '';
        }
        return Util.componentsRoot;
    },

    getTempRoot: function() {
        if (Util.tempRoot) {
            return Util.tempRoot;
        }

        // init temp output
        const tempPath = Util.getConfig('tempPath');
        Util.tempRoot = Util.formatPath(path.resolve(Util.root, tempPath));
        if (!fs.existsSync(Util.tempRoot)) {
            shelljs.mkdir('-p', Util.tempRoot);
        }

        return Util.tempRoot;
    },

    getTemplate: function(templatePath) {
        if (!Util.templateCache) {
            Util.templateCache = {};
        }
        let template = Util.templateCache[templatePath];
        if (!template) {
            template = Util.readFileContentSync(templatePath);
            if (template) {
                Util.templateCache[templatePath] = template;
            } else {
                Util.logRed(`ERROR: Not found template: ${templatePath}`);
            }
        }
        return template;
    },

    getAbout: function(apiId, apiName) {
        const template = Util.getTemplate(`${__dirname}/about.html`);
        return Util.replace(template, {
            apiId: apiId,
            apiName: apiName,
            name: Util.name,
            version: Util.getCLIVersion(),
            timestamp: Util.getTimestamp()
        });
    },

    // ============================================================================

    getProjectConf: function(force) {
        if (force === true) {
            Util.projectConf = null;
        }
        if (!Util.projectConf) {
            if (!Util.projectConfPath) {
                Util.projectConfPath = `${Util.root}/package.json`;
            }
            Util.projectConf = Util.readJSONSync(Util.projectConfPath);
        }
        if (force && typeof force === 'string') {
            return Util.projectConf[force];
        }
        return Util.projectConf;
    },

    saveProjectConf: function(pc) {
        Util.writeJSONSync(Util.projectConfPath, pc);
    },

    mergeOption: function(... args) {
        const option = {};
        args.forEach((item) => {
            if (!item) {
                return;
            }
            Object.keys(item).forEach((k) => {
                const nv = item[k];
                if (Util.hasOwn(option, k)) {
                    const ov = option[k];
                    if (ov && typeof ov === 'object') {
                        if (nv && typeof nv === 'object' && !Array.isArray(nv)) {
                            option[k] = Util.mergeOption(ov, nv);
                            return;
                        }
                    }
                }
                option[k] = nv;
            });
        });
        return option;
    },

    //conf.cli width merge
    getConfig: function(key) {
        let cliConf = Util.cliConf;
        if (!cliConf) {
            const dc = Util.require(`${Util.cliRoot}/scripts/conf.cli.js`);
            const pc = Util.require(`${Util.root}/scripts/conf.cli.js`);
            cliConf = Util.mergeOption(dc, pc);
            Util.cliConf = cliConf;
        }
        return Util.getValue(cliConf, key);
    },

    //proxy and webpack without merge
    getConfModule: function(name) {
        const key = `${name}Conf`;
        if (Util[key]) {
            return Util[key];
        }
        const filename = `conf.${name}.js`;
        let conf = Util.require(`${Util.root}/scripts/${filename}`);
        if (!conf) {
            conf = Util.require(`${Util.cliRoot}/scripts/${filename}`);
        }
        Util[key] = conf;
        return conf;
    },

    createConf: function(name, option) {
        const confModule = Util.getConfModule(name);
        let conf = {};
        if (confModule) {
            try {
                conf = confModule.create(option);
            } catch (e) {
                console.log(e);
            }
        }
        return conf;
    },


    initWebpackConf: function(webpackConf, item, option) {

        //rules handler seems no need now
        //const rules = Util.getValue(webpackConf, 'module.rules');
        //if (rules) {
        // style-loader
        // rules.map((rule) => {
        //     if (!Array.isArray(rule.use)) {
        //         return;
        //     }
        //     const styleLoader = rule.use[0];
        //     if (!styleLoader || styleLoader.loader !== 'style-loader') {
        //         return;
        //     }
        //     return styleLoader;
        // }).filter((it) => it).forEach((styleLoader) => {
        //     console.log(styleLoader);
        // });
        //}

        //plugins handler

        if (!webpackConf.plugins) {
            webpackConf.plugins = [];
        }

        Util.initDefinePlugin(webpackConf, item);

        Util.initCssExtractPlugin(webpackConf, item, option);

    },

    initDefinePlugin: function(webpackConf, item) {
        // DefinePlugin
        if (item.define) {
            const DefinePlugin = require('webpack').DefinePlugin;
            webpackConf.plugins.push(new DefinePlugin(item.define));
        }
    },

    initCssExtractPlugin: function(webpackConf, item, option) {
        if (!item.cssExtract) {
            return;
        }

        // use css.toString();
        // remove style-loader
        if (item.cssExtract === 'string') {
            webpackConf.module.rules.forEach((rule) => {
                if (!Array.isArray(rule.use)) {
                    return;
                }
                const styleLoader = rule.use[0];
                if (!styleLoader || styleLoader.loader !== 'style-loader') {
                    return;
                }

                // remove first one
                rule.use.shift();

            });
            return;
        }

        // MiniCssExtractPlugin

        // using js filename as css filename
        const filename = `${item.buildName}.css`;

        webpackConf.plugins.push(new MiniCssExtractPlugin({
            filename: filename,
            ignoreOrder: true
        }));

        let replaced;
        // replace style-loader with MiniCssExtractPlugin
        webpackConf.module.rules.forEach((rule) => {
            if (!Array.isArray(rule.use)) {
                return;
            }
            const styleLoader = rule.use[0];
            if (!styleLoader || styleLoader.loader !== 'style-loader') {
                return;
            }
            rule.use[0] = {
                loader: MiniCssExtractPlugin.loader,
                options: {
                    esModule: item.esModule
                }
            };

            replaced = true;
            // enable sourceMap
            rule.use.forEach((it) => {
                // only css-loader here
                if (it.loader === 'css-loader') {
                    it.options.sourceMap = true;
                }
            });
        });

        // enable production default, css is biggest when load fonts
        if (item.production) {
            webpackConf.optimization.minimize = true;
        }

        if (replaced) {
            Util.log(EC.green(`cssExtract: ${filename}`));
        }
    },

    getWebpackExternals: function(modules, componentExternals) {
        const externals = [];
        const list = [].concat(modules).concat(componentExternals);
        const rootNames = Util.getConfig('build.rootNames');
        list.forEach(function(item) {
            const rootName = rootNames[item];
            if (rootName && rootName !== item) {
                const newItem = {};

                //An object with { root, amd, commonjs, ... } is only allowed for libraryTarget: 'umd'.
                //It's not allowed for other library targets.

                newItem[item] = {
                    commonjs: item,
                    commonjs2: item,
                    amd: item,
                    root: rootName
                };
                externals.push(newItem);
                externals.push(rootName);
            } else {
                externals.push(item);
            }
        });
        return externals;
    },

    getBeautifyOption: function() {
        let option = Util.readJSONSync(`${Util.root}/.jsbeautifyrc`);
        if (!option) {
            option = Util.readJSONSync(`${Util.cliRoot}/.jsbeautifyrc`);
        }
        if (!option) {
            option = {
                'indent_size': 4,
                'indent_char': ' ',
                'indent_with_tabs': false,
                'editorconfig': false,
                'eol': '\n',
                'end_with_newline': true,
                'indent_level': 0,
                'preserve_newlines': true,
                'max_preserve_newlines': 10,
                'space_in_paren': false,
                'space_in_empty_paren': false,
                'jslint_happy': false,
                'space_after_anon_function': false,
                'space_after_named_function': false,
                'brace_style': 'collapse',
                'unindent_chained_methods': false,
                'break_chained_methods': false,
                'keep_array_indentation': false,
                'unescape_strings': false,
                'wrap_line_length': 0,
                'e4x': false,
                'comma_first': false,
                'operator_position': 'before-newline',
                'indent_empty_lines': false,
                'templating': ['auto']
            };
        }
        return option;
    },

    runHook: (hookName, option) => {
        const hook = Util.getConfig(hookName);
        if (hook) {
            const logs = [EC.bg.magenta('[hook]'), EC.magenta(hookName)];
            console.log(logs.join(' '));
            return hook.call(this, option, Util);
        }
        return 0;
    },

    // ============================================================================

    getComponentList: function(force) {
        if (force) {
            Util.componentList = [];
        }

        if (Util.isList(Util.componentList)) {
            return Util.componentList;
        }

        // single component
        if (!Util.componentsRoot) {
            const pc = Util.getProjectConf();
            Util.componentList = [pc.name];
            return Util.componentList;
        }

        const componentsPath = `${Util.componentsRoot}/`;
        const folderNames = fs.readdirSync(componentsPath);
        folderNames.forEach(function(folderName) {
            const states = fs.statSync(componentsPath + folderName);
            // console.log(states.isDirectory());
            if (states.isDirectory()) {
                const packagePath = `${componentsPath + folderName}/package.json`;
                if (fs.existsSync(packagePath)) {
                    Util.componentList.push(folderName);
                }
            }
        });

        return Util.componentList;
    },

    parseComponentList: function(componentName, list) {
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
            const inList = Util.inList(item, list);
            if (inList) {
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
    },

    sortComponentByInternal: function(list) {

        const internals = Util.getInternalDependencies();

        // internal dependencies should be sorted

        // sort by internal dependencies
        // it should be built first if it's a dependency

        const folderList = [];
        Object.keys(internals).forEach(function(fullName) {
            folderList.push(Util.getComponentFolderName(fullName));
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
    },

    getCurrentComponentList: function(componentNameStr) {
        const list = Util.getComponentList();
        // all
        let newList = list;
        // from args
        if (componentNameStr) {
            newList = Util.parseComponentList(componentNameStr, list);
        }
        newList = Util.sortComponentByInternal(newList);
        return newList;
    },

    getReasonableComponentName: function(componentNameStr) {
        const list = Util.getCurrentComponentList(componentNameStr);
        // dev only one
        let componentName = list[0];
        if (list.length > 1) {
            componentName = list.find((item) => item === 'app');
            if (!componentName) {
                componentName = list[0];
            }
        }
        return componentName;
    },

    getInternalDependencies: function(force) {
        if (force) {
            Util.internalDependencies = null;
        }
        if (Util.internalDependencies) {
            return Util.internalDependencies;
        }
        const list = Util.getComponentList(true);

        const fullNames = list.map((itemName) => {
            return Util.getComponentFullName(itemName);
        });

        const internalComponents = {};
        fullNames.forEach(function(fullName) {
            internalComponents[fullName] = true;
        });

        const internals = [];
        fullNames.forEach(function(fullName) {
            const conf = Util.getComponentConf(fullName, true);
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

        Util.internalDependencies = internalDependencies;
        return internalDependencies;
    },

    // ============================================================================

    getComponentFolderName: function(componentName) {
        if (Util.componentFolderName[componentName]) {
            return Util.componentFolderName[componentName];
        }
        const list = Util.getComponentList();
        list.forEach(function(folderName) {
            // cache for folder name first
            Util.componentFolderName[folderName] = folderName;
            // cache for full name
            const conf = Util.getComponentConf(folderName);
            if (conf && conf.name) {
                Util.componentFolderName[conf.name] = folderName;
            }
        });
        return Util.componentFolderName[componentName] || componentName;
    },

    getComponentFullName: function(componentName) {
        if (Util.componentFullName[componentName]) {
            return Util.componentFullName[componentName];
        }
        const conf = Util.getComponentConf(componentName);
        if (conf) {
            Util.componentFullName[componentName] = conf.name;
            Util.componentFullName[conf.name] = conf.name;
            return conf.name;
        }
        return componentName;
    },

    getComponentBuildName: function(name) {
        let bn = Util.getComponentFullName(name);
        if (bn.indexOf('/') !== -1) {
            bn = bn.split('/').pop();
        }
        return bn;
    },

    getComponentPath: function(componentName) {
        if (Util.componentsRoot) {
            const folderName = Util.getComponentFolderName(componentName);
            return `${Util.componentsRoot}/${folderName}`;
        }
        return Util.root;
    },

    getComponentConf: function(componentName, force) {
        if (force) {
            delete Util.componentConf[componentName];
        }
        if (Util.componentConf[componentName]) {
            return Util.componentConf[componentName];
        }
        const componentPath = Util.getComponentPath(componentName);
        const json = Util.readJSONSync(`${componentPath}/package.json`);
        if (json) {
            Util.componentConf[componentName] = json;
        }
        return json;
    },

    saveComponentConf: function(componentName, conf) {
        if (!conf) {
            return false;
        }
        delete Util.componentConf[componentName];
        const componentPath = Util.getComponentPath(componentName);
        return Util.writeJSONSync(`${componentPath}/package.json`, conf);
    },

    // ============================================================================

    getBuildOverrides: function() {
        const overrides = Util.getConfig('build.overrides');
        if (overrides) {
            const mode = Util.option.production ? 'production' : 'development';
            Object.keys(overrides).forEach((key) => {
                const item = overrides[key];
                const v = item[`main_${mode}`];
                if (v) {
                    item.main = v;
                }
            });
        }
        return overrides;
    },

    getComponentDependencies: function(componentName, force) {

        // console.log("Get component dependencies ...");

        // use full name for dependencies
        componentName = Util.getComponentFullName(componentName);
        if (force) {
            Util.componentDependencies = {};
        }
        let d = Util.componentDependencies[componentName];
        if (d) {
            return d;
        }

        const exclude = Util.getConfig('build.exclude');
        const include = Util.getConfig('build.include');
        const overrides = Util.getBuildOverrides();

        const entry = Util.getComponentPath(componentName);

        d = flatdep({
            entry: entry,
            target: Util.root,
            nodeModules: Util.root,
            exclude: exclude,
            include: include,
            overrides: overrides
        });

        if (d.error) {
            console.log(EC.red(d.error));
            return null;
        }

        const depPath = `${Util.getTempRoot()}/dep/`;
        if (!fs.existsSync(depPath)) {
            shelljs.mkdir('-p', depPath);
        }
        Util.writeJSONSync(`${depPath + componentName}.json`, d, true);

        Util.componentDependencies[componentName] = d;
        return d;

    },

    getModuleFiles: function(modulePath, moduleConf, option) {
        return flatdep.getModuleFiles(modulePath, moduleConf, option);
    },

    getComponentFiles: function() {
        const list = Array.from(arguments);
        let files = [];
        list.forEach((it) => {
            if (Util.isList(it)) {
                files = files.concat(it);
            }
        });
        files = files.filter((it) => it);
        return files;
    },

    getInjectFiles: (item) => {
        const list = [];
        if (item) {
            if (item.dependencies) {
                list.push(item.dependencies.files);
            }
            list.push(item.buildFiles);
        }
        return Util.getComponentFiles.apply(Util, list);
    },

    // ============================================================================

    copyFileAndMap: function(filePath, toPath) {
        shelljs.cp('-R', filePath, toPath);
        Util.log(`Copied ${Util.relativePath(filePath)}`);

        const mapFile = Util.getMapFile(filePath);
        if (mapFile) {
            shelljs.cp('-R', mapFile, toPath);
            Util.log(`Copied ${Util.relativePath(mapFile)}`);
        }
    },

    getMapFile: function(filePath) {
        const mapFile = `${filePath}.map`;
        const isExists = fs.existsSync(mapFile);
        if (isExists) {
            return mapFile;
        }
        return '';
    },

    getFileName: function(title, maxLen = 60) {
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
    },

    // \ to /
    formatPath: function(str) {
        if (str) {
            str = str.replace(/\\/g, '/');
        }
        return str;
    },

    relativePath: function(p, root) {
        p = `${p}`;
        root = `${root || Util.root}`;
        let rp = path.relative(root, p);
        rp = Util.formatPath(rp);
        return rp;
    },

    require: function(filePath) {
        // console.log("require conf path: " + filePath);
        const isExists = fs.existsSync(filePath);
        if (isExists) {
            // console.log("fileModule", fileModule);
            return require(filePath);
        }
    },

    getGitCommit: function(silent) {
        if (!Util.isGitProject()) {
            return '';
        }

        const sh = shelljs.exec('git log -1 --pretty=format:%h', {
            silent: silent
        });
        if (sh.code) {
            Util.logRed(sh.stderr);
            return '';
        }
        let commit = `${sh.stdout}`;
        commit = commit.replace(/\n/g, '');
        return commit;
    },

    parseBranchName: function(stdout) {
        let branchName = `${stdout}`;
        branchName = branchName.trim();
        branchName = branchName.split(/\n/).pop();
        // if met HEAD: origin/HEAD -> origin/develop
        branchName = branchName.split('->').pop();
        branchName = branchName.split('origin/').pop();
        branchName = branchName.trim();
        return branchName;
    },

    getGitBranch: async () => {
        if (!Util.isGitProject()) {
            return '';
        }

        if (Util.projectBranch) {
            return Util.projectBranch;
        }

        const tasks = [];

        tasks.push('git rev-parse --abbrev-ref HEAD');

        // for local branch
        tasks.push((option) => {
            const branchName = Util.parseBranchName(option.stdout);
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
                const branchName = Util.parseBranchName(option.stdout);
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
                const branchName = Util.parseBranchName(option.stdout);
                option.branchName = branchName;
            }
            return 0;
        });

        const option = {
            branchName: '',
            silent: true
        };
        await Util.tasksResolver(tasks, option);

        const branch = option.branchName || 'master';
        Util.projectBranch = branch;
        return branch;
    },

    initGitHooks: function() {

        const gitHook = Util.getConfig('precommit.gitHook');
        if (!gitHook) {
            return;
        }

        const pathHooksTo = `${Util.root}/.git/hooks`;
        if (!fs.existsSync(pathHooksTo)) {
            return;
        }

        const pathHooksFrom = `${Util.cliRoot}/lib/precommit/hooks/`;
        if (!fs.existsSync(pathHooksFrom)) {
            return;
        }

        const files = fs.readdirSync(pathHooksFrom);
        if (!files.length) {
            return;
        }

        files.forEach(function(file, index) {
            const c = fs.readFileSync(`${pathHooksFrom}/${file}`);
            const curPath = `${pathHooksTo}/${file}`;
            if (fs.existsSync(curPath)) {
                // fs.unlinkSync(curPath);
                return;
            }
            fs.writeFileSync(curPath, c);
        });
    },

    isGitProject: function() {
        const pathHooksTo = `${Util.root}/.git`;
        if (fs.existsSync(pathHooksTo)) {
            return true;
        }
        return false;
    },

    // ============================================================================

    updateVersion: (version) => {
        // update project version
        const pc = Util.getProjectConf(true);
        pc.version = version;
        Util.saveProjectConf(pc);
    },

    getCLIVersion: () => {
        if (Util.cliVersion) {
            return Util.cliVersion;
        }
        const cliConf = Util.require(`${Util.cliRoot}/package.json`);
        if (cliConf) {
            Util.cliVersion = cliConf.version;
        }
        return Util.cliVersion;
    },

    // ============================================================================

    isDebugging: () => {
        const debugArgRegex = /--inspect(?:-brk|-port)?|--debug-port/;
        const execArgv = process.execArgv.slice();
        if (execArgv.some((arg) => arg.match(debugArgRegex))) {
            return true;
        }
        if (Util.option.debug) {
            return true;
        }
        return false;
    },

    // ============================================================================

    // default to true
    getMultiprocessing: () => {
        let multiprocessing = true;
        const cp = Util.option.cp;
        if (cp) {
            multiprocessing = parseInt(cp);
        }
        if (Util.isNum(multiprocessing)) {
            if (multiprocessing > 0) {
                return Math.ceil(multiprocessing);
            }
            return false;
        }
        return true;
    },

    getWorkerOption: function(others) {
        return {
            command: Util.command,
            root: Util.root,
            cliRoot: Util.cliRoot,
            nmRoot: Util.nmRoot,
            registry: Util.registry,
            tempRoot: Util.getTempRoot(),
            componentsRoot: Util.componentsRoot,
            projectConfPath: Util.projectConfPath,
            workerLength: Util.workerLength,
            jobLength: Util.jobLength,
            option: Util.option,
            ... others
        };
    },

    setWorkerOption: function(workerOption) {
        // require workerOption workerId
        for (const k in workerOption) {
            Util[k] = workerOption[k];
        }
    },

    initWorkerLength: (option) => {

        if (Util.isNum(option.workerLength)) {
            return;
        }

        // init workerLength
        if (Util.isDebugging()) {
            // debug mode
            console.log(EC.yellow('multiprocessing disabled in debugging'));
            option.workerLength = 1;
        } else {
            // multiprocessing
            const num = Util.getMultiprocessing();
            if (num) {
                console.log(EC.green(`multiprocessing enabled: ${num}`));
                if (Util.isNum(num)) {
                    option.workerLength = num;
                }
            } else {
                console.log(EC.yellow(`multiprocessing disabled for ${option.name}.`));
                option.workerLength = 1;
            }
        }
    },

    startWorker: (option) => {

        option.failFast = true;

        Util.initWorkerLength(option);

        // test
        // option.workerLength = 16;

        option.onStart = (o) => {
            Util.workerLength = o.workerLength;
            Util.jobLength = o.jobLength;
            // update worker option
            o.workerOption = Util.getWorkerOption();
        };

        option.onJobStart = (job) => {
            const jobName = EC.magenta(`[${job.jobName}]`);
            console.log(`${jobName} start ${job.name}`);
        };

        option.onJobFinish = (job, o) => {
            const stats = o.stats;
            const arr = [];
            //finish stats using bg color
            arr.push(EC.bg.magenta(`[${job.jobName}]`));
            arr.push(`finish ${job.name}`);
            arr.push(`(${job.jobId}/${Util.jobLength})`);
            arr.push(`cost: ${Util.DTF(job.duration)}/${stats.elapsedTimeH}`);
            if (Util.jobLength > 1) {
                arr.push(`percent: ${stats.percentH}`);
                arr.push(EC.cyan(`(estimated: ${stats.estimatedTimeH})`));
            }
            const str = arr.join(' ');
            console.log(str);
        };

        const reportHandler = option.reportHandler;
        option.onFinish = async (o) => {
            // report handler
            if (typeof reportHandler === 'function') {
                delete o.reportHandler;
                await reportHandler(o);
            }
            if (o.code !== 0) {
                // exit error
                console.log('');
                if (o.exitError) {
                    Util.logRed(o.exitError);
                }
                Util.logRed(`${o.name}: job(s) stopped with error: ${o.code}`);
                console.log('');
            }
        };

        return MPW(option);
    },

    // init sub process
    initWorker: function(workerHandler) {
        process.on('message', async (message) => {
            if (message.type === 'workerStart') {
                Util.setWorkerOption(message.data);
                process.send({
                    type: 'workerOnline'
                });
                return;
            }
            if (message.type === 'jobStart') {
                const job = message.data;
                job.code = await workerHandler(job);
                process.send({
                    type: 'jobFinish',
                    data: job
                });

            }
        });
    },

    // ============================================================================
    goTo: (p) => {
        Util.logCyan(`go to: ${p}`);
        const sh = shelljs.cd(p);
        if (sh.code) {
            Util.logRed(sh.stderr);
        }
        return sh.code;
    },

    open: async (p, msg) => {
        console.log(msg || 'try to open report ... ');
        await open(p);
        // wait for app opened then close process
        await Util.delay(2000);
    },

    exec: (cmd, option) => {
        const silent = Boolean(option.silent);
        if (!silent) {
            Util.logCyan(`exec: ${cmd}`);
        }
        const sh = shelljs.exec(cmd, {
            silent: silent
        });
        option.stderr = sh.stderr;
        option.stdout = sh.stdout;
        if (sh.code) {
            Util.logRed(sh.stderr);
        }
        return sh.code;
    },

    tasksResolver: async function(list, option = {}) {

        const itemHandler = async (item, o) => {
            // change string to exec(cmd)
            if (typeof item === 'string') {
                o.cmd = item;
                item = (oo) => {
                    return Util.exec(oo.cmd, oo);
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
    },

    // ============================================================================

    readdir(p) {
        return new Promise((resolve) => {
            fs.readdir(p, (err, list) => {
                if (err) {
                    resolve([]);
                    return;
                }
                resolve(list);
            });
        });
    },

    stat(p) {
        return new Promise((resolve) => {
            fs.lstat(p, (err, stats) => {
                if (err) {
                    resolve(null);
                    return;
                }
                resolve(stats);
            });
        });
    },

    rm(f, option = {}) {
        return new Promise((resolve) => {
            rimraf(f, option, function(err) {
                if (err) {
                    console.log(err);
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    },

    rmSync(f, option = {}) {
        let res;
        try {
            res = rimraf.sync(f, option);
        } catch (e) {
            console.log(e);
        }
        return res;
    },

    forEachTree: function(tree, callback) {
        if (!tree) {
            return;
        }
        Object.keys(tree).forEach(function(item) {
            Util.forEachTree(tree[item], callback);
            callback(item);
        });
    },

    forEachFile: function(dir, extList, callback) {
        const list = fs.readdirSync(dir);
        list.forEach(function(name) {
            const abs = path.resolve(dir, name);
            const info = fs.statSync(abs);
            if (info.isDirectory()) {
                Util.forEachFile(abs, extList, callback);
            } else if (!Util.isList(extList) || extList.includes(path.extname(name)) || extList.includes(name)) {
                callback(name, dir);
            }
        });
    },

    forEachModule: function(p, callback, nested) {
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
                    const stat = fs.statSync(scopedModulePath);
                    if (!stat.isDirectory()) {
                        return;
                    }
                    scopedModuleName = `${moduleName}/${scopedModuleName}`;
                    callback(scopedModuleName, scopedModulePath, nested);
                    Util.forEachModule(scopedModulePath, callback, true);
                });
                return;
            }
            // normal module
            callback(moduleName, modulePath, nested);
            Util.forEachModule(modulePath, callback, true);
        });
    },

    // ============================================================================

    editFile: function(p, callback) {
        const content = Util.readFileContentSync(p);
        const editedContent = callback.call(this, content);
        // compare string
        if (editedContent === content) {
            return content;
        }
        Util.writeFileContentSync(p, editedContent, true);
        return editedContent;
    },

    editJSON: function(p, callback) {
        const json = Util.readJSONSync(p);
        const editedJson = callback.call(this, json);
        // can not compare json object
        Util.writeJSONSync(p, editedJson, true);
        return editedJson;
    },

    // ============================================================================

    readFileContentSync: function(filePath) {
        let content = null;
        const isExists = fs.existsSync(filePath);
        if (isExists) {
            content = fs.readFileSync(filePath);
            if (Buffer.isBuffer(content)) {
                content = content.toString('utf8');
            }
        }
        return content;
    },

    writeFileContentSync: function(filePath, content, force = true) {
        const isExists = fs.existsSync(filePath);
        if (force || isExists) {
            const p = path.dirname(filePath);
            if (!fs.existsSync(p)) {
                fs.mkdirSync(p, {
                    recursive: true
                });
            }
            fs.writeFileSync(filePath, content);
            return true;
        }
        return false;
    },

    // ============================================================================

    readJSONSync: function(filePath) {
        // do NOT use require, it has cache
        const content = Util.readFileContentSync(filePath);
        let json = null;
        if (content) {
            json = JSON5.parse(content);
        }
        return json;
    },

    writeJSONSync: function(filePath, json, force = true) {
        let content = Util.jsonString(json, 4);
        if (!content) {
            Util.logRed('Invalid JSON object');
            return false;
        }
        // end of line
        const EOL = Util.getEOL();
        content = content.replace(/\r|\n/g, EOL);
        content += EOL;
        return Util.writeFileContentSync(filePath, content, force);
    },

    jsonParse: function(str) {

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
    },

    jsonString: function(obj, spaces) {

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
    },

    // ============================================================================

    getAscKeyObject: function(obj) {
        const ascObj = {};
        if (obj) {
            Object.keys(obj).sort().forEach(function(k) {
                ascObj[k] = obj[k];
            });
        }
        return ascObj;
    },

    getEOL: function(content) {
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
    },

    getCost: function(time_start, red_duration) {
        const duration = Date.now() - time_start;
        const cost = ` (cost ${Util.DTF(duration)})`;
        if (red_duration && duration >= red_duration) {
            return EC.red(cost);
        }
        return cost;
    },

    shortGuid: function(guid, last) {
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
    },

    generateGUID: function() {
        return [8, 4, 4, 4, 12].map(function(idx) {
            const double = idx * 2;
            return Math.ceil(Math.random() * parseFloat(`1e${double > 18 ? 18 : double}`))
                .toString(16)
                .substring(0, idx);
        }).join('-');
    },

    generatePort: (startPort) => {
        return new Promise((resolve) => {
            const server = net.createServer().listen(startPort);
            server.on('listening', function() {
                server.close();
                resolve(startPort);
            });
            server.on('error', function(err) {
                if (err.code === 'EADDRINUSE') {
                    Util.generatePort(startPort + 1).then((port) => {
                        resolve(port);
                    });
                } else {
                    resolve(startPort);
                }
            });
        });
    },

    getInternalIp: () => {
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
    },

    getPublicIp: async () => {
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
    },

    // ===================================================================================

    getBrowserDataDir: function() {
        return `${Util.getTempRoot()}/browser-data-dir`;
    },

    getBrowserDataCacheDir: function() {
        return `${Util.getBrowserDataDir()}/temp-${Util.token(8)}`;
    },

    getBrowserType: function(str = '') {
        const b = `${str}`.toLowerCase().trim();
        const browsers = {
            cr: 'chromium',
            chrome: 'chromium',
            chromium: 'chromium',
            ff: 'firefox',
            firefox: 'firefox',
            wk: 'webkit',
            webkit: 'webkit'
        };
        return browsers[b] || browsers.chromium;
    },

    cleanBrowserDataCacheDir: function() {
        const bdd = Util.getBrowserDataDir();
        if (!fs.existsSync(bdd)) {
            return;
        }
        const dirs = fs.readdirSync(bdd);
        if (!dirs.length) {
            return;
        }
        Util.log('cleaning up ...');
        dirs.forEach(function(folderName) {
            const dir = `${bdd}/${folderName}`;
            const info = fs.statSync(dir);
            if (info.isDirectory()) {
                // out time 2m
                const duration = Date.now() - new Date(info.mtime).getTime();
                // console.log(duration);
                if (duration > 2 * 60 * 1000) {
                    Util.rmSync(dir);
                }
            }
        });

    },

    // https://playwright.dev/docs/api/class-browsertype#browser-type-launch
    getBrowserLaunchArgs: function(list = []) {
        return [
            '--no-sandbox',
            '--no-default-browser-check',
            '--disable-setuid-sandbox',
            '--disable-translate',
            '--disable-gpu',
            '--disable-infobars',
            '--disable-notifications',
            '--disable-save-password-bubble',
            '--start-maximized'
        ].concat(list);
    },

    // https://playwright.dev/docs/api/class-browsertype#browser-type-launch
    getBrowserLaunchIgnoreArgs: function(list = []) {
        return [
            '--hide-scrollbars',
            '--enable-automation'
        ].concat(list);
    },

    launchBrowser: async (option) => {
        const time_start = Date.now();

        const cacheDir = Util.getBrowserDataCacheDir();

        // playwright will clean cache by self
        const browserOption = {
            downloadsPath: cacheDir,
            tracesDir: cacheDir,
            args: Util.getBrowserLaunchArgs(),
            ignoreDefaultArgs: Util.getBrowserLaunchIgnoreArgs()
        };

        // devtools for debug
        // If this option is true, the headless option will be set false
        if (option.debug) {
            browserOption.devtools = true;
            if (option.debug !== true) {
                const slowMo = Util.toNum(option.debug);
                if (slowMo) {
                    browserOption.slowMo = slowMo;
                }
            }
        }

        Util.log(option.name, '[browser] launch ...');
        const browserType = Util.getBrowserType(option.browser);
        const browser = await playwright[browserType].launch(browserOption);

        const v = await browser.version();
        Util.log(option.name, `[browser] ${EC.green('launched')} ${browserType} ${v}${Util.getCost(time_start, 3000)}`);
        return browser;
    },

    getGridContent: function() {
        const gridFile = 'turbogrid/dist/turbogrid.js';
        const gridPath = `${Util.nmRoot}/node_modules/${gridFile}`;
        return Util.readFileContentSync(gridPath);
    },

    // ===================================================================================

    removeColor: function(char) {
        return `${char}`.replace(/\033\[(\d+)m/g, '');
    },

    addColor: function(text, color, html) {
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
    },

    min: function(current, value) {
        if (typeof current !== 'number' || isNaN(current)) {
            return value;
        }
        if (typeof value !== 'number' || isNaN(value)) {
            return current;
        }
        return Math.min(current, value);
    },

    max: function(current, value) {
        if (typeof current !== 'number' || isNaN(current)) {
            return value;
        }
        if (typeof value !== 'number' || isNaN(value)) {
            return current;
        }
        return Math.max(current, value);
    },

    getCoveragePercent: (v, t) => {
        let per = 0;
        if (t) {
            per = v / t;
        }
        const str = Util.PF(v, t);
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
    },

    // ============================================================================

    gaugeOutput: function() {
        gauge.disable();
        console.log.apply(console, arguments);
        gauge.enable();
    },

    gaugeShow: function(msg, num, total) {
        let per = 0;
        if (total) {
            per = num / total;
        }
        gauge.show(msg, per);
    },

    gaugeHide: function() {
        gauge.disable();
    },

    // ============================================================================

    log: function() {
        const list = [];
        const logName = Util.jobName || Util.command;
        if (logName) {
            list.push(EC.magenta(`[${logName}]`));
        }

        const workerJobHandler = () => {
            if (Util.workerId && Util.workerLength > 1) {
                list.push(EC.blue(`[w${Util.workerId}]`));
            }

            if (Util.jobId && Util.jobLength > 1) {
                list.push(EC.cyan(`[j${Util.jobId}]`));
            }
        };
        workerJobHandler();

        const args = Array.from(arguments);
        if (!args.length && Util.componentName) {
            list.push(Util.componentName);
        }

        const logs = list.concat(args);
        const msg = logs.join(' ');
        console.log(msg);
        return msg;
    },

    logEnd: function() {
        const list = [];
        const endName = Util.jobName || Util.command;
        if (endName) {
            list.push(EC.bg.magenta(`[${endName}]`));
        }

        const args = Array.from(arguments);
        if (args.length) {
            //first one to green, ends with success default
            args[0] = EC.green(args[0]);
        }
        const logs = list.concat(args);

        const msg = logs.join(' ');
        console.log(msg);
        return msg;
    },

    logLine: function(afterStr = '') {
        let msg = '================================================================================';
        if (afterStr) {
            msg += `\n${afterStr}`;
        }
        console.log(msg);
        return msg;
    },

    logRed: function(msg) {
        return EC.logRed(msg);
    },

    logYellow: function(msg) {
        return EC.logYellow(msg);
    },

    logGreen: function(msg) {
        return EC.logGreen(msg);
    },

    logCyan: function(msg) {
        return EC.logCyan(msg);
    },

    logList: function(list, force) {
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
    },

    logObject: function(obj, align) {
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
    },

    logOS: function(version) {

        const rows = [];

        rows.push({
            name: `${Util.name}-cli`,
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
        const totalmemStr = Util.BF(totalmem);
        const freemem = os.freemem();
        const freememStr = Util.BF(freemem);
        const sysUsageStr = Util.PF(totalmem - freemem, totalmem);
        rows.push({
            name: 'Memory',
            value: `free: ${freememStr} / total: ${totalmemStr} = ${sysUsageStr}`
        });

        const memoryUsage = process.memoryUsage();
        const nodeUsageList = [];
        nodeUsageList.push(`rss: ${Util.BF(memoryUsage.rss)}`);
        nodeUsageList.push(`ext: ${Util.BF(memoryUsage.external)}`);
        nodeUsageList.push(`heap: ${Util.PF(memoryUsage.heapUsed, memoryUsage.heapTotal)}`);
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
    },

    // ============================================================================
    // string
    token: function(len) {
        let str = Math.random().toString().substr(2);
        if (len) {
            str = str.substr(0, Util.toNum(len));
        }
        return str;
    },

    replace: function(str, obj, defaultValue) {
        str = `${str}`;
        if (!obj) {
            return str;
        }
        str = str.replace(/\{([^}{]+)\}/g, function(match, key) {
            if (!Util.hasOwn(obj, key)) {
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
    },

    zero: function(s, l = 2) {
        s = `${s}`;
        return s.padStart(l, '0');
    },

    hasOwn: function(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    },

    // ============================================================================
    // number
    isNum: function(num) {
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
    },

    // format to a valid number
    toNum: function(num, toInt) {
        if (typeof num !== 'number') {
            num = parseFloat(num);
        }
        if (isNaN(num)) {
            num = 0;
        }
        if (toInt) {
            num = Math.round(num);
        }
        return num;
    },

    clamp: function(num, min, max) {
        return Math.max(Math.min(num, max), min);
    },

    // ============================================================================
    // date
    isDate: function(date) {
        if (!date || !(date instanceof Date)) {
            return false;
        }
        // is Date Object but Date {Invalid Date}
        if (isNaN(date.getTime())) {
            return false;
        }
        return true;
    },

    toDate: function(input) {
        if (Util.isDate(input)) {
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
        if (Util.isDate(date)) {
            return date;
        }
        date = new Date();
        return date;
    },

    dateFormat: function(date, format) {
        date = Util.toDate(date);
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
                if (Util.hasOwn(o, k)) {
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
    },

    getTimestamp: function(date = new Date(), option = {}) {
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
    },

    // ============================================================================
    // array
    isList: function(data) {
        if (data && data instanceof Array && data.length > 0) {
            return true;
        }
        return false;
    },

    inList: function(item, list) {
        if (!Util.isList(list)) {
            return false;
        }
        return list.includes(item);
    },

    toList: function(data, separator) {
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
    },

    isMatch: function(item, attr) {
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
    },

    getListItem: function(list, attr) {
        if (Util.isList(list)) {
            for (let i = 0, l = list.length; i < l; i++) {
                const item = list[i];
                if (Util.isMatch(item, attr)) {
                    return item;
                }
            }
        }
        return null;
    },

    delListItem: function(list, attr) {
        if (!Util.isList(list)) {
            return list;
        }
        const matchIndexList = [];
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (Util.isMatch(item, attr)) {
                matchIndexList.push(i);
            }
        }
        matchIndexList.reverse();
        matchIndexList.forEach(function(index) {
            list.splice(index, 1);
        });
        return list;
    },

    doubleMerge: function(a, b) {
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
    },

    // ============================================================================
    // object
    getValue: function(data, dotPathStr, defaultValue) {
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
        if (current && Util.hasOwn(current, lastKey)) {
            const value = current[lastKey];
            if (typeof value !== 'undefined') {
                return value;
            }
        }
        return defaultValue;
    },

    getDefinedValue: function(list, key, defaultValue) {
        list = Util.toList(list);
        for (let i = 0, l = list.length; i < l; i++) {
            const item = list[i];
            if (item && Util.hasOwn(item, key)) {
                return item[key];
            }
        }
        return defaultValue;
    },

    // ============================================================================
    // async
    delay: function(ms) {
        return new Promise((resolve) => {
            if (ms) {
                setTimeout(resolve, ms);
            } else {
                setImmediate(resolve);
            }
        });
    },

    // ============================================================================
    // formatters

    // byte
    BF: function(v, digits = 1, base = 1024) {
        v = Util.toNum(v, true);
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
            const min = Math.pow(base, i);
            const max = Math.pow(base, i + 1);
            if (v > min && v < max) {
                const unit = units[i];
                v = prefix + (v / min).toFixed(digits) + unit;
                break;
            }
        }
        return v;
    },

    // date
    DF: function(timestamp) {
        const t = Util.toDate(timestamp);
        let d = t.getFullYear().toString();
        d += `-${Util.zero(t.getMonth() + 1)}`;
        d += `-${Util.zero(t.getDate())}`;
        return d;
    },

    // percent
    PF: function(v, t = 1, digits = 1) {
        v = Util.toNum(v);
        t = Util.toNum(t);
        let per = 0;
        if (t) {
            per = v / t;
        }
        return `${(per * 100).toFixed(digits)}%`;
    },

    // time
    TF: function(v, unit, digits = 1) {
        v = Util.toNum(v, true);
        if (unit) {
            if (unit === 's') {
                v = (v / 1000).toFixed(digits);
            } else if (unit === 'm') {
                v = (v / 1000 / 60).toFixed(digits);
            } else if (unit === 'h') {
                v = (v / 1000 / 60 / 60).toFixed(digits);
            }
            return Util.NF(v) + unit;
        }
        const s = v / 1000;
        const hours = Math.floor(s / 60 / 60);
        const minutes = Math.floor((s - hours * 60 * 60) / 60);
        const seconds = Math.round(s - hours * 60 * 60 - minutes * 60);
        return `${hours}:${Util.zero(minutes)}:${Util.zero(seconds)}`;
    },

    // duration time
    DTF: function(v, maxV) {
        maxV = maxV || v;
        if (maxV > 60 * 1000) {
            return Util.TF(v);
        }
        return Util.TF(v, 'ms');
    },

    // number
    NF: function(v) {
        v = Util.toNum(v);
        return v.toLocaleString();
    }

};

module.exports = Util;
