const fs = require('fs');
const path = require('path');
const EC = require('eight-colors');
const buildWebpack = require('./build-webpack.js');
const buildEsbuild = require('./build-esbuild.js');
const injectHandler = require('../inject/inject.js');
const Util = require('../core/util.js');

const removeFiles = (list) => {
    list.forEach((item) => {
        if (fs.existsSync(item)) {
            console.log(`remove ${Util.relativePath(item)} ...`);
            Util.rmSync(item);
        }
    });
};

const cleanMapsBeforeBuild = (item) => {
    const list = [];
    Util.forEachFile(item.buildPath, ['.map'], (filename, dir) => {
        list.push(Util.relativePath(path.resolve(dir, filename)));
    });
    removeFiles(list);
};

// remove .js/.css and .map on demand
const cleanFilesAfterBuild = (item, buildFiles, moduleFiles) => {

    // keep dependencies, may copied by custom scripts
    const dFiles = item.dependencies.files.map((p) => Util.relativePath(p));
    // console.log(dFiles);

    let currentFiles = [];
    [buildFiles, moduleFiles, dFiles].forEach((files) => {
        if (files) {
            currentFiles = currentFiles.concat(files);
        }
    });

    // console.log(currentFiles);

    const list = [];
    Util.forEachFile(item.buildPath, [], (filename, dir) => {

        // exclude .map already removed before build
        if (path.extname(filename) === '.map') {
            return;
        }

        const fileItem = Util.relativePath(path.resolve(dir, filename));
        // console.log(fileItem);

        if (currentFiles.includes(fileItem)) {
            return;
        }

        list.push(fileItem);
    });
    removeFiles(list);
};

const getStatsReportOptions = (item, filename) => {

    const reportFilename = path.basename(filename, '.js');
    const output = path.resolve(Util.getTempRoot(), 'build', `${reportFilename}.html`);

    let source = `**/${item.name}/src/**`;
    if (!Util.componentsRoot) {
        source = '**/src/**';
    }

    return {
        title: `Stats Report - ${item.fullName}`,
        output: output,
        outputStatsJson: true,
        gzipSize: true,
        moduleTypes: {
            source: {
                patterns: [source]
            }
        }
    };

};

const createWebpackConf = function(item, option) {

    const externals = Util.getWebpackExternals(item);

    const devtool = Util.hasOwn(item, 'devtool') ? item.devtool : 'source-map';

    option = Object.assign(option, {
        // init common option from item
        componentName: item.fullName,
        dependencies: item.dependencies.modules,
        externals: externals,
        alias: item.alias,
        esModule: item.esModule,

        root: Util.root,
        cliRoot: Util.nmRoot,
        nmRoot: Util.nmRoot,

        define: item.define,
        devtool: devtool
    });

    // create webpack conf
    const webpackConf = Util.createConf('webpack', option);
    Util.initWebpackConf(webpackConf, item, option);

    // common webpack conf handler
    webpackConf.entry = option.entry;
    webpackConf.output.path = path.normalize(option.buildPath);
    // for option
    webpackConf.output.filename = option.filename;

    return webpackConf;
};

const getWebpackAssets = (report) => {
    const outputPath = report.outputPath;
    // console.log('report.assets', report.assets);
    // no map in list
    const files = report.assets.map((item) => {
        return Util.relativePath(path.resolve(outputPath, item.name));
    });
    // css first
    files.sort();
    return files;
};

// ==========================================================================================================================

const checkVendorJob = (job) => {
    // check vendors
    const vendors = Util.getConfig('build.vendors');
    // console.log(vendors, job.name);

    let isVendor = false;
    if (Array.isArray(vendors)) {
        isVendor = vendors.find((it) => {
            if (job.name === it) {
                return true;
            }
            const re = new RegExp(it);
            if (re.test(job.name)) {
                return true;
            }
            return false;
        });
    }

    return isVendor;
};

