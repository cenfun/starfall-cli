const fs = require('fs');
const path = require('path');
const Util = require('../core/util.js');
const reportHandler = require('./lint-report.js');
const lintHandler = require('./lint-handler.js');
const lintRules = require('./lint-rules.js');

const getEslintConfPath = function() {
    const confFileName = '.eslintrc.js';
    //from project
    let confPath = `${Util.root}/${confFileName}`;
    if (!fs.existsSync(confPath)) {
        //default config 
        confPath = `${Util.cliRoot}/${confFileName}`;
    }

    console.log(`eslint config path: ${Util.relativePath(confPath)}`);

    return confPath;
};

const getStylelintConfPath = function() {
    const confFileName = '.stylelintrc.js';
    //from project
    let confPath = `${Util.root}/${confFileName}`;
    if (!fs.existsSync(confPath)) {
        //default config 
        confPath = `${Util.cliRoot}/${confFileName}`;
    }

    console.log(`stylelint config path: ${Util.relativePath(confPath)}`);

    return confPath;
};

//=====================================================================================================

const getEslintCmd = function(eslintFiles, eslintConfPath, option) {
    //https://eslint.org/
    let lintBin = path.resolve(Util.nmRoot, './node_modules/.bin/eslint');
    lintBin = Util.formatPath(lintBin);
    lintBin = `"${lintBin}"`;
    //console.log(lintBin);
    const params = [lintBin];

    //should be directory if use --ext
    eslintFiles = Util.formatPath(eslintFiles);
    params.push(`"${eslintFiles}"`);

    eslintConfPath = Util.formatPath(path.resolve(eslintConfPath));
    params.push(`--config "${eslintConfPath}"`);

    const nmRoot = Util.formatPath(Util.nmRoot);
    params.push(`--resolve-plugins-relative-to "${nmRoot}"`);

    params.push('--env browser');
    params.push('--color');
    params.push('--fix');

    if (option) {
        params.push(option);
    }

    return params.join(' ');
};

const getStylelintCmd = function(stylelintFiles, stylelintConfPath, option) {
    //https://stylelint.io/
    let lintBin = path.resolve(Util.nmRoot, './node_modules/.bin/stylelint');
    lintBin = Util.formatPath(lintBin);
    lintBin = `"${lintBin}"`;
    //console.log(lintBin);
    const params = [lintBin];

    stylelintFiles = Util.formatPath(stylelintFiles);
    params.push(`"${stylelintFiles}"`);

    stylelintConfPath = Util.formatPath(path.resolve(stylelintConfPath));
    params.push(`--config "${stylelintConfPath}"`);

    // const configBaseDir = path.dirname(stylelintConfPath);
    // params.push(`--config-basedir "${configBaseDir}"`);

    params.push('--allow-empty-input');
    params.push('--color');
    params.push('--fix');

    if (option) {
        params.push(option);
    }

    return params.join(' ');
};

//=====================================================================================================

const getJobList = function(list, stylelintConfPath, eslintConfPath) {

    console.log('lint list:');
    Util.logList(list);

    //clone list for list.shift()
    list = [].concat(list);

    const namingConf = Util.getConfig('lint.naming');
    const stylelintConf = Util.getConfig('lint.stylelint');
    const eslintConf = Util.getConfig('lint.eslint');

    const jobList = [];
    list.forEach(function(name, i) {
        const lintPath = `${Util.getComponentPath(name)}/{src,test}`;
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

const lintList = (list) => {

    const stylelintConfPath = getStylelintConfPath();
    const eslintConfPath = getEslintConfPath();

    const jobList = getJobList(list, stylelintConfPath, eslintConfPath);
    const option = {
        name: 'lint',
        workerEntry: path.resolve(__dirname, 'lint-worker.js'),
        workerHandler: lintHandler,
        jobList: jobList,
        stylelintConfPath: stylelintConfPath,
        eslintConfPath: eslintConfPath,
        reportHandler: reportHandler
    };

    return Util.startWorker(option);
};

const lintModule = async (componentName) => {

    if (Util.option.rules) {
        lintRules();
        return;
    }

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

module.exports = lintModule;
