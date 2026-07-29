#!/usr/bin/env node
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

import path from 'path';
import semver from 'semver';

import Util from './core/util.js';
const EC = Util.EC;


// check node version
const nv = process.versions.node;

// check required version
const lowest = '22.12.0';
if (semver.lt(nv, lowest)) {
    Util.logRed(`You are running Node.js ${nv}, requires version ${lowest} or higher`);
    process.exit(1);
}

// check recommended version
const recommended = '24.18.0';
if (semver.lt(nv, recommended)) {
    Util.logYellow(`You are running Node.js ${nv}, recommended update to version ${recommended}`);
}

// ===============================================================

// project root
Util.root = Util.formatPath(process.cwd());

// cli root
Util.cliRoot = Util.formatPath(path.resolve(__dirname, '../'));

// node modules root
Util.nmRoot = Util.cliRoot;
const rel = Util.formatPath(path.relative(Util.root, Util.cliRoot));
if (rel === `node_modules/${Util.name}-cli`) {
    // has been installed in local
    Util.nmRoot = Util.root;
}
// console.log("root: " + Util.root);
// console.log("cliRoot: " + Util.cliRoot);
// console.log("nmRoot: " + Util.nmRoot);

// ===============================================================
// version checking
const version = Util.getCLIVersion();
import upgrade from './core/upgrade.js';
upgrade(version);

// ===============================================================
// log error
process.on('exit', (code) => {
    if (code) {
        Util.logOS(version);
        return;
    }
    if (Util.upgradeTips) {
        console.log(Util.upgradeTips);
    }
});

// ===============================================================
const runTask = async function(cmd, argList) {

    // run project task
    Util.command = cmd;

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
        Util.logRed(`Invalid command: ${cmd}`);
        process.exit(1);
    }

    // console.log(Util.root, Util.cliRoot, Util.componentsRoot);

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
    Util.option = list.pop();
    // and let is args, filter undefined if no args
    const args = list.filter((it) => it);

    // console.log(Util.option);
    // console.log(args);

    const cmdStr = [Util.id, cmd].concat(args).join(' ');
    Util.logLine(EC.magenta(`[${cmdStr}]`));
    taskModule.apply(this, args);
};

// ===============================================================
// https://github.com/tj/commander.js
import { program } from 'commander';
import commanderHelp from 'commander-help';

program.version(version, '-v, --version');

// disabled default help
program.helpInformation = function() {
    return '';
};

// custom help
program.on('--help', function() {

    console.log(` Usage: ${program.__dirname} <${EC.cyan('command')}> [options]`);

    commanderHelp(program);

    console.log(` root: ${Util.root}`);
    console.log(` cliRoot: ${Util.cliRoot}`);
    console.log(` nmRoot: ${Util.nmRoot}`);
    console.log(` registry: ${Util.registry}`);

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
        Util.logRed(` unknown command, try: ${Util.id} --help`);
    });

// ===============================================================
program.parse(process.argv);

// last one if no args
if (program.rawArgs.length < 3) {
    program.help();
}