const checkSafeModules = (job, bundledModules) => {

    const moduleReg = /.*\/?node_modules\/(@[^/]+\/[^/]+|[^/]+)\//;

    let nameList = bundledModules.map((item) => {
        const list = String(item.name).match(moduleReg);
        if (list) {
            return list[1];
        }
    }).filter((it) => it);

    nameList = Array.from(new Set(nameList));
    // console.log('nameList', nameList);

    const safeModules = Util.getConfig('build.safeModules');
    if (Array.isArray(safeModules)) {
        nameList = nameList.filter((moduleName) => {
            const safeModule = safeModules.find((safeName) => {
                if (moduleName === safeName) {
                    return true;
                }
                const re = new RegExp(safeName);
                if (re.test(moduleName)) {
                    return true;
                }
                return false;
            });
            if (safeModule) {
                return false;
            }
            return true;
        });

        if (!nameList.length) {
            return 0;
        }

    }

    const unsafeNames = nameList.map((it) => `'${it}'`).join(', ');

    Util.logRed(`"${job.name}" is NOT vendor component, module files are NOT allowed.`);
    Util.logYellow(`Try adding vendor to scripts/conf.cli.js: build.vendors: ['${job.name}']`);

    Util.logRed(`${unsafeNames} are NOT safe modules.`);
    Util.logYellow(`Try adding safe modules to scripts/conf.cli.js: build.safeModules: [${unsafeNames}]`);

    return 1;
};

const showIssueList = (job, issueList, statsData, filename) => {

    const map = statsData.map;
    const modules = statsData.modules;

    issueList.sort(function(a, b) {
        return b.size - a.size;
    });

    let msg = `${EC.yellow('possible issues')} for ${filename}`;
    msg += '\nAs a component, please make sure following module file(s) are required for bundling.';
    msg += "\nOr it should be added into 'dependencies' as an external module.";
    Util.logLine(msg);

    let reducedSize = 0;
    const arr = issueList.map(function(item, i) {
        reducedSize += item.size;
        const index = `[${i + 1}] `;
        const name = map[item.name];
        item.name = name;
        if (item.type === 'module') {
            return `${index + EC.red(name)} ${Util.BF(item.size)}`;
        }
        return `${index + EC.yellow(name)} ${Util.BF(item.size)}`;
    });
    arr.push('excluding those file(s), the bundling size would be reduced: ');
    console.log(arr.join('\n'));

    const totalSize = modules.size;
    Util.CG({
        columns: [{
            id: 'totalSize',
            name: 'Total Size'
        }, {
            id: 'reducedSize',
            name: 'Reduced Size'
        }, {
            id: 'reducedPercent',
            name: 'Reduced %'
        }],
        rows: [{
            totalSize: Util.BF(totalSize),
            reducedSize: Util.BF(reducedSize),
            reducedPercent: Util.PF(reducedSize, totalSize)
        }]
    });

    const bundledModules = issueList.filter((it) => it.type === 'module');
    if (!bundledModules.length) {
        return 0;
    }

    return checkSafeModules(job, bundledModules);
};

const checkStatsReport = (job, filename) => {

    if (checkVendorJob(job)) {
        return 0;
    }

    const issueTypes = ['ignored', 'nested', 'polyfill', 'module', 'other'];
    const issueTypeInfo = {};
    issueTypes.forEach((t) => {
        issueTypeInfo[t] = true;
    });

    const report = job.report;
    const statsData = report.statsData;
    const modules = statsData.modules;
    const issueList = modules.subs.filter(function(item) {
        return issueTypeInfo[item.type];
    });

    if (!issueList.length) {
        return 0;
    }

    return showIssueList(job, issueList, statsData, filename);

};

// ==========================================================================================================================

const updateBrowser = (item, conf, mainFiles) => {

    if (item.platform === 'node') {
        return;
    }

    if (mainFiles.length > 1) {
        Util.logCyan('add package browser for extracted files ...');
        const browser = {};
        mainFiles.forEach((f) => {
            let key = item.buildName;
            // css key
            if (path.extname(f) === '.css') {
                key += '-css';
            }
            browser[key] = f;
        });
        conf.browser = browser;
        return true;
    }

    if (conf.browser) {
        delete conf.browser;
        return true;
    }
};

