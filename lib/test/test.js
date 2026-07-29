import fs from 'fs';
import path from 'path';

import Util from '../core/util.js';
import testBuildHandler from './test-build-handler.js';
import testHandler from './test-handler.js';
import Report from './test-report.js';
const reportHandler = Report.generateReport;

const getSpecsPath = function(name) {
    let specsPath = path.resolve(`${Util.getComponentPath(name)}/test/specs`);
    if (!fs.existsSync(specsPath)) {
        Util.logYellow(`Not Found test/specs, Ignore Component: ${name}`);
        return '';
    }
    specsPath = Util.formatPath(specsPath);
    return specsPath;
};

const getJobList = function(list) {

    console.log('test list:');
    Util.logList(list);

    list = [].concat(list);

    const { coverageOptions, mocha } = Util.getConfig('test');

    const debug = Util.option.debug;
    const browser = Util.option.browser;
    const spec = Util.option.spec;
    const defaultViewport = Util.getConfig('defaultViewport');

    const cssExtract = Util.getConfig('build.cssExtract');
    const externals = Util.getConfig('build.externals');
    const alias = Util.getConfig('build.alias');
    const esModule = Util.getConfig('build.esModule');

    const jobList = [];

    for (let i = 0, l = list.length; i < l; i++) {
        const name = list[i];
        const specsPath = getSpecsPath(name);
        if (!specsPath) {
            continue;
        }
        const d = Util.getComponentDependencies(name);
        if (!d) {
            Util.log(`Not found component dependencies: ${name}`);
            return null;
        }

        const componentConf = Util.getComponentConf(name);

        // added .js for mocha load in browser
        // not need fullName, just using for test filename
        const buildName = `${name}.test.js`;

        const job = {
            name: name,
            fullName: Util.getComponentFullName(name),
            specsPath: specsPath,
            componentPath: Util.getComponentPath(name),
            buildPath: `${Util.getTempRoot()}/test/${name}`,
            buildName: buildName,
            coverageOptions,
            mochaOption: mocha,
            debug: debug,
            browser: browser,
            spec: spec,
            defaultViewport: defaultViewport,

            // single component config
            cssExtract: Util.getDefinedValue(componentConf, 'cssExtract', cssExtract),
            externals: Util.getDefinedValue(componentConf, 'externals', externals),
            alias: alias,
            esModule: esModule,

            dependencies: d
        };
        jobList.push(job);
    }

    if (debug) {
        Util.logCyan(`Test in debug mode: ${debug}`);
        if (jobList.length > 1) {
            jobList.length = 1;
            Util.logYellow(`Take only one job to list in debug mode: ${jobList[0].name}`);
        }
    }

    return jobList;

};

const testList = async (list) => {

    Util.cleanBrowserDataCacheDir();

    // create job folder first. sometimes multiprocessing create folder at same time
    const jobFolder = `${Util.getTempRoot()}/test/`;
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
    let exitCode = await Util.startWorker({
        name: 'build',
        workerEntry: path.resolve(import.meta.dirname, 'test-build-worker.js'),
        workerHandler: testBuildHandler,
        jobList: jobList
    });

    if (exitCode !== 0) {
        return exitCode;
    }

    Util.logEnd('finish all build for test, start running test ...');

    let jobTimeout = 30 * 60 * 1000;
    if (Util.option.debug) {
        jobTimeout = 24 * 60 * 60 * 1000;
    }

    jobList.forEach((item) => {
        item.jobName = 'test';
    });

    exitCode = await Util.startWorker({
        name: 'test',
        workerEntry: path.resolve(import.meta.dirname, 'test-worker.js'),
        workerHandler: testHandler,
        jobList: jobList,
        jobTimeout: jobTimeout,
        reportHandler: reportHandler
    });

    Util.cleanBrowserDataCacheDir();

    return exitCode;
};

const testModule = async (componentName) => {

    const list = Util.getCurrentComponentList(componentName);
    if (!list.length) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    const exitCode = await testList(list);
    // always exit no matter exit code is 0
    process.exit(exitCode);

};

testModule.testList = testList;

export default testModule;
