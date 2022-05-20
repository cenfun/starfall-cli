
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
        console.log(`Not found server folder: ${serverPath}`);
        return 0;
    }

    const packPath = item.packPath;

    // copy package.json and readme
    // only for server metadata
    shelljs.cp('-f', `${item.componentPath}/package.json`, packPath);
    shelljs.cp('-f', `${item.componentPath}/README.md`, packPath);
    console.log('Copied package.json and README.md');

    // copy proxy config for server
    const proxyFile = `${Util.root}/conf.proxy.js`;
    shelljs.cp('-f', proxyFile, packPath);
    console.log(`Copied proxy file: ${proxyFile}`);

    // need install server first
    const serverPackage = `${serverPath}/package.json`;
    if (fs.existsSync(serverPackage)) {
        console.log('Install server node modules ...');
        shelljs.cd(serverPath);
        shelljs.exec('npm install -f');
        shelljs.cd(Util.root);
    }

    //remove package-lock.json
    Util.rmSync(`${serverPath}/package-lock.json`);

    shelljs.cp('-R', serverPath, packPath);
    console.log(`Copied server files: ${serverPath}`);

    //mark has server path
    item.serverPath = serverPath;

    return 0;
};

// ==================================================================================================================

const copyCommonFiles = async (item) => {
    //copy files not dev folder
    shelljs.cp('-R', `${item.devPath}/*`, item.staticPath);
    
    // remove dev src folder
    const devSrc = `${item.staticPath}/src`;
    if (fs.existsSync(devSrc)) {
        await Util.rm(devSrc);
    }
    const buildPath = Util.getConfig('build.path');
    const devDist = `${item.staticPath}/${buildPath}`;
    if (fs.existsSync(devDist)) {
        await Util.rm(devDist);
    }

    console.log(`Copied component common files: ${item.devPath}`);
    return 0;
};

// ==================================================================================================================

const copyDistFiles = (item) => {

    const injectFiles = Util.getInjectFiles(item);

    const buildPath = Util.getConfig('build.path');
    const distPath = `${item.staticPath}/${buildPath}`;
    shelljs.mkdir('-p', distPath);
    console.log(`dist path: ${EC.cyan(distPath)}`);

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
        packInjectFiles.push(`${distPath}/${filename}`);
        
        shelljs.cp('-R', filePath, distPath);
        console.log(`Copied ${Util.relativePath(filePath)}`);

        const mapFile = Util.getMapFile(filePath);
        if (mapFile) {
            console.log(`Copied ${Util.relativePath(mapFile)}`);
            shelljs.cp('-R', mapFile, distPath);
        }

    });

    item.injectFiles = packInjectFiles;

    return code;
};

// ==================================================================================================================

const getStaticPath = (item) => {
    //with server
    if (item.serverPath) {
        const devPath = Util.getConfig('dev.path');
        const staticPath = `${item.packPath}/${devPath}`;
        shelljs.mkdir('-p', staticPath);
        return staticPath;
    }
    //without server
    return item.packPath;
};

const copyStaticFiles = (item) => {

    item.staticPath = getStaticPath(item);

    const tasks = [() => {

        return copyCommonFiles(item);

    }, () => {
        
        //if bundle all or vendor 
        if (Util.option.bundle) {
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
        console.log(`Removed previous pack path: ${packPath}`);
    }
    shelljs.mkdir('-p', packPath);
};

const getPackPath = (item) => {
    // option, config, default to temp
    const packPath = Util.option.path || Util.getConfig('pack.path') || `${Util.getTempRoot()}/pack/${item.name}`;
    return Util.relativePath(path.resolve(packPath));
};

const packHandler = async (item) => {

    //check devPath first
    if (!fs.existsSync(item.devPath)) {
        Util.logRed(`ERROR: Not found component dev path: ${item.devPath}`);
        return 1;
    }

    const packPath = getPackPath(item);
    await cleanPackPath(packPath);

    item.packPath = packPath;
    console.log(`pack path: ${EC.cyan(packPath)}`);

    const tasks = [() => {
        //handler server first
        return copyServerFiles(item);
    }, () => {
        return copyStaticFiles(item);
    }, () => {
        return packZip(item);
    }];

    return Util.tasksResolver(tasks);

};


module.exports = packHandler;
