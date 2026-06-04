const os = require('os');
const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const buildWebpack = require('../build/build-webpack.js');

const Util = require('../core/util.js');

const getTestEntryContent = function(item) {
    // do NOT resolve path
    // configuration.output.path: The provided value is not an absolute path!
    const buildPath = item.buildPath;

    if (!fs.existsSync(buildPath)) {
        shelljs.mkdir('-p', buildPath);
    }
    // do NOT delete test files for realtime debug refresh

    // create test entry file, test src filename
    item.entry = `${buildPath}/${item.name}.js`;
    console.log(`test entry: ${Util.relativePath(item.entry)}`);

    const utilPath = path.resolve(Util.cliRoot, 'lib/test/test-util.js');
    // relative to test build path
    const testUtilPath = Util.formatPath(path.relative(buildPath, utilPath));

    const list = [
        `require('${testUtilPath}');`
    ];

    console.log(`test specs: ${Util.relativePath(item.specsPath)}`);
    // relative to test build path
    const specsPath = Util.formatPath(path.relative(buildPath, item.specsPath));

    // -s --spec for single spec file
    const spec = item.spec || '';

    const entryTemplate = Util.getTemplate(path.resolve(__dirname, 'test-entry-template.js'));

    const entry = Util.replace(entryTemplate, {
        'placeholder-test-util-path': testUtilPath,
        'placeholder-specs-path': specsPath,
        'placeholder-spec': spec
    });

    list.push(entry);

    return list.join(os.EOL);

};

const getStatsReportOptions = (item) => {

    const output = path.resolve(item.buildPath, 'stats-report.html');

    let source = `**/${item.name}/src/**`;
    if (!Util.componentsRoot) {
        source = '**/src/**';
    }

    return {
        title: `Stats Report - ${item.fullName} test build`,
        output: output,
        moduleTypes: {
            source: {
                patterns: [source]
            }
        }
    };

};

const buildTest = async (item) => {

    // create test entry file
    const content = getTestEntryContent(item);
    fs.writeFileSync(item.entry, content);

    const externals = Util.getWebpackExternals(item);

    const option = {
        componentName: item.fullName,
        dependencies: item.dependencies.modules,
        externals: externals,
        alias: item.alias,
        esModule: item.esModule,

        root: Util.root,
        cliRoot: Util.nmRoot,
        nmRoot: Util.nmRoot,

        mode: 'development',
        devtool: 'source-map'
    };

    const webpackConf = Util.createConf('webpack', option);
    Util.initWebpackConf(webpackConf, item, option);

    webpackConf.entry = item.entry;
    webpackConf.output.path = path.normalize(item.buildPath);

    // already has extname .js
    webpackConf.output.filename = item.buildName;

    const statsReportOptions = getStatsReportOptions(item);
    const report = await buildWebpack(webpackConf, statsReportOptions);
    if (!report) {
        item.exitError = `ERROR: failed to build test bundle: ${item.name}`;
        return 1;
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
