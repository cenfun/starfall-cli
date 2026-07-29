import {
    state,
    relativePath,
    formatPath,
    getTemplate,
    replace,
    logEnd,
    log,
    getWebpackExternals,
    createConf,
    initWebpackConf
} from '../core/util.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import buildWebpack from '../build/build-webpack.js';

const getTestEntryContent = function(item) {
    // do NOT resolve path
    // configuration.output.path: The provided value is not an absolute path!
    const buildPath = item.buildPath;

    if (!fs.existsSync(buildPath)) {
        fs.mkdirSync(buildPath, {
            recursive: true
        });
    }
    // do NOT delete test files for realtime debug refresh

    // create test entry file, test src filename
    item.entry = `${buildPath}/${item.name}.js`;
    console.log(`test entry: ${relativePath(item.entry)}`);

    const utilPath = path.resolve(state.cliRoot, 'lib/test/test-util.js');
    // relative to test build path
    const testUtilPath = formatPath(path.relative(buildPath, utilPath));

    const list = [
        `require('${testUtilPath}');`
    ];

    console.log(`test specs: ${relativePath(item.specsPath)}`);
    // relative to test build path
    const specsPath = formatPath(path.relative(buildPath, item.specsPath));

    // -s --spec for single spec file
    const spec = item.spec || '';

    const entryTemplate = getTemplate(path.resolve(import.meta.dirname, 'test-entry-template.js'));

    const entry = replace(entryTemplate, {
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
    if (!state.componentsRoot) {
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

    const externals = getWebpackExternals(item);

    const option = {
        componentName: item.fullName,
        dependencies: item.dependencies.modules,
        externals: externals,
        alias: item.alias,
        esModule: item.esModule,

        root: state.root,
        cliRoot: state.cliRoot,

        mode: 'development',
        devtool: 'source-map'
    };

    const webpackConf = createConf('webpack', option);
    initWebpackConf(webpackConf, item, option);

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
    item.fileTest = formatPath(file);

    logEnd(`finish: ${relativePath(file)}`);

    return 0;
};

const testBuildHandler = (item) => {

    state.jobId = item.jobId;
    state.jobName = item.jobName;
    state.componentName = item.name;
    log();

    return buildTest(item);

};

testBuildHandler.buildTest = buildTest;

export default testBuildHandler;
