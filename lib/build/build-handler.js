const fs = require('fs');
const path = require('path');
const WSR = require('webpack-stats-report');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const buildPack = require('./build-pack.js');
const buildBundle = require('./build-bundle.js');
const injectFiles = require('../inject/inject.js');
// const helper = require("./build-helper.js");
const Util = require('../core/util.js');
const EC = Util.EC;

const getMode = (item) => {
    let mode = 'development';
    if (item.minify) {
        mode = 'production';
    }
    return mode;
};

const removeFileAndMap = (f) => {
    [f, `${f}.map`].forEach((item) => {
        if (fs.existsSync(item)) {
            console.log(`remove ${Util.relativePath(item)} ...`);
            Util.rmSync(item);
        }
    });
};

const cleanAssertFiles = (files) => {
    if (!files) {
        return;
    }
    files.forEach((f) => {
        removeFileAndMap(f);
    });
};

const jsToCss = (str) => {
    if (path.extname(str) === '.js') {
        str = `${str.substr(0, str.length - 3)}.css`;
    }
    // Util.logRed(str);
    return str;
};

const cleanJsAndCssFiles = (jsPath) => {
    // remove .js and .css and all .map
    removeFileAndMap(jsPath);
    // js path to css path
    const cssPath = jsToCss(jsPath);
    removeFileAndMap(cssPath);
};

const cssExtractHandler = function(item, option, webpackConf) {
    
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
    const filename = jsToCss(option.filename);

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
        rule.use[0] = MiniCssExtractPlugin.loader;
        
        replaced = true;
        // enable sourceMap
        rule.use.forEach((it) => {
            // only css-loader here
            if (it.loader === 'css-loader') {
                it.options.sourceMap = true;
            }
        });
    });

    // enable minify default, css is biggest when load fonts
    if (item.minify) {
        webpackConf.optimization.minimize = true;
    }
    
    if (replaced) {
        Util.logWorker(EC.green(`cssExtract: ${filename}`));
    }

};

const commonPluginsHandler = function(item, option, webpackConf) {
    if (!webpackConf.plugins) {
        webpackConf.plugins = [];
    }

    // DefinePlugin
    if (item.buildTAG) {
        const DefinePlugin = require('webpack').DefinePlugin;
        webpackConf.plugins.push(new DefinePlugin(item.buildTAG));
    }

    cssExtractHandler(item, option, webpackConf);

};

const createWebpackConf = function(item, option) {

    const externals = Util.getWebpackExternals(item.dependencies.modules, item.externals);

    option = Object.assign(option, {
        // init common option from item
        componentName: item.fullName,
        dependencies: item.dependencies.modules,
        externals: externals,
        alias: Util.getConfig('build.alias'),
        esModule: Util.getConfig('build.esModule'),

        root: Util.root,
        cliRoot: Util.nmRoot,
        nmRoot: Util.nmRoot,

        buildTAG: item.buildTAG
    });

    // create webpack conf
    const webpackConf = Util.createConf('webpack', option);
    Util.initWebpackConf(webpackConf, item);

    // common webpack conf handler
    webpackConf.entry = item.entry;
    webpackConf.output.path = path.normalize(option.outputPath);
    // for option
    webpackConf.output.filename = option.filename;

    // common webpack plugins handler
    commonPluginsHandler(item, option, webpackConf);

    return webpackConf;
};

const getWebpackAssets = (conf) => {
    const files = conf.assets.map((item) => {
        return Util.relativePath(path.resolve(conf.outputPath, item.name));
    });
    // css first
    files.sort();
    return files;
};

// ==========================================================================================================================

