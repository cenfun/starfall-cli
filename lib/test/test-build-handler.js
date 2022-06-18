const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const WSR = require('webpack-stats-report');
const buildPack = require('../build/build-pack.js');

const Util = require('../core/util.js');

const getTestEntryContent = function(item) {
    // do NOT resolve path
    // configuration.output.path: The provided value is not an absolute path!
    const buildPath = item.buildPath;

    if (!fs.existsSync(buildPath)) {
        shelljs.mkdir('-p', buildPath);
    }
    // do NOT delete test files for realtime debug refresh

    const specsPath = item.specsPath;
    console.log(`test specs: ${Util.relativePath(specsPath)}`);

    // create test entry file, test src filename
    item.entry = `${buildPath}/${item.name}.js`;
    console.log(`test entry: ${Util.relativePath(item.entry)}`);

    const testUtilPath = `${Util.formatPath(Util.cliRoot)}/lib/test/test-util.js`;

    // -s --spec for single spec file
    const spec = item.spec || '';

    let entryTemplate = Util.getTemplate(path.resolve(__dirname, 'test-entry-template.js'));
    //remove eslint error comments
    entryTemplate = entryTemplate.replace('//', '');

    return Util.replace(entryTemplate, {
        'placeholder-test-util-path': testUtilPath,
        'placeholder-specs-path': specsPath,
        'placeholder-spec': spec
    });

};

// update babel plugins
const updateBabelPlugins = (ruleJS, item) => {
    let plugins = Util.getValue(ruleJS, 'use.options.plugins');
    if (!plugins) {
        plugins = [];
    }

    // istanbul handler
    plugins = plugins.filter((p) => {
        if (Array.isArray(p) && p[0].indexOf('babel-plugin-istanbul') !== -1) {
            return false;
        }
        if (typeof p === 'string' && p.indexOf('babel-plugin-istanbul') !== -1) {
            return false;
        }
        return true;
    });
    const istanbulPath = path.resolve(Util.nmRoot, 'node_modules/babel-plugin-istanbul');
    let include = ['src/**'];
    if (Util.componentsRoot) {
        include = [`*/${item.name}/src/**`];
    }
    const istanbulPlugin = [istanbulPath, {
        extension: ['.js', '.vue'],
        include: include
    }];
    plugins.push(istanbulPlugin);

    // update plugins
    if (ruleJS.use && ruleJS.use.options) {
        ruleJS.use.options.plugins = plugins;
    }

};

const updateBabelRule = (webpackConf, item) => {

    const rules = Util.getValue(webpackConf, 'module.rules');
    if (!rules) {
        return;
    }
    const ruleJS = rules.find((r) => {
        if (r.use && r.use.loader === 'babel-loader') {
            return true;
        }
    });
    if (!ruleJS) {
        return;
    }

    updateBabelPlugins(ruleJS, item);

};

const saveStatsReport = async (job, stats, filename) => {

    if (!stats) {
        Util.logRed(`Invalid webpack stats: ${filename}`);
        return;
    }

    const output = `${job.buildPath}/stats-report.html`;

    let source = `**/${job.name}/src/**`;
    if (!Util.componentsRoot) {
        source = '**/src/**';
    }

    const statsReport = await WSR.StatsReportGenerator({
        stats: stats,
        title: `Stats Report - ${filename}`,
        output: output,
        moduleTypes: {
            source: {
                patterns: [source]
            }
        }
    });
    if (!statsReport.statsData) {
        Util.logRed(`failed to save stats report: ${Util.relativePath(output)}`);
        return;
    }

    Util.logEnd(`generated stats report: ${Util.relativePath(output)}`);
};

const buildTest = async (item) => {

    // create test entry file
    const content = getTestEntryContent(item);
    fs.writeFileSync(item.entry, content);

    const externals = Util.getWebpackExternals(item.dependencies.modules, item.externals);

    const option = {
        componentName: item.fullName,
        dependencies: item.dependencies.modules,
        externals: externals,
        alias: item.alias,
        esModule: item.esModule,

        root: Util.root,
        cliRoot: Util.nmRoot,
        nmRoot: Util.nmRoot,

        mode: 'development'
    };

    const webpackConf = Util.createConf('webpack', option);
    Util.initWebpackConf(webpackConf, item, option);
    updateBabelRule(webpackConf, item);

    webpackConf.entry = item.entry;
    webpackConf.output.path = path.normalize(item.buildPath);
    webpackConf.output.filename = item.buildName;

    const exitCode = await buildPack(webpackConf);
    await saveStatsReport(item, webpackConf.report, item.buildName);

    if (exitCode) {
        item.exitError = `ERROR: failed to build test bundle: ${item.name}`;
        return exitCode;
    }

    // for test
    const file = path.resolve(webpackConf.output.path, webpackConf.output.filename);
    item.fileTest = Util.formatPath(file);

    Util.logEnd(`finish: ${Util.relativePath(file)}`);

    return 0;
};

const testBuildHandler = (item) => {

    Util.jobId = item.jobId;
    Util.jobName = item.jobName;
    Util.componentName = item.name;
    Util.log();

    return buildTest(item);

};

testBuildHandler.buildTest = buildTest;

module.exports = testBuildHandler;
