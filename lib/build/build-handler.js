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

const removeFile = (f) => {
    [f, `${f}.map`].forEach(item => {
        if (fs.existsSync(item)) {
            console.log(`remove ${item} ...`);
            Util.rmSync(item);
        }
    });
};

const cleanFile = (item, name) => {
    const f = item[name];
    if (!f) {
        return;
    }
    delete item[name];
    removeFile(f);
};

const cssExtractPluginHandler = function(item, option, webpackConf) {
    const filename = `${path.basename(option.filename, ".js")}.css`;
    //generated css file
    const cssFile = path.resolve(webpackConf.output.path, filename);
    item.buildCssFile = Util.relativePath(cssFile);

    //remove css file always, because we don't know when generated css, sometimes no css
    removeFile(item.buildCssFile);

    //do not create extract for min.js
    if (item.extra) {
        return;
    }

    if (!item.css) {
        return;
    }

    webpackConf.plugins.push(new MiniCssExtractPlugin({
        filename: filename,
        ignoreOrder: true
    }));
    
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

const buildFileHandler = async function(item) {

    const filename = `${item.outputName}.js`;

    let type = "dev";
    if (item.minify) {
        type = "prod";
    }

    const webpackConf = createWebpackConf(item, {
        filename: filename,
        type: type
    });

    if (!webpackConf) {
        return 1;
    }

    const exitCode = await buildPack(webpackConf);
    await saveStatsReport(item, webpackConf.report, filename, "report");
    
    if (exitCode !== 0) {
        item.exitError = `ERROR: failed to build: ${filename}`;
        return exitCode;
    }

    let file = path.resolve(webpackConf.output.path, webpackConf.output.filename);
    file = Util.relativePath(file);

    item.buildFile = file;

    //check if generated css file
    if (item.buildCssFile) {
        //maybe no css file generated even has buildCssFile
        if (fs.existsSync(item.buildCssFile)) {
            file += `, ${item.buildCssFile}`;
        } else {
            delete item.buildCssFile;
        }
    }

    Util.logWorker(`finish: ${file}`);

    return 0;
};

//TODO retired feature
const buildExtraFileHandler = async function(item) {

    //clone item, do not change any property for normal build
    item = Object.assign({}, item);

    const minFilename = `${item.outputName}.min.js`;
    item.buildMinFile = path.resolve(item.outputPath, minFilename);

    if (!item.extra) {
        cleanFile(item, "buildMinFile");
        return 0;
    }

    const webpackConf = createWebpackConf(item, {
        filename: minFilename,
        type: "prod"
    });

    if (!webpackConf) {
        return 1;
    }

    const exitCode = await buildPack(webpackConf);

    if (exitCode !== 0) {
        item.exitError = `ERROR: failed to build: ${minFilename}`;
        return exitCode;
    }

    const file = path.resolve(webpackConf.output.path, webpackConf.output.filename);
    Util.logWorker(`finish: ${Util.relativePath(file)}`);

    return 0;
};

//==========================================================================================================================

const buildPreviewFileHandler = async (item) => {

    const previewFilename = `${item.outputName}.preview.js`;

    //check if has preview entry src/index.js
    const srcEntry = Util.getSetting("srcEntry");
    const entry = `${item.previewPath}src/${srcEntry}`;
    //Not found preview entry and ignore
    if (!fs.existsSync(entry)) {

        //remove previous preview file
        const f = path.resolve(item.outputPath, previewFilename);
        if (fs.existsSync(f)) {
            await Util.rm(f);
            await Util.rm(`${f}.map`);
        }

        return 0;
    }

    //console.log(entry);

    let type = "dev";
    if (item.minify) {
        type = "prod";
    }

    const webpackConf = createWebpackConf(item, {
        filename: previewFilename,
        type: type
    });

    if (!webpackConf) {
        return 1;
    }

    //preview entry
    webpackConf.entry = entry;

    //preview externals
    webpackConf.externals.push(item.fullName);

    const exitCode = await buildPack(webpackConf);
    await saveStatsReport(item, webpackConf.report, previewFilename, "reportPreview", true);

    if (exitCode !== 0) {
        item.exitError = `ERROR: failed to build: ${previewFilename}`;
        return exitCode;
    }

    let file = path.resolve(webpackConf.output.path, webpackConf.output.filename);
    file = Util.relativePath(file);

    item.previewFile = file;

    Util.logWorker(`finish: ${file}`);

    return 0;
};

//==========================================================================================================================

const getBundleType = (item) => {
    if (item.bundle) {
        if (item.all) {
            return "bundle";
        }
        //default bundle vendor (3rd party libs)
        return "vendor";
    }
};

//remove previous bundle
const cleanBundleFiles = async (item, bundleType) => {
    const bundleName = `${item.outputName}.${bundleType}`;
    const f = path.resolve(item.outputPath, bundleName);
    if (fs.existsSync(`${f}.js`)) {
        await Util.rm(`${f}.js`);
    }
    if (fs.existsSync(`${f}.css`)) {
        await Util.rm(`${f}.css`);
    }
};

const getNoNeedDependenciesFiles = function(item) {
    //no need for all
    if (item.all) {
        return true;
    }
    //no need for bundle with hash
    if (item.bundle && item.hash) {
        return true;
    }
};

const getBundleList = function(item, bundleType) {
    const bundleList = [].concat(item.dependencies.files);
    if (bundleType === "bundle") {
        if (item.buildCssFile) {
            bundleList.push(item.buildCssFile);
        }
        bundleList.push(item.buildFile);
        if (item.previewFile) {
            bundleList.push(item.previewFile);
        }
    }
    return bundleList;
};

const buildBundleFilesHandler = async (item) => {

    const bundleType = getBundleType(item);
    if (!bundleType) {
        await cleanBundleFiles(item, "bundle");
        await cleanBundleFiles(item, "vendor");
        return 0;
    }

    if (bundleType === "vendor") {
        await cleanBundleFiles(item, "bundle");
    } else if (bundleType === "bundle") {
        await cleanBundleFiles(item, "vendor");
    }

    item.bundleName = `${item.outputName}.${bundleType}`;

    //bundle from files
    const bundleList = getBundleList(item, bundleType);

    //return a list may includes 2 files for js and css
    const bundleFiles = await buildBundle(item, bundleList);
    if (!bundleFiles) {
        return 1;
    }
    
    //no need copy dependencies if has bundle files
    item.noNeedDependenciesFiles = getNoNeedDependenciesFiles(item);

    //remove if bundle all done has bundleFiles
    if (item.all) {
        cleanFile(item, "buildCssFile");
        cleanFile(item, "buildFile");
        cleanFile(item, "previewFile");
    }

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
        //console.log("build src file");
        return buildFileHandler(item);
    }, () => {
        //console.log("build extra min file");
        return buildExtraFileHandler(item);
    }, () => {
        //console.log("build preview file");
        return buildPreviewFileHandler(item);
    }, () => {
        //console.log("build bundle for vendor or all");
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