const showConsoleReport = (job, statsReport, filename) => {

    // check vendors
    const vendors = Util.getConfig('build.vendors');
    // console.log(vendors, job.name);

    const isVendor = vendors.includes(job.name);

    const statsData = statsReport.statsData;
    const issueTypes = ['ignored', 'nested', 'polyfill', 'module', 'other'];
    const issueTypeInfo = {};
    issueTypes.forEach((t) => {
        issueTypeInfo[t] = true;
    });

    let hasModuleIssue = false;
    const map = statsData.map;
    const modules = statsData.modules;
    const list = modules.subs.filter(function(item) {
        if (!isVendor && item.type === 'module') {
            hasModuleIssue = true;
        }
        return issueTypeInfo[item.type];
    });

    if (!list.length) {
        return 0;
    }

    list.sort(function(a, b) {
        return b.size - a.size;
    });
    
    Util.logLine();
    let msg = `${EC.yellow('possible issues')} for ${filename}`;
    msg += '\nAs a component, please make sure following module file(s) are required for bundling.';
    msg += "\nOr it should be added into 'dependencies' as an external module.";
    Util.logMsg('build', msg);
    let reducedSize = 0;
    const arr = list.map(function(item, i) {
        reducedSize += item.size;
        const index = `[${i + 1}] `;
        const name = map[item.name];
        if (item.type === 'module') {
            return `${index + EC.red(name)} ${Util.BF(item.size)}`;
        }
        return `${index + EC.yellow(name)} ${Util.BF(item.size)}`;
    });
    arr.push('excluding those file(s), the bundling size would be reduced: ');
    console.log(arr.join('\n'));

    const totalSize = modules.size;
    Util.consoleGrid.render({
        option: {
            hideHeaders: false
        },
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

    if (hasModuleIssue) {
        Util.logRed(`"${job.name}" is NOT vendor component, module files are NOT allowed.`);
        return 1;
    }

    return 0;
};

const saveStatsReport = async (job, stats, filename, reportKey, isDev) => {

    if (!stats) {
        Util.logRed(`Invalid webpack stats: ${filename}`);
        return 1;
    }

    const output = `${Util.getTempRoot()}/build/${filename}.html`;

    let source = `**/${job.name}/src/**`;
    if (!Util.componentsRoot || isDev) {
        source = '**/src/**';
    }

    const statsReport = await WSR.StatsReportGenerator({
        stats: stats,
        title: `Stats Report - ${filename}`,
        output: output,
        outputStatsJson: true,
        generateMinifiedAndGzipSize: true,
        moduleTypes: {
            source: {
                patterns: [source, ' sync ']
            }
        }
    });

    if (!statsReport.statsData) {
        Util.logRed(`failed to save stats report: ${Util.relativePath(output)}`);
        return 1;
    }
    
    let exitCode = 0;
    if (!isDev) {
        exitCode = showConsoleReport(job, statsReport, filename);
    }

    job[reportKey] = statsReport;
    Util.logCyan(`generated stats report: ${Util.relativePath(output)}`);

    return exitCode;
};

// ==========================================================================================================================

const buildFilesHandler = async function(item) {

    const filename = `${item.outputName}.js`;
    cleanJsAndCssFiles(path.resolve(item.outputPath, filename));

    const webpackConf = createWebpackConf(item, {
        filename: filename,
        outputPath: item.outputPath,
        mode: getMode(item)
    });

    // console.log(webpackConf);

    if (!webpackConf) {
        return 1;
    }

    const buildCode = await buildPack(webpackConf);
    const reportCode = await saveStatsReport(item, webpackConf.report, filename, 'report');
    
    if (buildCode || reportCode) {
        item.exitError = `ERROR: failed to build: ${filename}`;
        return 1;
    }

    item.buildFiles = getWebpackAssets(webpackConf.report);
    Util.logWorker(`finish: ${item.buildFiles.join(', ')}`);

    return 0;
};

// ==========================================================================================================================

const buildDevFilesHandler = async (item) => {

    const filename = `${item.outputName}.dev.js`;
    cleanJsAndCssFiles(path.resolve(item.devOutputPath, filename));

    // check if has dev entry src/index.js
    const entryFile = Util.getConfig('build.entryFile');
    const entry = `${item.devPath}src/${entryFile}`;
    // Not found dev entry and ignore
    if (!fs.existsSync(entry)) {
        return 0;
    }

    // console.log(entry);

    const webpackConf = createWebpackConf(item, {
        filename: filename,
        outputPath: item.devOutputPath,
        mode: getMode(item)
    });

    if (!webpackConf) {
        return 1;
    }

    // dev entry
    webpackConf.entry = entry;

    // dev externals
    webpackConf.externals.push(item.fullName);

    const exitCode = await buildPack(webpackConf);
    const reportCode = await saveStatsReport(item, webpackConf.report, filename, 'reportDev', true);

    if (exitCode || reportCode) {
        item.exitError = `ERROR: failed to build: ${filename}`;
        return 1;
    }

    item.devFiles = getWebpackAssets(webpackConf.report);

    Util.logWorker(`finish: ${item.devFiles.join(', ')}`);

    return 0;
};

// ==========================================================================================================================

const buildBundleFilesHandler = async (item) => {

    // no extname
    const bundleName = `${item.outputName}.bundle`;

    const filename = `${bundleName}.js`;
    cleanJsAndCssFiles(path.resolve(item.outputPath, filename));
    
    if (!item.bundle) {
        return 0;
    }

    item.bundleName = bundleName;

    // bundle from files
    let bundleList = [].concat(item.dependencies.files);
    bundleList = bundleList.concat(item.buildFiles);
    if (item.devFiles) {
        bundleList = bundleList.concat(item.devFiles);
    }

    // return a list may includes 2 files for js and css
    const bundleFiles = await buildBundle(item, bundleList);
    if (!bundleFiles) {
        return 1;
    }

    // remove build files if has bundleFiles
    cleanAssertFiles(item.buildFiles);
    cleanAssertFiles(item.devFiles);

    item.bundleFiles = bundleFiles;
    Util.logWorker(`finish: ${bundleFiles.join(', ')}`);
    
    return 0;
};

// ==========================================================================================================================

const buildHandler = (item) => {

    Util.jobId = item.jobId;
    Util.jobName = item.jobName;
    Util.componentName = item.name;

    const tasks = [(it) => {
        return Util.runHook('build.before', it);
    }, (it) => {
        // check entry after hook
        if (!fs.existsSync(it.entry)) {
            Util.logRed(`ERROR: Not found component entry: ${it.entry}`);
            return 1;
        }
        return 0;
    }, (it) => {
        // console.log("build src files");
        return buildFilesHandler(it);
    }, (it) => {
        // console.log("build dev files");
        return buildDevFilesHandler(it);
    }, (it) => {
        // console.log("build bundle files");
        return buildBundleFilesHandler(it);
    }, (it) => {
        // console.log("inject above output files");
        return injectFiles(it);
    }, (it) => {
        return Util.runHook('build.after', it);
    }];

    return Util.tasksResolver(tasks, item);

};

module.exports = buildHandler;
