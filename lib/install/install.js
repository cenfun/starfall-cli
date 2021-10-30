const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const Util = require('../core/util.js');
const updateModule = require('./update.js');
const linkModule = require('../link/link.js');
const listModule = require('../list/list.js');


const saveComponentDependencies = (modules, list, fromModules, key) => {

    if (!list.length || !modules.length) {
        return;
    }

    list.forEach((componentName) => {
        const componentConf = Util.getComponentConf(componentName, true);
        const fullName = Util.getComponentFullName(componentName);
        let dependencies = componentConf[key];
        if (!dependencies) {
            dependencies = {};
            componentConf[key] = dependencies;
        }
        modules.forEach((moduleName) => {
            //remove version like jquery@2.0.3
            if (moduleName.indexOf('@') > 0) {
                moduleName = moduleName.split('@')[0];
            }

            if (Util.option.remove) {
                delete dependencies[moduleName];
            } else {
                //console.log(moduleName, fullName, key);
                if (moduleName !== fullName) {
                    dependencies[moduleName] = fromModules[moduleName] || '';
                }
            }
        });
        dependencies = Util.getAscKeyObject(dependencies);
        componentConf[key] = dependencies;
        //console.log(componentConf);
        Util.saveComponentConf(componentName, componentConf);
    });
};


const updateInternalModules = (internalModules) => {

    if (!internalModules.length) {
        return 0;
    }

    internalModules.forEach((item) => {
        const itemPath = Util.getComponentPath(item);
        linkModule(itemPath);
    });

    return 0;
};

const updateExternalModules = (externalModules, saveDev) => {

    if (!externalModules.length) {
        return 0;
    }

    const names = externalModules.join(' ');
    let cmd = `npm install ${saveDev}${names}`;
    if (Util.option.remove) {
        cmd = `npm uninstall ${saveDev}${names}`;
    }

    console.log(`${cmd} ...`);
    const sh = shelljs.exec(cmd);
    if (sh.code) {
        return sh.code;
    }

    return 0;
};

const updateDependencies = async (modules, list) => {

    let key = 'dependencies';
    let saveDev = '';
    if (Util.option.dev) {
        key = 'devDependencies';
        saveDev = '--save-dev ';
    }

    const internalModules = [];
    const externalModules = [];

    const allComponents = {};
    Util.getComponentList().forEach(item => {
        allComponents[item] = true;
        const shortName = Util.getComponentFolderName(item);
        if (shortName) {
            allComponents[shortName] = true;
        }
    });

    modules.forEach((m) => {
        if (!m) {
            return;
        }
        if (allComponents[m]) {
            internalModules.push(m);
        } else {
            externalModules.push(m);
        }
    });

    await updateInternalModules(internalModules);

    //run npm install/uninstall
    const exitCode = await updateExternalModules(externalModules, saveDev);
    if (exitCode) {
        process.exit(exitCode);
        return;
    }

    //save internal modules
    saveComponentDependencies(internalModules, list, {}, key);

    //save external modules
    const pc = Util.getProjectConf(true);
    const projectModules = pc[key];
    saveComponentDependencies(externalModules, list, projectModules, key);

    //always link again, because link will be removed after npm install
    linkModule();

};

const installNewModules = (ids) => {
    //dependent modules
    const modules = (`${ids}`).split(',');
    //component list
    let list = [];
    let componentName = Util.option.component;
    //except all case
    if (componentName) {
        //not specified name means all 
        if (componentName === true) {
            componentName = '';
        }
        list = Util.getCurrentComponentList(componentName);
    }

    //if dev not need update to components, dev only belongs to project dev dependencies
    //or require target component list
    if (!Util.option.dev && !list.length) {
        Util.logRed(`ERROR: Require target component(s): ${Util.id} install ${ids} -c [component]`);
        return;
    }

    return updateDependencies(modules, list);
};

const resolutionsHandler = (pc) => {
    if (!pc.resolutions) {
        return;
    }

    const list = Object.keys(pc.resolutions);
    if (!list.length) {
        return;
    }
    console.log('Found resolutions:');
    console.log(pc.resolutions);

    Util.forEachModule(Util.root, function(moduleName, modulePath, nested) {
        if (!nested) {
            return;
        }
        list.forEach(function(item) {
            if (moduleName === item) {
                Util.rmSync(modulePath);
                console.log(`removed nested module for resolutions: ${Util.relativePath(modulePath)}`);
            }
        });
    });

};

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

    //remove lock file
    const lockPath = path.resolve(serverPath, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
        await Util.rm(lockPath);
    }

    console.log('Install node modules for server ...');
    shelljs.cd(serverPath);
    shelljs.exec('npm install');
    shelljs.cd(Util.root);
};

const installAll = async () => {
    //copy hooks for precommit
    Util.initGitHooks();

    Util.logStart('install dependencies and link internal dependencies ...');
    
    const pc = updateModule();

    //remove all lin before install, stop install node_modules to internal component folder
    Util.option.remove = true;
    linkModule();

    let force = '';
    if (Util.option.force) {
        force = ' --force';
    }
    const cmd = `npm install --timing${force}`;
    console.log(`${cmd} ...`);
    
    const sh = shelljs.exec(cmd);
    if (sh.code) {
        process.exit(sh.code);
        return;
    }

    resolutionsHandler(pc);

    //link internal component
    Util.option.remove = false;
    linkModule();

    await installServer();

    Util.option.sort = 'mSize';
    await listModule();

    Util.logGreen('finish install');
};

const installModule = async (ids) => {

    //init path
    shelljs.cd(Util.root);

    //remove lock file
    if (Util.nmRoot !== Util.root) {
        console.log('remove package-lock.json ...');
        await Util.rm('package-lock.json');
    }

    //install modules to component or project dev dependencies
    if (ids) {
        return installNewModules(ids);
    }

    //install existing dependencies 
    return installAll();
};

module.exports = installModule;
