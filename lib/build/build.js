const path = require('path');
const Util = require('../core/util.js');
const buildHandler = require('./build-handler.js');
const reportHandler = require('./build-report.js');

const getBuildENV = async () => {
    // update build tag
    const pc = Util.getProjectConf(true);
    const branch = await Util.getGitBranch();
    const buildENV = {
        ... pc.config,
        ... pc.publishConfig,
        version: pc.version,
        commit: Util.getGitCommit(true),
        branch: branch,
        timestamp: new Date().toISOString()
    };
    console.log('build ENV:');
    Util.logObject(buildENV);
    return buildENV;
};

const getBuildTAG = (buildENV) => {
    // update build tag
    const buildTAG = {
        'window.VERSION': JSON.stringify(buildENV.version),
        'window.COMMIT': JSON.stringify(buildENV.commit),
        'window.BRANCH': JSON.stringify(buildENV.branch),
        'window.TIMESTAMP': JSON.stringify(buildENV.timestamp)
    };
    console.log('build TAG:');
    Util.logObject(buildTAG);
    return buildTAG;
};

const getJobList = async (list) => {

    console.log('build list:');
    Util.logList(list);

    list = [].concat(list);

    const buildENV = await getBuildENV();
    const buildTAG = await getBuildTAG(buildENV);
   
    const devPath = Util.getConfig('dev.path');
    
    const buildPath = Util.getConfig('build.path');
    const entryFile = Util.getConfig('build.entryFile');

    const cssExtract = Util.getConfig('build.cssExtract');
    const externals = Util.getConfig('build.externals');

    const minify = Util.option.minify;
 
    const command = Util.command;

    const jobList = [];

    for (let i = 0, l = list.length; i < l; i++) {
        const name = list[i];

        const d = Util.getComponentDependencies(name);
        if (!d) {
            Util.log(`Not found component dependencies: ${name}`);
            return null;
        }

        const componentConf = Util.getComponentConf(name);
        const componentPath = Util.getComponentPath(name);
        const fullName = Util.getComponentFullName(name);

        // @ns/build-name remove namespace
        const buildName = Util.getComponentBuildName(name);

        // must sync to pack -> inject option
        const job = {
            name: name,
            fullName: fullName,

            componentPath: componentPath,
            buildPath: `${componentPath}/${buildPath}`,
            buildName: buildName,
            // for inject path
            devPath: `${componentPath}/${devPath}`,
            devBuildPath: `${componentPath}/${devPath}/${buildPath}`,

            entryFile: entryFile,

            buildENV: buildENV,
            buildTAG: buildTAG,
            minify: minify,

            // single component config
            cssExtract: Util.getDefinedValue(componentConf, 'cssExtract', cssExtract),
            externals: Util.getDefinedValue(componentConf, 'externals', externals),

            command: command,
            dependencies: d
        };

        jobList.push(job);
    }

    return jobList;

};

// build job list
const buildJobList = async (jobList) => {
    const beforeCode = await Util.runHook('build.beforeAll', jobList);
    if (beforeCode) {
        Util.logRed('ERROR: Failed to run hook build.beforeAll');
        return beforeCode;
    }

    return Util.startWorker({
        name: 'build',
        workerEntry: path.resolve(__dirname, 'build-worker.js'),
        workerHandler: buildHandler,
        jobList: jobList,
        reportHandler: async (o) => {
            await reportHandler(o);
            //got report for after all hook to generate metadata or something
            const afterCode = await Util.runHook('build.afterAll', o);
            if (afterCode) {
                o.code = afterCode;
                const exitError = 'ERROR: Failed to run hook build.afterAll';
                if (o.exitError) {
                    //already got worker error do NOT overwriting
                    Util.logRed(exitError);
                } else {
                    o.exitError = exitError;
                }
            }

        }
    });
};

// build common list
const buildList = async (list) => {
    const jobList = await getJobList(list);
    if (!jobList) {
        return 1;
    }
    return buildJobList(jobList);
};

// for dev and build single component, return component info
const buildComponent = async function(componentName, related = false) {
    const list = [componentName];
    //build related components for pack
    if (related) {
        const dependencies = Util.getComponentDependencies(componentName);
        //console.log(dependencies);
        if (dependencies) {
            const internals = Util.getInternalDependencies();
            dependencies.modules.forEach(function(item) {
                if (Util.hasOwn(internals, item)) {
                    const folderName = Util.getComponentFolderName(item);
                    list.push(folderName);
                }
            });
        }
    }


    const jobList = await getJobList(list);
    if (!jobList) {
        return;
    }
    const exitCode = await buildJobList(jobList);
    if (exitCode) {
        return;
    }

    return jobList.find((it) => it.name === componentName);
};

const buildModule = async (componentName) => {

    const list = Util.getCurrentComponentList(componentName);
    if (!list.length) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    const exitCode = await buildList(list);
    // always exit no matter exit code is 0
    process.exit(exitCode);

};

buildModule.buildList = buildList;
buildModule.buildComponent = buildComponent;

module.exports = buildModule;