const updatePackage = function(item) {

    const conf = Util.getComponentConf(item.name, true);

    let changed = false;

    // all output files relative path to component root package.json
    const mainFiles = item.buildFiles.map((f) => {
        return Util.relativePath(f, item.componentPath);
    });

    // ============================================================
    // main file
    const mainFile = mainFiles.find((it) => {
        return path.extname(it) === '.js';
    });
    if (mainFile !== conf.main) {
        conf.main = mainFile;
        changed = true;
    }

    // ============================================================
    // update browser
    if (updateBrowser(item, conf, mainFiles)) {
        changed = true;
    }

    // ===============================================================
    // module file
    if (item.moduleFiles) {
        const moduleFiles = item.moduleFiles.map((f) => {
            return Util.relativePath(f, item.componentPath);
        });
        const moduleFile = moduleFiles.find((it) => {
            return path.extname(it) === '.js';
        });
        if (moduleFile !== conf.module) {
            if (moduleFile) {
                conf.module = moduleFile;
            } else {
                delete conf.module;
            }
            changed = true;
        }
    }

    // ===============================================================

    if (changed) {
        Util.saveComponentConf(item.name, conf);
    }

};

// build additional esm file
const buildModuleFiles = async (item, entry) => {

    if (!item.esm) {
        return 0;
    }

    // already fully using es module, no need one more
    if (item.esModule) {
        return 0;
    }

    // switch to esModule
    item.esModule = true;

    // component module files
    const filenameModule = `${item.buildName}.esm.js`;

    const webpackConf = createWebpackConf(item, {
        filename: filenameModule,
        buildPath: item.buildPath,
        entry: entry,
        mode: item.production ? 'production' : 'development'
    });

    const statsReportOptions = getStatsReportOptions(item, filenameModule);
    const report = await buildWebpack(webpackConf, statsReportOptions);
    if (!report) {
        item.exitError = `ERROR: failed to build: ${filenameModule}`;
        return 1;
    }

    item.esmReport = report;

    item.moduleFiles = getWebpackAssets(report);

    Util.logEnd(`finish: ${item.moduleFiles.join(', ')}`);

    return 0;
};

// ==========================================================================================================================

const buildBrowserFiles = async (item, entry) => {
    // component main files
    const filenameMain = `${item.buildName}.js`;

    const webpackConf = createWebpackConf(item, {
        filename: filenameMain,
        buildPath: item.buildPath,
        entry: entry,
        mode: item.production ? 'production' : 'development'
    });

    const statsReportOptions = getStatsReportOptions(item, filenameMain);
    const report = await buildWebpack(webpackConf, statsReportOptions);
    if (!report) {
        item.exitError = `ERROR: failed to build: ${filenameMain}`;
        return 1;
    }

    item.report = report;

    const checkCode = checkStatsReport(item, filenameMain);
    if (checkCode) {
        return checkCode;
    }

    item.buildFiles = getWebpackAssets(report);

    Util.logEnd(`finish: ${item.buildFiles.join(', ')}`);

    return buildModuleFiles(item, entry);
};

const buildNodeFiles = async (item, entry) => {

    const start_time = Date.now();

    const metafile = await buildEsbuild(item, entry);
    if (!metafile) {
        return 1;
    }

    const duration = Date.now() - start_time;

    item.report = {
        duration,
        metafile
    };

    item.buildFiles = Object.keys(metafile.outputs).filter((it) => !it.endsWith('.map'));

    Util.logEnd(`finish: ${item.buildFiles.join(', ')}`);

    return 0;
};

// ==========================================================================================================================

const buildFilesHandler = async (item) => {

    // build entry src/index.js
    // item.entry maybe from build before hook
    const entry = item.entry || `${item.componentPath}/src/${item.entryFile}`;

    // check entry required
    if (!fs.existsSync(entry)) {
        Util.logRed(`ERROR: Not found component entry: ${entry}`);
        return 1;
    }

    // remove all map file before build
    cleanMapsBeforeBuild(item);

    const handler = item.platform === 'node' ? buildNodeFiles : buildBrowserFiles;
    const code = await handler(item, entry);
    if (code) {
        return code;
    }

    // clean useless files after both are built
    cleanFilesAfterBuild(item, item.buildFiles, item.moduleFiles);

    updatePackage(item);

    return code;
};


// ==========================================================================================================================

const buildHandler = (item) => {

    Util.jobId = item.jobId;
    Util.jobName = item.jobName;
    Util.componentName = item.name;
    Util.log();

    const tasks = [() => {
        return Util.runHook('build.before', item);
    }, () => {
        // console.log("build src files");
        return buildFilesHandler(item);
    }, () => {
        // console.log("inject above output files");
        return injectHandler(item);
    }, () => {
        return Util.runHook('build.after', item);
    }];

    return Util.tasksResolver(tasks);

};

module.exports = buildHandler;
