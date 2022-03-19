const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');

const Util = require('../core/util.js');
const testBuildHandler = require('./test-build-handler.js');
const testHandler = require('./test-handler.js');
const Report = require('./test-report.js');
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

    const testFrameworkOption = Util.getSetting('testFrameworkOption');
    const debug = Util.option.debug;
    const browser = Util.option.browser;
    const spec = Util.option.spec;
    const defaultViewport = Util.getSetting('defaultViewport');

    const cssExtract = Util.getSetting('cssExtract');
    const externals = Util.getSetting('externals');

    const jobList = [];

    for (let i = 0, l = list.length; i < l; i++) {
        const name = list[i];
        const specsPath = getSpecsPath(name);
        if (!specsPath) {
            continue;
        }
        const d = Util.getComponentDependencies(name);
        if (!d) {
            Util.logMsg(`Not found component dependencies: ${name}`);
            return null;
        }

        const componentConf = Util.getComponentConf(name);

        const job = {
            name: name,
            fullName: Util.getComponentFullName(name),
            specsPath: specsPath,
            componentPath: Util.getComponentPath(name),
            outputPath: `${Util.getTempRoot()}/test/${name}/`,
            outputName: `${name}-test.js`,
            testFrameworkOption: testFrameworkOption,
            debug: debug,
            browser: browser,
            spec: spec,
            defaultViewport: defaultViewport,

            //single component config
            cssExtract: Util.getDefinedValue(componentConf, 'cssExtract', cssExtract),
            externals: Util.getDefinedValue(componentConf, 'externals', externals),

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

    //create job folder first. sometimes multiprocessing create folder at same time
    const jobFolder = `${Util.getTempRoot()}/test/`;
    if (!fs.existsSync(jobFolder)) {
        shelljs.mkdir('-p', jobFolder);
    }

    const jobList = getJobList(list);
    if (!jobList) {
        //return null, not found dependency
        return 1;
    }

    if (!jobList.length) {
        //maybe ignored
        return 0;
    }

    //require build first, because webpack cost CPU and will break test 
    let exitCode = await Util.startWorker({
        name: 'build',
        workerEntry: path.resolve(__dirname, 'test-build-worker.js'),
        workerHandler: testBuildHandler,
        jobList: jobList
    });

    if (exitCode !== 0) {
        return exitCode;
    }

    Util.logStart('finish all build for test, start running test ...');

    let jobTimeout = 30 * 60 * 1000;
    if (Util.option.debug) {
        jobTimeout = 24 * 60 * 60 * 1000;
    }

    jobList.forEach(item => {
        item.jobName = 'test';
    });

    exitCode = await Util.startWorker({
        name: 'test',
        workerEntry: path.resolve(__dirname, 'test-worker.js'),
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
    //always exit no matter exit code is 0
    process.exit(exitCode);

};

testModule.testList = testList;

module.exports = testModule;
