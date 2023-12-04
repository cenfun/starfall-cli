const path = require('path');
const semver = require('semver');
const Util = require('../core/util.js');
const buildHandler = require('./build-handler.js');
const reportHandler = require('./build-report.js');

const getBuildEnv = async () => {
    // update build env
    const pc = Util.getProjectConf(true);
    const branch = await Util.getGitBranch();
    const env = {
        ... pc.config,
        ... Util.option,
        command: Util.command,
        registry: Util.registry,
        version: pc.version,
        commit: Util.getGitCommit(true),
        branch: branch,
        timestamp: new Date().toISOString()
    };
    console.log('build env:');
    Util.logObject(env);
    return env;
};

const updateBuildVersion = (version, newVersion) => {
    const {
        valid, clean, inc
    } = semver;

    if (valid(newVersion)) {
        return clean(newVersion);
    }

    const currentClean = clean(version);
    const incVersion = inc(currentClean, newVersion);

    // console.log('inc', incVersion, currentClean, newVersion);

    return incVersion;
};

const getBuildDefine = (env) => {
    // update build define
    let buildDefine = Util.getConfig('build.define');
    if (typeof buildDefine === 'function') {
        buildDefine = buildDefine(env);
    }

    let version = env.version;
    const pv = Util.option.production;
    if (pv && typeof pv === 'string') {
        version = updateBuildVersion(version, pv);
    }

    const define = {
        ... buildDefine,
        'window.VERSION': JSON.stringify(version),
        'window.COMMIT': JSON.stringify(env.commit),
        'window.BRANCH': JSON.stringify(env.branch),
        'window.TIMESTAMP': JSON.stringify(env.timestamp)
    };
    console.log('build define:');
    Util.logObject(define);
    return define;
};

const getJobList = async (list, options = {}) => {

    console.log('build list:');
    Util.logList(list);

    list = [].concat(list);

    const env = await getBuildEnv();
    const define = await getBuildDefine(env);

    const devPath = Util.getConfig('dev.path');

    const buildPath = Util.getConfig('build.path');
    const entryFile = Util.getConfig('build.entryFile');

    const cssExtract = Util.getConfig('build.cssExtract');
    const externals = Util.getConfig('build.externals');
    const platform = Util.getConfig('build.platform');

    const alias = Util.getConfig('build.alias');
    const esModule = Util.getConfig('build.esModule');

    const production = Util.option.production;

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
        // if build es module files for webpack only
        const esm = Util.option.esm || Util.hasOwn(componentConf, 'module');

        const componentPath = Util.getComponentPath(name);
        const fullName = Util.getComponentFullName(name);

        // @ns/build-name remove namespace, without extname
        const buildName = Util.getComponentBuildName(name);

        // must sync to pack -> inject option
        const job = {
            ... options,
            name: name,
            fullName: fullName,

            componentPath: componentPath,
            buildPath: `${componentPath}/${buildPath}`,
            buildName: buildName,
            // for inject path
            devPath: `${componentPath}/${devPath}`,
            devBuildPath: `${componentPath}/${devPath}/${buildPath}`,

            entryFile: entryFile,

            env: env,
            define: define,
            production: production,

            // single component config
            cssExtract: Util.getDefinedValue(componentConf, 'cssExtract', cssExtract),
            externals: Util.getDefinedValue(componentConf, 'externals', externals),
            platform: Util.getDefinedValue(componentConf, 'platform', platform),
            esm: esm,

            alias: alias,
            esModule: esModule,

            command: command,
            dependencies: d
        };

        jobList.push(job);
    }

    return jobList;

};

// build job list
const buildJobList = async (jobList) => {
    const beforeCode = await Util.runHook('build.beforeAll', {
        jobList
    });
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
            // got report for after all hook to generate metadata or something
            const afterCode = await Util.runHook('build.afterAll', o);
            if (afterCode) {
                o.code = afterCode;
                const exitError = 'ERROR: Failed to run hook build.afterAll';
                if (o.exitError) {
                    // already got worker error do NOT overwriting
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
const buildComponent = async function(componentName, related = false, options = {}) {
    const list = [componentName];
    // build related components for pack
    if (related) {
        const dependencies = Util.getComponentDependencies(componentName);
        // console.log(dependencies);
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


    const jobList = await getJobList(list, options);
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
