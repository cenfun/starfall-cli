
const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const EC = require('eight-colors');
const Util = require('../core/util.js');
const injectHandler = require('../inject/inject.js');
const packBundle = require('./pack-bundle.js');
const packZip = require('./pack-zip.js');

const copyServerFiles = (item) => {

    //no need server default
    if (!Util.option.server) {
        return 0;
    }

    //need server but no server folder
    const serverPath = `${Util.root}/server`;
    if (!fs.existsSync(serverPath)) {
        Util.log(`Not found server folder: ${serverPath}`);
        return 0;
    }

    const packPath = item.packPath;

    // copy package.json and readme
    // only for server metadata
    shelljs.cp('-f', `${item.componentPath}/package.json`, packPath);
    shelljs.cp('-f', `${item.componentPath}/README.md`, packPath);
    Util.log('Copied package.json and README.md');

    // copy proxy config for server
    const proxyFile = `${Util.root}/conf.proxy.js`;
    shelljs.cp('-f', proxyFile, packPath);
    Util.log(`Copied proxy file: ${proxyFile}`);

    // need install server first
    const serverPackage = `${serverPath}/package.json`;
    if (fs.existsSync(serverPackage)) {
        Util.log('Install server node modules ...');
        shelljs.cd(serverPath);
        shelljs.exec('npm install -f');
        shelljs.cd(Util.root);
    }

    //remove package-lock.json
    Util.rmSync(`${serverPath}/package-lock.json`);

    shelljs.cp('-R', serverPath, packPath);
    Util.log(`Copied server files: ${serverPath}`);

    //mark has server path
    item.serverPath = serverPath;

    return 0;
};

// ==================================================================================================================

const copyCommonFiles = (item) => {
    //copy files not dev folder
    shelljs.cp('-R', `${item.devPath}/*`, item.staticPath);

    Util.log(`Copied component common files: ${item.devPath}`);

    return 0;
};

// ==================================================================================================================

const copyDistFiles = (item) => {

    const injectFiles = Util.getInjectFiles(item);

    //update to new path for all inject files
    const packInjectFiles = [];

    const nameMap = {};
    let code = 0;

    injectFiles.forEach(function(filePath) {

        //filename must be unique
        //but we can't change the file name, because the map file name will be mismatched
        const filename = path.basename(filePath);
        if (nameMap[filename]) {
            EC.logRed(`ERROR: Duplicate package name found: "${nameMap[filename]}" conflict with "${filePath}"`);
            code = 1;
            return;
        }
        nameMap[filename] = filePath;
        //using abs path
        packInjectFiles.push(`${item.distPath}/${filename}`);

        Util.copyFileAndMap(filePath, item.distPath);

    });

    item.injectFiles = packInjectFiles;

    return code;
};

// ==================================================================================================================

const getStaticPath = (item) => {
    //without server
    let staticPath = item.packPath;
    //with server
    if (item.serverPath) {
        const devPath = Util.getConfig('dev.path');
        staticPath = `${item.packPath}/${devPath}`;
        shelljs.mkdir('-p', staticPath);
    }
    Util.log(`static path: ${EC.cyan(staticPath)}`);
    return staticPath;
};

const getDistPath = (item) => {
    const buildPath = Util.getConfig('build.path');
    const distPath = `${item.staticPath}/${buildPath}`;
    shelljs.mkdir('-p', distPath);
    Util.log(`dist path: ${EC.cyan(distPath)}`);
    return distPath;
};


const copyStaticFiles = (item) => {

    item.staticPath = getStaticPath(item);

    const tasks = [() => {

        //will remove dist/src path
        return copyCommonFiles(item);

    }, () => {

        //after common files done
        item.distPath = getDistPath(item);
        item.bundle = Util.option.bundle;

        //if bundle all or vendor
        if (item.bundle) {
            return packBundle(item);
        }

        return copyDistFiles(item);

    }, () => {

        //update devPath from inject
        item.query = Util.option.query;
        item.devPath = item.staticPath;

        return injectHandler(item);
    }];

    return Util.tasksResolver(tasks);

};

// ==================================================================================================================

const cleanPackPath = async (packPath) => {
    if (fs.existsSync(packPath)) {
        await Util.rm(packPath);
        Util.log(`Removed previous pack path: ${packPath}`);
    }
    shelljs.mkdir('-p', packPath);
};

const getPackPath = (item) => {
    // option, config, default to temp
    const packPath = Util.option.output || Util.getConfig('pack.output') || `${Util.getTempRoot()}/pack/${item.name}`;
    return Util.relativePath(path.resolve(packPath));
};

const packHandler = async (item) => {

    //after build the jobName will be changed to inject
    Util.jobName = 'pack';
    Util.componentName = item.name;

    //check devPath first
    if (!fs.existsSync(item.devPath)) {
        Util.logRed(`ERROR: Not found component dev path: ${item.devPath}`);
        return 1;
    }

    const packPath = getPackPath(item);
    await cleanPackPath(packPath);

    item.packPath = packPath;
    Util.log(`output path: ${EC.cyan(packPath)}`);

    const tasks = [() => {
        //handler server first
        return copyServerFiles(item);
    }, () => {
        return copyStaticFiles(item);
    }, () => {

        //reset back from inject
        Util.jobName = 'pack';

        return packZip(item);
    }];

    return Util.tasksResolver(tasks);

};


module.exports = packHandler;
