const path = require('path');
const shelljs = require('shelljs');
const Util = require('../core/util.js');
const EC = Util.EC;

const namingHandler = (item) => {

    //check file name
    const componentPath = `${Util.getComponentPath(item.name)}/src`;

    const itemName = EC.cyan(`[${item.name}] `) + EC.magenta('naming');
    console.log(`${itemName} ${Util.relativePath(componentPath)}`);

    const invalidList = [];
    Util.forEachFile(componentPath, [], function(fileName, filePath) {

        const itemList = [`${item.name}/src`];
        let invalid = false;
        //file path check

        filePath = path.relative(componentPath, filePath);
        if (filePath) {
            filePath = Util.formatPath(filePath);
            filePath.split('/').forEach(function(folderName) {
                const pathReg = /^[a-z0-9-]+$/g;
                const pathTest = pathReg.test(folderName);
                if (!pathTest) {
                    itemList.push(EC.red(folderName));
                    invalid = true;
                } else {
                    itemList.push(folderName);
                }
            });
        }

        //file name check
        const nameReg = /^[a-z0-9-.]+$/g;
        const nameTest = nameReg.test(fileName);
        //console.log(nameTest);
        if (!nameTest) {
            itemList.push(EC.red(fileName));
            invalid = true;
        } else {
            itemList.push(fileName);
        }

        if (invalid) {
            invalidList.push(itemList.join('/'));
        }

    });

    if (invalidList.length) {
        Util.logYellow('Expecting folder/file names to be: lowercase-dashed/lowercase-dashed.ext');
        invalidList.forEach(function(item) {
            console.log(item);
        });
        return 1;
    }

    return 0;
};

const shortCmd = function(cmd) {
    const nmRoot = Util.formatPath(Util.nmRoot);
    cmd = cmd.replace(nmRoot, `${Util.name}-cli`);
    const root = Util.formatPath(Util.root);
    cmd = cmd.split(`${root}/`).join('');
    return cmd;
};

const stylelintHandler = (item) => {
    const cmd = item.stylelintCmd;
    if (!cmd) {
        return 0;
    }
    const itemName = EC.cyan(`[${item.name}] `) + EC.magenta('stylelint');
    console.log(`${itemName} ${shortCmd(cmd)}`);
    const sh = shelljs.exec(cmd);
    return sh.code;
};

const eslintHandler = (item) => {
    const cmd = item.eslintCmd;
    if (!cmd) {
        return 0;
    }
    const itemName = EC.cyan(`[${item.name}] `) + EC.magenta('eslint');
    console.log(`${itemName} ${shortCmd(cmd)}`);
    const sh = shelljs.exec(cmd);
    return sh.code;
};

const showLintMsg = function(msgList, exitCode, type, name) {
    let msg = msgList[exitCode];
    if (!msg) {
        return;
    }
    if (typeof(msg) === 'function') {
        msg = msg.call();
    }

    if (exitCode) {
        msg = EC.red(msg);
    } else {
        msg = EC.green(msg);
    }

    if (type) {
        msg = `${EC.magenta(type)} ${msg}`;
    }

    if (name) {
        msg = EC.cyan(`[${name}] `) + msg;
    }

    console.log(msg);
};

const lintHandler = async (item) => {

    Util.jobId = item.jobId;
    Util.jobName = item.jobName;
    Util.componentName = item.name;
    Util.logWorker();

    item.report = {
        naming: 0,
        stylelint: 0,
        eslint: 0
    };

    //1, naming
    let exitCode = await namingHandler(item);
    item.report.naming = exitCode;
    showLintMsg({
        '0': 'passed',
        '1': 'at least one error.'
    }, exitCode, 'naming', item.name);

    if (item.naming && exitCode !== 0) {
        item.exitError = `ERROR: failed to check folder/file name: ${item.name}`;
        return exitCode;
    }

    //2, stylelint
    exitCode = await stylelintHandler(item);
    item.report.stylelint = exitCode;
    showLintMsg({
        '0': 'passed',
        '1': 'something unknown went wrong',
        '2': 'at least one error',
        '78': 'some problem with the configuration file',
        '80': 'a file glob was passed, but it found no files'
    }, exitCode, 'stylelint', item.name);

    if (item.stylelint && exitCode !== 0) {
        item.exitError = `ERROR: stylelint failed: ${item.name}`;
        return exitCode;
    }

    //3, eslint (required)
    exitCode = await eslintHandler(item);
    item.report.eslint = exitCode;
    showLintMsg({
        '0': 'passed',
        '1': function() {
            console.log('Tips: How to disable eslint with inline comments?');
            Util.logCyan('/* eslint-disable max-statements,complexity */');
            console.log('your codes here');
            Util.logCyan('/* eslint-enable */');
            return 'at least one error';
        },
        '2': 'a configuration problem or an internal error'
    }, exitCode, 'eslint', item.name);

    if (exitCode !== 0) {
        item.exitError = `ERROR: eslint failed: ${item.name}`;
        return exitCode;
    }

    return 0;
};

module.exports = lintHandler;
