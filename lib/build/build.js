const path = require("path");
const Util = require("../core/util.js");
const buildHandler = require("./build-handler.js");
const reportHandler = require("./build-report.js");

const getBuildENV = async () => {
    //update build tag
    const pc = Util.getProjectConf(true);
    const branch = await Util.getGitBranch();
    const buildENV = Object.assign({}, pc.config, pc.publishConfig, {
        version: pc.version,
        commit: Util.getGitCommit(true),
        branch: branch,
        timestamp: new Date().toISOString()
    });
    console.log("build ENV:");
    Util.logObject(buildENV);
    return buildENV;
};

const getBuildTAG = (buildENV) => {
    //update build tag
    const buildTAG = {
        "window.VERSION": JSON.stringify(buildENV.version),
        "window.COMMIT": JSON.stringify(buildENV.commit),
        "window.BRANCH": JSON.stringify(buildENV.branch),
        "window.TIMESTAMP": JSON.stringify(buildENV.timestamp)
    };
    console.log("build TAG:");
    Util.logObject(buildTAG);
    return buildTAG;
};

const getJobList = async (list) => {

    console.log("build list:");
    Util.logList(list);

    list = [].concat(list);

    const buildENV = await getBuildENV();
    const buildTAG = await getBuildTAG(buildENV);
    const buildPath = Util.getSetting("buildPath");
    const previewPath = Util.getSetting("previewPath");
    const srcEntry = Util.getSetting("srcEntry");

    //global config
    const cssExtract = Util.getSetting("cssExtract");

    const minify = Util.option.minify;
    const bundle = Util.option.bundle;

    const query = Util.option.query;
    const css = Util.option.css || cssExtract;
    const inject = Util.option.inject;
    const command = Util.command;

    const jobList = [];

    for (let i = 0, l = list.length; i < l; i++) {
        const name = list[i];
        const componentConf = Util.getComponentConf(name);
        const componentPath = Util.getComponentPath(name);
        const fullName = Util.getComponentFullName(name);
        const outputName = Util.getComponentOutputName(name);

        //must sync to pack -> inject option
        const job = {
            name: name,
            fullName: fullName,

            componentPath: componentPath,
            outputPath: `${componentPath}/${buildPath}/`,
            outputName: outputName,
            //for inject path
            previewPath: `${componentPath}/${previewPath}/`,

            buildENV: buildENV,
            buildTAG: buildTAG,
            minify: minify,
            bundle: bundle,
            query: query,

            //single component config
            css: css || componentConf.cssExtract,
            injectPath: inject || componentConf.injectPath,

            command: command
        };

        //entry checking
        job.entry = `${job.componentPath}/src/${srcEntry}`;

        jobList.push(job);
    }

    return jobList;

};

//for build common list
const buildList = async (list) => {
    const jobList = await getJobList(list);
    if (!jobList) {
        return 1;
    }

    //workerLength for bundle build
    let workerLength;
    if (jobList.length > 1 && Util.option.bundle) {
        workerLength = 1;
    }

    const exitCode = await Util.startWorker({
        name: "build",
        workerEntry: path.resolve(__dirname, "build-worker.js"),
        workerHandler: buildHandler,
        jobList: jobList,
        workerLength: workerLength,
        reportHandler: reportHandler
    });
    return exitCode;
};

//for preview and build single component, return component info
const buildComponent = async function(componentName, folder) {
    const jobList = await getJobList([componentName]);
    if (!jobList) {
        return;
    }
    const item = jobList.shift();
    item.folder = folder;
    const exitCode = await buildHandler(item);
    if (exitCode) {
        return;
    }
    return item;
};

const buildModule = async (componentName) => {

    const list = Util.getCurrentComponentList(componentName);
    if (!list.length) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    //build bundle
    if (Util.option.bundle) {
        Util.logYellow("Only select one component in bundle mode");
        list.length = 1;
    }

    const exitCode = await buildList(list);
    //always exit no matter exit code is 0
    process.exit(exitCode);

};

buildModule.buildComponent = buildComponent;
buildModule.buildList = buildList;

module.exports = buildModule;
