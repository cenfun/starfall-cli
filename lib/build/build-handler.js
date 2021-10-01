const fs = require("fs");
const path = require("path");
const WSR = require("webpack-stats-report");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const buildPack = require("./build-pack.js");
const buildBundle = require("./build-bundle.js");
const injectFiles = require("../inject/inject.js");
//const helper = require("./build-helper.js");
const Util = require("../core/util.js");
const EC = Util.EC;

const getMode = (item) => {
    let mode = "development";
    if (item.minify) {
        mode = "production";
    }
    return mode;
};

const removeFileAndMap = (f) => {
    [f, `${f}.map`].forEach(item => {
        if (fs.existsSync(item)) {
            console.log(`remove ${item} ...`);
            Util.rmSync(item);
        }
    });
};

const cleanAssertFiles = (files) => {
    if (!files) {
        return;
    }
    files.forEach(f => {
        removeFileAndMap(f);
    });
};

const getCssFilename = (filename) => {
    return `${path.basename(filename, ".js")}.css`;
};

const cleanJsAndCssFiles = (item, filename) => {
    //remove js and css and all map
    removeFileAndMap(path.resolve(item.outputPath, filename));
    const cssFilename = getCssFilename(filename);
    removeFileAndMap(path.resolve(item.outputPath, cssFilename));
};

const cssExtractPluginHandler = function(item, option, webpackConf) {
    
    if (!item.css) {
        return;
    }

    const cssFilename = getCssFilename(option.filename);

    webpackConf.plugins.push(new MiniCssExtractPlugin({
        filename: cssFilename,
        ignoreOrder: true
    }));
    
    let replaced;
    //replace style-loader with MiniCssExtractPlugin
    webpackConf.module.rules.forEach((rule) => {
        if (!Array.isArray(rule.use)) {
            return;
        }
        const styleLoader = rule.use[0];
        if (!styleLoader || styleLoader.loader !== "style-loader") {
            return;
        }
        rule.use[0] = MiniCssExtractPlugin.loader;
        
        replaced = true;
        //enable sourceMap
        rule.use.forEach(item => {
            //only css-loader here
            if (item.loader === "css-loader") {
                item.options.sourceMap = true;
            }
        });
    });

    //enable minify default, css is biggest when load fonts
    webpackConf.optimization.minimize = true;
    
    if (replaced) {
        Util.logWorker(EC.green(`cssExtract: ${cssFilename}`));
    }

};

const commonPluginsHandler = function(item, option, webpackConf) {
    if (!webpackConf.plugins) {
        webpackConf.plugins = [];
    }

    //DefinePlugin
    if (item.buildTAG) {
        const DefinePlugin = require("webpack").DefinePlugin;
        webpackConf.plugins.push(new DefinePlugin(item.buildTAG));
    }

    //MiniCssExtractPlugin
    cssExtractPluginHandler(item, option, webpackConf);

};

const createWebpackConf = function(item, option) {

    const externals = Util.getWebpackExternals(item.dependencies.modules);

    option = Object.assign(option, {
        //init common option from item
        componentName: item.fullName,
        dependencies: item.dependencies.modules,
        externals: externals,
        alias: Util.getSetting("moduleAlias"),

        root: Util.root,
        cliRoot: Util.nmRoot,
        nmRoot: Util.nmRoot,

        buildTAG: item.buildTAG
    });

    //create webpack conf
    const webpackConf = Util.createConf("webpack", option);
    Util.initWebpackConf(webpackConf, item);

    //common webpack conf handler
    webpackConf.entry = item.entry;
    webpackConf.output.path = path.normalize(item.outputPath);
    //for option
    webpackConf.output.filename = option.filename;

    //common webpack plugins handler
    commonPluginsHandler(item, option, webpackConf);

    return webpackConf;
};

const getWebpackAssets = (conf) => {
    const files = conf.assets.map(item => {
        return Util.relativePath(path.resolve(conf.outputPath, item.name));
    });
    //css first
    files.sort();
    return files;
};

//==========================================================================================================================

const showConsoleReport = (statsReport, filename) => {
    const statsData = statsReport.statsData;
    const issueTypes = ["ignored", "nested", "polyfill", "module", "other"];
    const issueTypeInfo = {};
    issueTypes.forEach(t => {
        issueTypeInfo[t] = true;
    });

    const map = statsData.map;
    const modules = statsData.modules;
    const list = modules.subs.filter(function(item) {
        return issueTypeInfo[item.type];
    });

    if (!list.length) {
        return;
    }
    list.sort(function(a, b) {
        return b.size - a.size;
    });
    
    Util.logLine();
    let msg = `${EC.yellow("possible issues")} for ${filename}`;
    msg += "\nAs a component, please make sure following module file(s) are required for bundling.";
    msg += "\nOr it should be added into 'dependencies' as an external module.";
    Util.logMsg("build", msg);
    let reducedSize = 0;
    const arr = list.map(function(item, i) {
        reducedSize += item.size;
        const index = `[${i + 1}] `;
        const name = map[item.name];
        if (item.type === "module") {
            return `${index + EC.red(name)} ${Util.BF(item.size)}`;
        }
        return `${index + EC.yellow(name)} ${Util.BF(item.size)}`;
    });
    arr.push("excluding those file(s), the bundling size would be reduced: ");
    console.log(arr.join("\n"));

    const totalSize = modules.size;
    Util.consoleGrid.render({
        option: {
            hideHeaders: false
        },
        columns: [{
            id: "totalSize",
            name: "Total Size"
        }, {
            id: "reducedSize",
            name: "Reduced Size"
        }, {
            id: "reducedPercent",
            name: "Reduced %"
        }],
        rows: [{
            totalSize: Util.BF(totalSize),
            reducedSize: Util.BF(reducedSize),
            reducedPercent: Util.PF(reducedSize, totalSize)
        }]
    });
};

