import fs from 'fs';
import path from 'path';


import {
    state,
    getComponentPath,
    logYellow,
    formatPath,
    logList,
    getConfig,
    log,
    getComponentConf,
    getComponentFullName,
    getTempRoot,
    getDefinedValue,
    logCyan,
    logEnd,
    getCurrentComponentList,
    logRed,
    getComponentDependencies,
    cleanBrowserDataCacheDir,
    startWorker
} from '../core/util.js';
import testBuildHandler from './test-build-handler.js';
import testHandler from './test-handler.js';
import Report from './test-report.js';
const reportHandler = Report.generateReport;

const getSpecsPath = function(name) {
    let specsPath = path.resolve(`${getComponentPath(name)}/test/specs`);
    if (!fs.existsSync(specsPath)) {
        logYellow(`Not Found test/specs, Ignore Component: ${name}`);
        return '';
    }
    specsPath = formatPath(specsPath);
    return specsPath;
};

const getJobList = function(list) {

    console.log('test list:');
    logList(list);

    list = [].concat(list);

    const { coverageOptions, mocha } = getConfig('test');

    const debug = state.option.debug;
    const browser = state.option.browser;
    const spec = state.option.spec;
    const defaultViewport = getConfig('defaultViewport');

    const cssExtract = getConfig('build.cssExtract');
    const externals = getConfig('build.externals');
    const alias = getConfig('build.alias');
    const esModule = getConfig('build.esModule');

    const jobList = [];

    for (let i = 0, l = list.length; i < l; i++) {
        const name = list[i];
        const specsPath = getSpecsPath(name);
        if (!specsPath) {
            continue;
        }
        const d = getComponentDependencies(name);
        if (!d) {
            log(`Not found component dependencies: ${name}`);
            return null;
        }

        const componentConf = getComponentConf(name);

        // added .js for mocha load in browser
        // not need fullName, just using for test filename
        const buildName = `${name}.test.js`;

        const job = {
            name: name,
            fullName: getComponentFullName(name),
            specsPath: specsPath,
            componentPath: getComponentPath(name),
            buildPath: `${getTempRoot()}/test/${name}`,
            buildName: buildName,
            coverageOptions,
            mochaOption: mocha,
            debug: debug,
            browser: browser,
            spec: spec,
            defaultViewport: defaultViewport,

            // single component config
            cssExtract: getDefinedValue(componentConf, 'cssExtract', cssExtract),
            externals: getDefinedValue(componentConf, 'externals', externals),
            alias: alias,
            esModule: esModule,

            dependencies: d
        };
        jobList.push(job);
    }

    if (debug) {
        logCyan(`Test in debug mode: ${debug}`);
        if (jobList.length > 1) {
            jobList.length = 1;
            logYellow(`Take only one job to list in debug mode: ${jobList[0].name}`);
        }
    }

    return jobList;

};

const testList = async (list) => {

    cleanBrowserDataCacheDir();

    // create job folder first. sometimes multiprocessing create folder at same time
    const jobFolder = `${getTempRoot()}/test/`;
    if (!fs.existsSync(jobFolder)) {
        fs.mkdirSync(jobFolder, {
            recursive: true
        });
    }

    const jobList = getJobList(list);
    if (!jobList) {
        // return null, not found dependency
        return 1;
    }

    if (!jobList.length) {
        // maybe ignored
        return 0;
    }

    // require build first, because webpack cost CPU and will break test
    let exitCode = await startWorker({
        name: 'build',
        workerEntry: path.resolve(import.meta.dirname, 'test-build-worker.js'),
        workerHandler: testBuildHandler,
        jobList: jobList
    });

    if (exitCode !== 0) {
        return exitCode;
    }

    logEnd('finish all build for test, start running test ...');

    let jobTimeout = 30 * 60 * 1000;
    if (state.option.debug) {
        jobTimeout = 24 * 60 * 60 * 1000;
    }

    jobList.forEach((item) => {
        item.jobName = 'test';
    });

    exitCode = await startWorker({
        name: 'test',
        workerEntry: path.resolve(import.meta.dirname, 'test-worker.js'),
        workerHandler: testHandler,
        jobList: jobList,
        jobTimeout: jobTimeout,
        reportHandler: reportHandler
    });

    cleanBrowserDataCacheDir();

    return exitCode;
};

const testModule = async (componentName) => {

    const list = getCurrentComponentList(componentName);
    if (!list.length) {
        logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    const exitCode = await testList(list);
    // always exit no matter exit code is 0
    process.exit(exitCode);

};

testModule.testList = testList;

export default testModule;
