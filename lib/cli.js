#!/usr/bin/env node

const path = require('path');
const semver = require('semver');

const Util = require('./core/util.js');
const EC = Util.EC;


// check node version
const nv = process.versions.node;

// check required version
const lowest = '16.17.0';
if (semver.lt(nv, lowest)) {
    Util.logRed(`You are running Node.js ${nv}, requires version ${lowest} or higher`);
    process.exit(1);
}

// check recommended version
const recommended = '20.9.0';
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
const upgrade = require('./core/upgrade.js');
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
const runTask = function(cmd, argList) {

    // run project task
    Util.command = cmd;

    const tasks = {
        add: true,
        blame: true,
        build: true,
        clean: true,
        dev: true,
        esbuild: true,
        format: true,
        init: true,
        install: true,
        link: true,
        lint: true,
        list: true,
        outdate: true,
        pack: true,
        precommit: true,
        publish: true,
        sonar: true,
        start: true,
        test: true,
        version: true
    };
    const task = tasks[cmd];
    if (!task) {
        Util.logRed(`Invalid command: ${cmd}`);
        process.exit(1);
    }

    // no need init as component/monorepo project
    const noProjectTasks = {
        blame: true,
        clean: true,
        format: true,
        init: true
    };

    // init project package.json and components path
    if (!noProjectTasks[cmd] && !Util.initProject()) {
        Util.logRed('Please execute command in your project root.');
        process.exit(1);
    }

    // console.log(Util.root, Util.cliRoot, Util.componentsRoot);

    let taskModule = null;
    try {
        taskModule = require(`./${cmd}/${cmd}.js`);
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
const { program } = require('commander');
const commanderHelp = require('commander-help');

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
    .command('add [name[,name]]')
    .description('add new components')
    .action(function() {
        runTask('add', arguments);
    });

program
    .command('blame')
    .option('-o, --open', 'open report when finished')
    .option('--cp <num>', 'child process number')
    .description('git blame')
    .action(function() {
        runTask('blame', arguments);
    });

program
    .command('build [name[,name]]')
    .alias('b')
    .option('-p, --production', 'production mode')
    .option('-e, --esm', 'es module mode')
    .option('-o, --open', 'open report when finished')
    .option('--cp <num>', 'child process number')
    .description('build components')
    .action(function() {
        runTask('build', arguments);
    });

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
    .command('dev [name]')
    .alias('d')
    .option('-e, --env <env>', 'env for proxy')
    .option('-p, --production', 'production mode')
    .option('-s, --ssl', 'create https for localhost')
    .option('-w, --watch <path>', 'watch additional path')
    .option('--silent', 'no browser startup')
    .description('dev component')
    .action(function() {
        runTask('dev', arguments);
    });

program
    .command('esbuild [name[,name]]')
    .alias('e')
    .option('-p, --production', 'production mode')
    .option('-e, --esm', 'es module mode')
    .description('esbuild components')
    .action(function() {
        runTask('esbuild', arguments);
    });

program
    .command('format <target>')
    .option('-t, --type', 'eslint or stylelint')
    .description('format file(s)')
    .action(function() {
        runTask('format', arguments);
    });

program
    .command('init')
    .option('-f, --force', 'force init without question')
    .option('--vue', 'vue component template')
    .description('init project')
    .action(function() {
        runTask('init', arguments);
    });

program
    .command('install')
    .alias('i')
    .option('-f, --force', 'force npm to fetch remote resources')
    .option('-s, --server', 'server folder')
    .description('install and link dependencies')
    .action(function() {
        runTask('install', arguments);
    });

program
    .command('link [path] [name]')
    .option('-r, --remove', 'remove link(s)')
    .option('-f, --force', 'force replace exists link')
    .description('link internal components or modules')
    .action(function() {
        runTask('link', arguments);
    });

program
    .command('lint [name[,name]]')
    .alias('l')
    .option('-s, --stylelint', 'stylelint verifying')
    .option('-n, --naming', 'naming verifying')
    .option('--cp <num>', 'child process number')
    .description('lint components')
    .action(function() {
        runTask('lint', arguments);
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
    .command('pack [name]')
    .option('-m, --map', 'with *.map file')
    .option('-q, --query <string>', 'query string')
    .option('-o, --output <path>', 'output path')
    .option('-c, --clean', 'clean previous output')
    .option('-s, --server', 'server folder needed')
    .description('pack a component to zip file')
    .action(function() {
        runTask('pack', arguments);
    });

program
    .command('precommit [n[,n]] [files]')
    .option('-p, --production', 'production mode')
    .option('-s, --stylelint', 'stylelint verifying')
    .option('-n, --naming', 'naming verifying')
    .option('--cp <num>', 'child process number')
    .description('lint, build and test before commit')
    .action(function() {
        runTask('precommit', arguments);
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
    .command('sonar')
    .description('update sonar properties')
    .action(function() {
        runTask('sonar', arguments);
    });

program
    .command('start [port]')
    .alias('s')
    .description('start and open GUI page')
    .action(function() {
        runTask('start', arguments);
    });

program
    .command('test [name[,name]]')
    .alias('t')
    .option('-s, --spec <file>', 'test a single spec file')
    .option('-b, --browser <type>', 'chromium, firefox or webkit')
    .option('-d, --debug [slowMo]', 'debug mode')
    .option('--cp <num>', 'child process number')
    .description('test components')
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
