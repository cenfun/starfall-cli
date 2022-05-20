#!/usr/bin/env node

const path = require('path');
const semver = require('semver');

const Util = require('./core/util.js');
const EC = Util.EC;


// check node version
const nv = process.versions.node;

// check required version
const lowest = '14.15.4';
if (semver.lt(nv, lowest)) {
    Util.logRed(`Current NodeJS is ${nv}, requires version ${lowest} or newer`);
    process.exit(1);
}

// check latest version
const latest = '16.14.2';
if (semver.lt(nv, latest)) {
    Util.logYellow(`Current NodeJS is ${nv}, recommended version available: ${latest}`);
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
const initArgs = function(list) {
    const args = [];
    for (let i = 0, l = list.length; i < l; i++) {
        args.push(list[i]);
    }
    // commander 7, last one is Commander
    args.pop();
    // and option
    Util.option = args.pop();
    // and args
    return args;
};

const runTask = function(cmd, argList) {

    // run project task
    Util.command = cmd;

    const tasks = {
        add: true,
        blame: true,
        build: true,
        clean: true,
        dev: true,
        diff: true,
        format: true,
        init: true,
        install: true,
        kill: true,
        link: true,
        lint: true,
        list: true,
        migrate: true,
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
        return;
    }

    // no need init as component/monorepo project
    const noProjectTasks = {
        blame: true,
        clean: true,
        diff: true,
        format: true,
        init: true,
        kill: true,
        migrate: true
    };

    // init project package.json and components path
    if (!noProjectTasks[cmd] && !Util.initProject()) {
        Util.logRed('Please execute command in your project root.');
        process.exit(1);
        return;
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
        return;
    }

    const args = initArgs(argList);
    // console.log(argList);
    // console.log(Util.option);
    // console.log(args);

    Util.logStart(`${Util.id} ${cmd} ${args.join(' ')}`);
    taskModule.apply(this, args);
};

// ===============================================================
// https://github.com/tj/commander.js
const program = require('commander');

program.version(version, '-v, --version');

// disabled default help
program.helpInformation = function() {
    return '';
};

// custom help
program.on('--help', function() {
    const programName = Util.id;
    console.log(` Usage: ${programName} <${EC.cyan('command')}> [options]`);

    const mapList = function(list) {
        return list.map(function(o) {
            return {
                name: ` ${o.flags}`,
                description: o.description
            };
        });
    };

    const commands = this.commands.filter(function(cmd) {
        return !cmd._noHelp && cmd._name !== '*';
    }).map(function(cmd) {
        const args = cmd._args.map(function(arg) {
            const nameOutput = arg._name + (arg.variadic === true ? '...' : '');
            return arg.required ? `<${nameOutput}>` : `[${nameOutput}]`;
        }).join(' ');
        const argsStr = args ? ` ${args}` : '';
        const name = `${programName} ${EC.cyan(cmd._name)}${argsStr}`;
        const command = {
            name: name,
            alias: EC.cyan(cmd._aliases),
            description: cmd._description
        };
        if (cmd.options.length) {
            command.subs = mapList(cmd.options);
        }
        return command;
    });

    const cliOptions = mapList(this.options);
    cliOptions.push({
        name: ` ${this._helpFlags}`,
        description: this._helpDescription
    });

    const list = [{
        name: programName,
        description: 'cli short name',
        subs: cliOptions
    }].concat(commands);
    
    const rows = [];
    list.forEach((r, i) => {
        rows.push(r);
        if (i !== list.length - 1) {
            rows.push({
                innerBorder: true
            });
        }
    });

    Util.consoleGrid.render({
        option: {
            hideHeaders: false,
            nullPlaceholder: ''
        },
        columns: [{
            id: 'name',
            name: 'Commands and Options'
        }, {
            id: 'description',
            name: 'Description'
        }, {
            id: 'alias',
            name: 'Alias'
        }],
        rows: rows
    });

    console.log(` root: ${Util.root}`);
    console.log(` cliRoot: ${Util.cliRoot}`);
    console.log(` nmRoot: ${Util.nmRoot}`);
    console.log(` registry: ${Util.registry}`);
    
});

// ===============================================================
program
    .command('add [name[,name]]')
    .option('--vue', 'vue component template')
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
    .option('-m, --minify', 'minify file')
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
    .description('clean temporary files')
    .action(function() {
        runTask('clean', arguments);
    });

program
    .command('dev [name]')
    .alias('d')
    .option('-e, --env <env>', 'env for proxy')
    .option('-p, --port <port>', 'port for dev server')
    .option('-m, --minify', 'minify file')
    .description('dev component')
    .action(function() {
        runTask('dev', arguments);
    });

program
    .command('diff [name[,name]]')
    .alias('d')
    .option('-s, --spec <name>', 'module names')
    .option('-a, --ab [v-a,v-b]', 'default version A/B')
    .option('-c, --clean', 'clean workspace')
    .option('-o, --open', 'open report when finished')
    .description('diff with version ab')
    .action(function() {
        runTask('diff', arguments);
    });

program
    .command('format <file>')
    .alias('f')
    .option('-e, --ext', 'file ext')
    .description('format file with js-beautify')
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
    .command('install [name[,name]]')
    .alias('i')
    .option('-d, --dev', 'save to devDependencies')
    .option('-r, --remove', 'remove dependencies')
    .option('-c, --component [name[,name]]', 'install for specified component(s)')
    .option('-f, --force', 'force npm to fetch remote resources')
    .option('-s, --server', 'server folder')
    .description('install and link dependencies')
    .action(function() {
        runTask('install', arguments);
    });

program
    .command('kill <name>')
    .alias('k')
    .description('force kill the process')
    .action(function() {
        runTask('kill', arguments);
    });

program
    .command('link [name] [path]')
    .option('-r, --remove', 'remove link(s)')
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
    .option('-m, --module <name>', 'list a module dependencies')
    .description('list installed packages')
    .action(function() {
        runTask('list', arguments);
    });

program
    .command('migrate <type>')
    .description('migrate scripts')
    .action(function() {
        runTask('migrate', arguments);
    });

program
    .command('outdate')
    .alias('o')
    .option('-u, --update', 'update versions to package.json')
    .description('outdate check')
    .action(function() {
        runTask('outdate', arguments);
    });

program
    .command('pack [name]')
    .option('-m, --minify', 'minify')
    .option('-b, --bundle', 'bundle')
    .option('-q, --query <string>', 'query string')
    .option('-p, --path <path>', 'path of pack')
    .option('-s, --server', 'server folder needed')
    .description('pack a component to zip file')
    .action(function() {
        runTask('pack', arguments);
    });

program
    .command('precommit [n[,n]] [files]')
    .option('-m, --minify', 'minify build')
    .option('-s, --stylelint', 'stylelint verifying')
    .option('-n, --naming', 'naming verifying')
    .option('--cp <num>', 'child process number')
    .description('lint, build and test before commit')
    .action(function() {
        runTask('precommit', arguments);
    });

program
    .command('publish [version]')
    .option('-o, --override', 'allow override version')
    .option('-d, --debug', 'debug without publishing to server')
    .option('-m, --message <message>', 'a message to commit')
    .option('-t, --tag <tag>', 'tag package')
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
