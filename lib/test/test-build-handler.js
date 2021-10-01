const fs = require("fs");
const path = require("path");
const shelljs = require("shelljs");
const WSR = require("webpack-stats-report");
const buildPack = require("../build/build-pack.js");

const Util = require("../core/util.js");

const getTestEntryContent = function(item) {
    //do NOT resolve path
    //configuration.output.path: The provided value is not an absolute path!
    const outputPath = item.outputPath;

    if (!fs.existsSync(outputPath)) {
        shelljs.mkdir("-p", outputPath);
    }
    //do NOT delete test files for realtime debug refresh

    const EOL = Util.getEOL();

    const specsPath = item.specsPath;
    console.log(`test specs: ${Util.relativePath(specsPath)}`);

    //create test entry file
    item.entry = `${outputPath + item.name}.js`;
    console.log(`test entry: ${Util.relativePath(item.entry)}`);

    //add test util
    const testUtil = `require("${Util.formatPath(Util.cliRoot)}/lib/test/test-util.js");${EOL}`;

    const libs = testUtil;

    //all specs
    let content = `${libs}const testsContext = require.context("${specsPath}", true, /\\.js$/);${EOL}`;
    content += "testsContext.keys().forEach(testsContext);";

    //-s --spec for single spec file
    const spec = item.spec;
    if (spec) {
        Util.logCyan(`test spec file: ${spec}`);
        content = `${libs}require("${specsPath}/${spec}");`;
    }

    return content;
};

//update babel preset-env
const updateBabelPresets = (ruleJS, item) => {
    let presets = Util.getValue(ruleJS, "use.options.presets");
    if (!presets) {
        presets = [];
    }

    presets = presets.filter((p) => {
        if (Array.isArray(p) && p[0].indexOf("preset-env") !== -1) {
            return false;
        }
        if (typeof(p) === "string" && p.indexOf("preset-env") !== -1) {
            return false;
        }
        return true;
    });
    const envPath = path.resolve(Util.nmRoot, "node_modules/@babel/preset-env");
    const envPreset = [envPath, {
        targets: {}
    }];
    presets.push(envPreset);

    if (ruleJS.use && ruleJS.use.options) {
        ruleJS.use.options.presets = presets;
    }

};

//update babel plugins
const updateBabelPlugins = (ruleJS, item) => {
    let plugins = Util.getValue(ruleJS, "use.options.plugins");
    if (!plugins) {
        plugins = [];
    }

    //istanbul handler
    plugins = plugins.filter((p) => {
        if (Array.isArray(p) && p[0].indexOf("babel-plugin-istanbul") !== -1) {
            return false;
        }
        if (typeof(p) === "string" && p.indexOf("babel-plugin-istanbul") !== -1) {
            return false;
        }
        return true;
    });
    const istanbulPath = path.resolve(Util.nmRoot, "node_modules/babel-plugin-istanbul");
    let include = ["src/**"];
    if (Util.componentsRoot) {
        include = [`*/${item.name}/src/**`];
    }
    const istanbulPlugin = [istanbulPath, {
        extension: [".js", ".vue"],
        include: include
    }];
    plugins.push(istanbulPlugin);

    //update plugins
    if (ruleJS.use && ruleJS.use.options) {
        ruleJS.use.options.plugins = plugins;
    }

};

const updateBabelRule = (webpackConf, item) => {

    const rules = Util.getValue(webpackConf, "module.rules");
    if (!rules) {
        return;
    }
    const ruleJS = rules.find((item) => {
        if (item.use && item.use.loader === "babel-loader") {
            return true;
        }
    });
    if (!ruleJS) {
        return;
    }

    updateBabelPresets(ruleJS, item);
    updateBabelPlugins(ruleJS, item);

};

const saveStatsReport = async (job, stats, filename) => {

    if (!stats) {
        Util.logRed(`Invalid webpack stats: ${filename}`);
        return;
    }

    const output = `${job.outputPath}/stats-report.html`;

    let source = `**/${job.name}/src/**`;
    if (!Util.componentsRoot) {
        source = "**/src/**";
    }

    const statsReport = await WSR.StatsReportGenerator({
        stats: stats,
        title: `Stats Report - ${filename}`,
        output: output,
        outputStatsJson: false,
        generateMinifiedAndGzipSize: false,
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

    Util.logCyan(`generated stats report: ${Util.relativePath(output)}`);
};

const buildTest = async (item) => {

    //create test entry file
    const content = getTestEntryContent(item);
    fs.writeFileSync(item.entry, content);

    const option = {
        componentName: item.fullName,
        dependencies: item.dependencies.modules,
        externals: Util.getWebpackExternals(item.dependencies.modules),
        alias: Util.getSetting("moduleAlias"),

        root: Util.root,
        cliRoot: Util.nmRoot,
        nmRoot: Util.nmRoot,

        type: "test"
    };

    const webpackConf = Util.createConf("webpack", option);
    Util.initWebpackConf(webpackConf, item);
    updateBabelRule(webpackConf, item);

    webpackConf.entry = item.entry;
    webpackConf.output.path = path.normalize(item.outputPath);
    webpackConf.output.filename = item.outputName;

    const exitCode = await buildPack(webpackConf);
    await saveStatsReport(item, webpackConf.report, item.outputName);

    if (exitCode) {
        item.exitError = `ERROR: failed to build test bundle: ${item.name}`;
        return exitCode;
    }

    //for test
    const file = path.resolve(webpackConf.output.path, webpackConf.output.filename);
    item.fileTest = Util.formatPath(file);

    Util.logWorker(`finish: ${Util.relativePath(file)}`);

    return 0;
};

const testBuildHandler = async (item) => {

    Util.jobId = item.jobId;
    Util.jobName = item.jobName;
    Util.componentName = item.name;
    Util.logWorker();

    const exitCode = await buildTest(item);
    return exitCode;

};

testBuildHandler.buildTest = buildTest;

module.exports = testBuildHandler;
