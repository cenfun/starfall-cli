const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const Util = require('../core/util.js');
const updateModule = require('./update.js');
const linkModule = require('../link/link.js');
const listModule = require('../list/list.js');

const installServer = async () => {
    if (!Util.option.server) {
        return;
    }

    const serverPath = path.resolve(Util.root, 'server');
    if (!fs.existsSync(serverPath)) {
        console.log('Not found server folder');
        return;
    }

    const packagePath = path.resolve(serverPath, 'package.json');
    if (!fs.existsSync(packagePath)) {
        console.log('Not found server package.json');
        return;
    }

    // remove lock file
    const lockPath = path.resolve(serverPath, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
        console.log('remove server package-lock.json ...');
        await Util.rm(lockPath);
    }

    console.log('Install node modules for server ...');
    shelljs.cd(serverPath);
    shelljs.exec('npm install');
    shelljs.cd(Util.root);
};


const removeLink = () => {
    const list = Util.getComponentList();
    list.forEach((name) => {
        const modulePath = Util.getComponentPath(name);
        linkModule.removeLink(modulePath);
    });
};


const installModule = async () => {

    // init path
    shelljs.cd(Util.root);

    // remove lock file
    const lockFile = 'package-lock.json';
    if (Util.nmRoot !== Util.root && fs.existsSync(lockFile)) {
        await Util.rm(lockFile);
        console.log(`Removed ${lockFile}`);
    }

    // install existing dependencies
    // copy hooks for pre-commit
    console.log('init git hooks ...');
    Util.initGitHooks();

    console.log('install dependencies and link internal dependencies ...');

    await updateModule();

    // remove all link before install, stop install node_modules to internal component folder
    removeLink();

    let force = '';
    if (Util.option.force) {
        force = ' --force';
    }
    const cmd = `npm install --timing${force}`;
    console.log(`${cmd} ...`);

    const sh = shelljs.exec(cmd);
    if (sh.code) {
        process.exit(sh.code);
    }

    linkModule();

    await installServer();

    Util.option.sort = 'mSize';
    await listModule();

    Util.logEnd('finish install');

};

module.exports = installModule;
