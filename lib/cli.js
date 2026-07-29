#!/usr/bin/env node
import path from 'path';
import semver from 'semver';
import EC from 'eight-colors';

// https://github.com/tj/commander.js
import { program } from 'commander';
import commanderHelp from 'commander-help';

import upgrade from './core/upgrade.js';

import {
    state, initConfig, logRed, logYellow, logOS, logLine,
    formatPath, getCLIVersion
} from './core/util.js';

// check node version
const nv = process.versions.node;

// check required version
const lowest = '22.12.0';
if (semver.lt(nv, lowest)) {
    logRed(`You are running Node.js ${nv}, requires version ${lowest} or higher`);
    process.exit(1);
}

// check recommended version
const recommended = '24.18.0';
if (semver.lt(nv, recommended)) {
    logYellow(`You are running Node.js ${nv}, recommended update to version ${recommended}`);
}

// ===============================================================

// project root
state.root = formatPath(process.cwd());

// cli root
state.cliRoot = formatPath(path.resolve(import.meta.dirname, '../'));

// console.log("root: " + state.root);
// console.log("cliRoot: " + state.cliRoot);

// ===============================================================
// version checking
const version = getCLIVersion();
upgrade(version);

// ===============================================================
// log error
process.on('exit', (code) => {
    if (code) {
        logOS(version);
        return;
    }
    if (state.upgradeTips) {
        console.log(state.upgradeTips);
    }
});

// ===============================================================
const runTask = async function(cmd, argList) {

    // run project task
    state.command = cmd;

    const tasks = {
        clean: true,
        list: true,
        outdate: true,
        publish: true,
        test: true,
        version: true
    };
    const task = tasks[cmd];
    if (!task) {
        logRed(`Invalid command: ${cmd}`);
        process.exit(1);
    }

    // console.log(state.root, state.cliRoot, state.componentsRoot);

    let taskModule = null;
    try {
        taskModule = (await import(`./${cmd}/${cmd}.js`)).default;
    } catch (e) {
        console.log(e);
    }
    if (!taskModule) {
        process.exit(1);
    }

    // to array
    const list = Array.from(argList);

    // last one is Commander, remove it
    list.pop();
    // and option, remove it
    state.option = list.pop();
    // and let is args, filter undefined if no args
    const args = list.filter((it) => it);

    // console.log(state.option);
    // console.log(args);

    state.cliConf = await initConfig();

    const cmdStr = [state.id, cmd].concat(args).join(' ');
    logLine(EC.magenta(`[${cmdStr}]`));
    taskModule.apply(this, args);
};

// ===============================================================


program.version(version, '-v, --version');

// disabled default help
program.helpInformation = function() {
    return '';
};

// custom help
program.on('--help', function() {

    program._name = state.id;

    console.log(` Usage: ${state.id} <${EC.cyan('command')}> [options]`);

    commanderHelp(program);

    console.log(` root: ${state.root}`);
    console.log(` cliRoot: ${state.cliRoot}`);
    console.log(` registry: ${state.registry}`);

});

// ===============================================================

program
    .command('clean')
    .alias('c')
    .option('-e, --exclude <rules>', 'ignore exclude rules')
    .option('-g, --git', 'git reset')
    .option('-d, --debug', 'debug without delete operations')
    .description('clean temporary files')
    .action(function() {
        runTask('clean', arguments);
    });


program
    .command('list [name]')
    .option('-s, --sort [sortField]', 'sort list by field')
    .option('-a, --asc', 'sort with ASC')
    .option('-f, --files', 'show files')
    .description('list installed packages')
    .action(function() {
        runTask('list', arguments);
    });

program
    .command('outdate')
    .alias('o')
    .option('-u, --update', 'update versions to package.json')
    .option('-t, --timeout <timeout>', 'timeout for request')
    .description('outdate check')
    .action(function() {
        runTask('outdate', arguments);
    });


program
    .command('publish [version]')
    .option('-m, --message <message>', 'a message to commit')
    .option('-t, --tag <tag>', 'tag package')
    .option('-r, --root', 'root package only')
    .option('-o, --override', 'allow override version')
    .option('-d, --debug', 'debug without publishing to server')
    .description('publish components')
    .action(function() {
        runTask('publish', arguments);
    });


program
    .command('test [name[,name]]')
    .alias('t')
    .option('-s, --spec <file>', 'test a single spec file')
    .option('-b, --browser <type>', 'chromium, firefox or webkit')
    .option('-d, --debug [slowMo]', 'debug mode')
    .option('--cp <num>', 'child process number')
    .description('test components (Vite migration pending)')
    .action(function() {
        runTask('test', arguments);
    });

program
    .command('version [version]')
    .option('-m, --message <message>', 'a message to commit')
    .description('version management')
    .action(function() {
        runTask('version', arguments);
    });

program
    .command('*')
    .action(function() {
        logRed(` unknown command, try: ${state.id} --help`);
    });

// ===============================================================
program.parse(process.argv);

// last one if no args
if (program.rawArgs.length < 3) {
    program.help();
}
