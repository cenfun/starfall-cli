const fs = require("fs");
const path = require("path");
const shelljs = require("shelljs");
const Util = require("../core/util.js");
const eslintOption = require("./lint-eslint-option.js");
const reportHandler = require("./lint-report.js");
const lintHandler = require("./lint-handler.js");

const getJobTempFolder = function() {
    //copy new to temp
    const jobFolder = path.resolve(Util.getTempRoot(), "lint");
    if (!fs.existsSync(jobFolder)) {
        shelljs.mkdir("-p", jobFolder);
    }
    return jobFolder;
};

//=====================================================================================================

const setCustomEslintPlugin = function(json, o) {

    const extend = o.extend;
    if (extend) {
        json.extends = Util.toList(json.extends);
        if (!Util.inList(extend, json.extends)) {
            json.extends.push(extend);
        }
    }

    const plugin = o.plugin;
    if (plugin) {
        json.plugins = Util.toList(json.plugins);
        if (!Util.inList(plugin, json.plugins)) {
            json.plugins.push(plugin);
        }
    }

    const rules = o.rules;
    if (rules) {
        if (!json.rules) {
            json.rules = {};
        }
        for (const k in rules) {
            json.rules[k] = rules[k];
        }
    }
};

const saveCustomEslintConfig = function(confPath, json) {
    const content = `module.exports = ${Util.jsonString(json)};`;
    fs.writeFileSync(confPath, content);
};

const customEslintConfigHandler = function(confPath) {
    const json = require(confPath);
    //console.log(conf);
    if (!json) {
        Util.logRed(`ERROR: fail to require lint conf: ${confPath}`);
        return;
    }

    //auto add vue plugin if ext has vue
    const eslintConf = Util.getSetting("eslint");
    if (eslintConf.ext && eslintConf.ext.indexOf("vue") !== -1) {
        setCustomEslintPlugin(json, eslintOption.vue);
    }

    //add custom plugin
    const e = Util.option.eslint;
    if (e) {
        const o = eslintOption[e];
        if (o) {
            setCustomEslintPlugin(json, o);
        }
    }

    saveCustomEslintConfig(confPath, json);
};

const getEslintConfPath = function() {
    const confFileName = ".eslintrc.js";
    //from project
    let confPath = `${Util.root}/${confFileName}`;
    if (!fs.existsSync(confPath)) {
        //default config 
        confPath = `${Util.cliRoot}/${confFileName}`;
    }

    //copy new to temp
    const jobFolder = getJobTempFolder();
    shelljs.cp("-f", confPath, jobFolder);

    confPath = path.resolve(jobFolder, confFileName);

    //edit lint config
    customEslintConfigHandler(confPath);

    console.log(`eslint config path: ${Util.relativePath(confPath)}`);

    return confPath;
};

const getEslintCmd = function(eslintFiles, eslintConfPath, option) {

    if (!eslintFiles) {
        eslintFiles = "**/*.js";
    }

    if (!eslintConfPath) {
        eslintConfPath = getEslintConfPath();
    }

    //https://eslint.org/
    let lintBin = path.resolve(Util.nmRoot, "./node_modules/.bin/eslint");
    lintBin = Util.formatPath(lintBin);
    lintBin = `"${lintBin}"`;
    //console.log(lintBin);
    const params = [lintBin];

    eslintConfPath = path.resolve(eslintConfPath);
    eslintConfPath = Util.formatPath(eslintConfPath);
    const config = `--config "${eslintConfPath}"`;
    params.push(config);

    //should be directory if use --ext
    eslintFiles = Util.formatPath(eslintFiles);
    const directory = `"${eslintFiles}"`;
    params.push(directory);

    const nmRoot = Util.formatPath(Util.nmRoot);
    params.push(`--resolve-plugins-relative-to "${nmRoot}"`);

    params.push("--env browser");
    params.push("--color");
    params.push("--fix");

    if (option) {
        params.push(option);
    }

    const cmd = params.join(" ");

    return cmd;
};

//=====================================================================================================