const saveStatsReport = async (job, stats, filename, reportKey, isPreview) => {

    if (!stats) {
        Util.logRed(`Invalid webpack stats: ${filename}`);
        return;
    }

    const output = `${Util.getTempRoot()}/build/${filename}.html`;

    let source = `**/${job.name}/src/**`;
    if (!Util.componentsRoot || isPreview) {
        source = "**/src/**";
    }

    const statsReport = await WSR.StatsReportGenerator({
        stats: stats,
        title: `Stats Report - ${filename}`,
        output: output,
        outputStatsJson: true,
        generateMinifiedAndGzipSize: true,
        moduleTypes: {
            source: {
                patterns: source
            }
        }
    });
    if (!statsReport.statsData) {
        Util.logRed(`failed to save stats report: ${Util.relativePath(output)}`);
        return;
    }
    
    if (!isPreview) {
        showConsoleReport(statsReport, filename);
    }

    job[reportKey] = statsReport;
    Util.logCyan(`generated stats report: ${Util.relativePath(output)}`);
};

//==========================================================================================================================

const buildFilesHandler = async function(item) {

    const filename = `${item.outputName}.js`;

    const webpackConf = createWebpackConf(item, {
        filename: filename,
        mode: getMode(item)
    });

    //console.log(webpackConf);

    if (!webpackConf) {
        return 1;
    }

    cleanJsAndCssFiles(item, filename);

    const exitCode = await buildPack(webpackConf);
    await saveStatsReport(item, webpackConf.report, filename, "report");
    
    if (exitCode !== 0) {
        item.exitError = `ERROR: failed to build: ${filename}`;
        return exitCode;
    }

    item.buildFiles = getWebpackAssets(webpackConf.report);
    Util.logWorker(`finish: ${item.buildFiles.join(", ")}`);

    return 0;
};

//==========================================================================================================================

const buildPreviewFilesHandler = async (item) => {

    const filename = `${item.outputName}.preview.js`;

    //check if has preview entry src/index.js
    const srcEntry = Util.getSetting("srcEntry");
    const entry = `${item.previewPath}src/${srcEntry}`;
    //Not found preview entry and ignore
    if (!fs.existsSync(entry)) {
        //remove previous preview file
        cleanJsAndCssFiles(item, filename);
        return 0;
    }

    //console.log(entry);

    const webpackConf = createWebpackConf(item, {
        filename: filename,
        mode: getMode(item)
    });

    if (!webpackConf) {
        return 1;
    }

    //preview entry
    webpackConf.entry = entry;

    //preview externals
    webpackConf.externals.push(item.fullName);

    cleanJsAndCssFiles(item, filename);

    const exitCode = await buildPack(webpackConf);
    await saveStatsReport(item, webpackConf.report, filename, "reportPreview", true);

    if (exitCode !== 0) {
        item.exitError = `ERROR: failed to build: ${filename}`;
        return exitCode;
    }

    item.previewFiles = getWebpackAssets(webpackConf.report);

    Util.logWorker(`finish: ${item.previewFiles.join(", ")}`);

    return 0;
};

//==========================================================================================================================

const buildBundleFilesHandler = async (item) => {

    //no extname
    const bundleName = `${item.outputName}.bundle`;
    
    if (!item.bundle) {
        cleanJsAndCssFiles(item, `${bundleName}.js`);
        return 0;
    }

    item.bundleName = bundleName;

    //bundle from files
    let bundleList = [].concat(item.dependencies.files);
    bundleList = bundleList.concat(item.buildFiles);
    if (item.previewFiles) {
        bundleList = bundleList.concat(item.previewFiles);
    }

    cleanJsAndCssFiles(item, `${bundleName}.js`);
    //return a list may includes 2 files for js and css
    const bundleFiles = await buildBundle(item, bundleList);
    if (!bundleFiles) {
        return 1;
    }

    //remove build files if has bundleFiles
    cleanAssertFiles(item.buildFiles);
    cleanAssertFiles(item.previewFiles);

    item.bundleFiles = bundleFiles;
    Util.logWorker(`finish: ${bundleFiles.join(", ")}`);
    
    return 0;
};

//==========================================================================================================================

const buildHandler = (item) => {

    Util.jobId = item.jobId;
    Util.jobName = item.jobName;
    Util.componentName = item.name;

    //dependencies checking
    const d = Util.getComponentDependencies(item.name);
    if (!d) {
        return 1;
    }
    item.dependencies = d;

    const tasks = [(item) => {
        return Util.runHook("beforeBuild", item.name, item);
    }, () => {
        //check entry after hook
        if (!fs.existsSync(item.entry)) {
            Util.logRed(`ERROR: Not found component entry: ${item.entry}`);
            return 1;
        }
        return 0;
    }, () => {
        //console.log("build src files");
        return buildFilesHandler(item);
    }, () => {
        //console.log("build preview files");
        return buildPreviewFilesHandler(item);
    }, () => {
        //console.log("build bundle files");
        return buildBundleFilesHandler(item);
    }, () => {
        //console.log("inject above output files");
        return injectFiles(item);
    }, (item) => {
        return Util.runHook("afterBuild", item.name, item);
    }];

    return Util.tasksResolver(tasks, item);

};

module.exports = buildHandler;
