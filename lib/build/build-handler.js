const fs = require('fs');
const path = require('path');
const WSR = require('webpack-stats-report');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const buildPack = require('./build-pack.js');
const injectHandler = require('../inject/inject.js');
const Util = require('../core/util.js');
const EC = Util.EC;

const removeFileAndMap = (f) => {
    [f, `${f}.map`].forEach((item) => {
        if (fs.existsSync(item)) {
            console.log(`remove ${Util.relativePath(item)} ...`);
            Util.rmSync(item);
        }
    });
};


const jsToCss = (str) => {
    if (path.extname(str) === '.js') {
        str = `${str.substr(0, str.length - 3)}.css`;
    }
    // Util.logRed(str);
    return str;
};


// remove .js/.css and .map on demand
const cleanBuildFiles = (currentPath, filename, currentFiles) => {
    const jsFile = Util.relativePath(path.resolve(currentPath, filename));
    if (!currentFiles.includes(jsFile)) {
        removeFileAndMap(jsFile);
    }
    const cssFile = jsToCss(jsFile);
    if (!currentFiles.includes(cssFile)) {
        removeFileAndMap(cssFile);
    }
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
        Util.log(EC.green(`cssExtract: ${filename}`));
    }

};

const commonPluginsHandler = function(item, option, webpackConf) {
    if (!webpackConf.plugins) {
        webpackConf.plugins = [];
    }

    // DefinePlugin
    if (item.define) {
        const DefinePlugin = require('webpack').DefinePlugin;
        webpackConf.plugins.push(new DefinePlugin(item.define));
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

        define: item.define
    });

    // create webpack conf
    const webpackConf = Util.createConf('webpack', option);
    Util.initWebpackConf(webpackConf, item);

    // common webpack conf handler
    webpackConf.entry = option.entry;
    webpackConf.output.path = path.normalize(option.buildPath);
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

    const isVendor = vendors.find((it) => {
        if (job.name.startsWith(it) || job.name.endsWith(it)) {
            return true;
        }
        return false;
    });

    if (isVendor) {
        return 0;
    }

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
        if (item.type === 'module') {
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
    
    let msg = `${EC.yellow('possible issues')} for ${filename}`;
    msg += '\nAs a component, please make sure following module file(s) are required for bundling.';
    msg += "\nOr it should be added into 'dependencies' as an external module.";
    Util.logLine(msg);

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

const saveStatsReport = async (job, stats, filename) => {

    if (!stats) {
        Util.logRed(`Invalid webpack stats: ${filename}`);
        return 1;
    }

    const output = `${Util.getTempRoot()}/build/${filename}.html`;

    let source = `**/${job.name}/src/**`;
    if (!Util.componentsRoot) {
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
    
    const exitCode = showConsoleReport(job, statsReport, filename);

    //clean something, remove html in stats
    delete statsReport.html;

    job.report = statsReport;
    Util.logEnd(`generated stats report: ${Util.relativePath(output)}`);

    return exitCode;
};

// ==========================================================================================================================


const updatePackage = function(item) {

    const conf = Util.getComponentConf(item.name, true);

    let changed = false;

    // all output files relative path to component root package.json
    const outputFiles = item.buildFiles.map((f) => {
        return Util.relativePath(f, item.componentPath);
    });

    // ============================================================
    // main only js
    const main = outputFiles.find((it) => {
        return path.extname(it) === '.js';
    });
    if (main !== conf.main) {
        conf.main = main;
        changed = true;
    }

    // ============================================================
    // update browser
    if (outputFiles.length > 1) {
        Util.logCyan('add package browser for extracted files ...');
        const browser = {};
        outputFiles.forEach((f) => {
            let key = item.buildName;
            // css key
            if (path.extname(f) === '.css') {
                key += '-css';
            }
            browser[key] = f;
        });
        conf.browser = browser;
        changed = true;
    } else if (conf.browser) {
        delete conf.browser;
        changed = true;
    }
    
    if (changed) {
        Util.saveComponentConf(item.name, conf);
    }

};


const buildFilesHandler = async function(item) {

    //component main file
    const filename = `${item.buildName}.js`;

    // build entry src/index.js
    // item.entry maybe from build before hook
    const entry = item.entry || `${item.componentPath}/src/${item.entryFile}`;

    // check entry required
    if (!fs.existsSync(entry)) {
        Util.logRed(`ERROR: Not found component entry: ${entry}`);
        return 1;
    }

    const webpackConf = createWebpackConf(item, {
        filename: filename,
        buildPath: item.buildPath,
        entry: entry,
        mode: item.minify ? 'production' : 'development'
    });

    // console.log(webpackConf);

    if (!webpackConf) {
        return 1;
    }

    const buildCode = await buildPack(webpackConf);
    const reportCode = await saveStatsReport(item, webpackConf.report, filename);
    
    if (buildCode || reportCode) {
        item.exitError = `ERROR: failed to build: ${filename}`;
        return 1;
    }

    item.buildFiles = getWebpackAssets(webpackConf.report);
    Util.logEnd(`finish: ${item.buildFiles.join(', ')}`);

    cleanBuildFiles(item.buildPath, filename, item.buildFiles);

    updatePackage(item);

    return 0;
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

        //esm build?

    }, () => {
        // console.log("inject above output files");
        return injectHandler(item);
    }, () => {
        return Util.runHook('build.after', item);
    }];

    return Util.tasksResolver(tasks);

};

module.exports = buildHandler;