const getStylelintConfPath = function() {
    const confFileName = ".stylelintrc.js";
    //from project
    let confPath = `${Util.root}/${confFileName}`;
    if (!fs.existsSync(confPath)) {
        //default config 
        confPath = `${Util.cliRoot}/${confFileName}`;
    }

    //copy new to temp
    const jobFolder = getJobTempFolder();
    shelljs.cp("-f", confPath, jobFolder);

    confPath = `${jobFolder}/${confFileName}`;

    console.log(`stylelint config path: ${confPath}`);

    return confPath;
};

const getStylelintCmd = function(stylelintFiles, stylelintConfPath, option) {
    if (!stylelintFiles) {
        stylelintFiles = "**/*.{css,scss}";
    }

    if (!stylelintConfPath) {
        stylelintConfPath = getStylelintConfPath();
    }

    //https://stylelint.io/
    let lintBin = path.resolve(Util.nmRoot, "./node_modules/.bin/stylelint");
    lintBin = Util.formatPath(lintBin);
    lintBin = `"${lintBin}"`;
    //console.log(lintBin);
    const params = [lintBin];

    stylelintFiles = Util.formatPath(stylelintFiles);
    const directory = `"${stylelintFiles}"`;
    params.push(directory);

    stylelintConfPath = path.resolve(stylelintConfPath);
    stylelintConfPath = Util.formatPath(stylelintConfPath);
    const config = `--config "${stylelintConfPath}"`;
    params.push(config);

    params.push("--allow-empty-input");
    params.push("--color");
    params.push("--fix");

    if (option) {
        params.push(option);
    }

    const cmd = params.join(" ");

    return cmd;

};

//=====================================================================================================

const eslintExtHandler = (ext, vue) => {
    if (typeof(ext) !== "string") {
        ext += "";
    }
    if (!ext) {
        ext = "js";
    }
    if (vue !== "vue") {
        return ext;
    }
    if (ext.indexOf("vue") !== -1) {
        return ext;
    }
    ext = ext.replace(/[{}]/g, "");
    ext = `{${ext.trim()},${vue}}`;
    return ext;
};

const getJobList = function(list, stylelintConfPath, eslintConfPath) {

    console.log("lint list:");
    Util.logList(list);

    //clone list for list.shift()
    list = [].concat(list);

    const namingConf = Util.getSetting("naming");
    const stylelintConf = Util.getSetting("stylelint");
    const eslintConf = Util.getSetting("eslint");

    //auto add vue to ext
    eslintConf.ext = eslintExtHandler(eslintConf.ext, Util.option.eslint);

    const jobList = [];
    list.forEach(function(name, i) {
        const lintPath = `${Util.getComponentPath(name)}/src`;
        const stylelintFiles = path.resolve(lintPath, `**/*.${stylelintConf.ext}`);
        const eslintFiles = path.resolve(lintPath, `**/*.${eslintConf.ext}`);
        const job = {
            naming: namingConf.required || Util.option.naming,
            stylelint: stylelintConf.required || Util.option.stylelint,
            stylelintCmd: getStylelintCmd(stylelintFiles, stylelintConfPath, stylelintConf.option),
            eslintCmd: getEslintCmd(eslintFiles, eslintConfPath, eslintConf.option),
            name: name
        };
        jobList.push(job);
    });

    return jobList;
};

const lintList = async (list) => {

    const stylelintConfPath = getStylelintConfPath();
    const eslintConfPath = getEslintConfPath();

    const jobList = getJobList(list, stylelintConfPath, eslintConfPath);
    const option = {
        name: "lint",
        workerEntry: path.resolve(__dirname, "lint-worker.js"),
        workerHandler: lintHandler,
        jobList: jobList,
        stylelintConfPath: stylelintConfPath,
        eslintConfPath: eslintConfPath,
        reportHandler: reportHandler
    };
    if (Util.option.eslint) {
        option.failFast = false;
    }
    const exitCode = await Util.startWorker(option);
    return exitCode;
};

const lintModule = async (componentName) => {

    const list = Util.getCurrentComponentList(componentName);
    if (!list.length) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    const exitCode = await lintList(list);
    //always exit no matter exit code is 0
    process.exit(exitCode);

};

lintModule.lintList = lintList;
lintModule.getEslintCmd = getEslintCmd;

module.exports = lintModule;
