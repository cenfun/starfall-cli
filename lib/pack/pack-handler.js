
const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const archiver = require('archiver');
const Util = require('../core/util.js');
const injectFiles = require('../inject/inject.js');
const packBundle = require('./pack-bundle.js');
const packZip = require('./pack-zip.js');


const copyServerFiles = (item) => {

    const serverPath = `${Util.root}/server`;
    if (!fs.existsSync(serverPath)) {
        console.log('No server folder to copy');
        return 0;
    }

    const packPath = item.packPath;

    // copy proxy config for server
    console.log('Copy conf.proxy.js ... ');
    shelljs.cp('-f', `${Util.root}/conf.proxy.js`, packPath);

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

    console.log('Copy server files ...');
    shelljs.cp('-R', serverPath, packPath);

    return 0;
};

// ==================================================================================================================

const copyDevFiles = async (item, fromPath, devPath, publicPath) => {
    console.log('Copy component dev files ...');
    shelljs.cp('-R', `${fromPath}/${devPath}`, publicPath);

    // remove dev src folder
    const devSrc = `${publicPath}/src`;
    if (fs.existsSync(devSrc)) {
        await Util.rm(devSrc);
    }
};

// ==================================================================================================================

const copyDependencies = (item, publicPath) => {

    if (item.bundle) {
        return;
    }

    console.log('Copy dependencies from node_modules ...');
    // console.log(d);

    item.dependencies.files.forEach(function(filePath) {

        const fileFrom = `${Util.root}/${filePath}`;
        console.log(`copy from: ${Util.relativePath(fileFrom)}`);

        const fileTo = path.dirname(`${publicPath}/${filePath}`);
        shelljs.mkdir('-p', fileTo);
        console.log(`to: ${Util.relativePath(fileTo)}`);

        shelljs.cp('-R', fileFrom, fileTo);

        const mapFile = Util.getMapFile(fileFrom);
        if (mapFile) {
            console.log(`copy map file: ${Util.relativePath(mapFile)}`);
            shelljs.cp('-R', mapFile, fileTo);
        }

    });

    // //update dependencies files to new pack path
    item.dependencies.files = item.dependencies.files.map((f) => {
        return Util.relativePath(`${publicPath}/${f}`);
    });

};

// ==================================================================================================================

const copyBuildFiles = (item, fromPath, buildPath, publicPath) => {
    console.log('Copy component build files ...');
    shelljs.cp('-R', `${fromPath}/${buildPath}`, publicPath);
};

// ==================================================================================================================

const updateBuildFilePath = function(item, key, fromPath, toPath) {
    const list = item[key];
    if (!list) {
        return;
    }
    item[key] = list.map((f) => {
        // relative from old path
        const rel = Util.relativePath(f, fromPath);
        // to new path and relative from root
        return Util.relativePath(`${toPath}/${rel}`);
    });
};


const cleanAssertFiles = (files) => {
    if (!files) {
        return;
    }
    files.forEach((f) => {
        removeFileAndMap(f);
    });
};

const buildBundleFilesHandler = async (item) => {

    // no extname
    const bundleName = `${item.buildName}.bundle`;

    const filename = `${bundleName}.js`;
    cleanJsAndCssFiles(path.resolve(item.buildPath, filename));
    
    if (!item.bundle) {
        return 0;
    }

    item.bundleName = bundleName;

    // bundle from files
    let bundleList = [].concat(item.dependencies.files);
    bundleList = bundleList.concat(item.buildFiles);
    if (item.devFiles) {
        bundleList = bundleList.concat(item.devFiles);
    }

    // return a list may includes 2 files for js and css
    const bundleFiles = await buildBundle(item, bundleList);
    if (!bundleFiles) {
        return 1;
    }

    // remove build files if has bundleFiles
    cleanAssertFiles(item.buildFiles);
    cleanAssertFiles(item.devFiles);

    item.bundleFiles = bundleFiles;
    Util.logWorker(`finish: ${bundleFiles.join(', ')}`);
    
    return 0;
};

// ==================================================================================================================

const cleanPackPath = async (packPath) => {
    if (fs.existsSync(packPath)) {
        await Util.rm(packPath);
        console.log(`removed previous pack path: ${packPath}`);
    }
    shelljs.mkdir('-p', packPath);
};

const getPackPath = (item) => {
    // option, config, default to temp
    const packPath = Util.option.path || Util.getConfig('pack.path') || `${Util.getTempRoot()}/pack/${item.name}`;
    return Util.relativePath(path.resolve(packPath));
};

const packHandler = async (item) => {

    console.log(item);
    const packPath = getPackPath(item);
    await cleanPackPath(packPath);

    console.log(`pack path: ${packPath}`);

    item.packPath = packPath;

    //const bundle = Util.option.bundle;
    //const query = Util.option.query;

    // new item for new pack path
    //const fromPath = Util.getComponentPath(componentName);
    
    // const packPath = await initPackPath(componentName);
    // const buildPath = Util.getConfig('build.path');
    //const devPath = Util.getConfig('dev.path');

    // need end of / for file next
    //const publicPath = `${packPath}/`;

    // ====================================================================================
    // copy dev folder files
    // await copyDevFiles(item, fromPath, devPath, publicPath);

    // // ====================================================================================
    // // copy dependencies in node_modules
    // await copyDependencies(item, publicPath);

    // // ====================================================================================
    // // copy build files
    // await copyBuildFiles(item, fromPath, buildPath, publicPath);
   
    // // ====================================================================================

    // // update path to new pack path
    // item.componentPath = publicPath;
    // item.devPath = publicPath;
 
    // // only for pack
    // item.query = Util.option.query;
    // // update new copied files path to root
    // updateBuildFilePath(item, 'devFiles', `${fromPath}/${devPath}`, publicPath);
    // updateBuildFilePath(item, 'buildFiles', fromPath, publicPath);
    // updateBuildFilePath(item, 'bundleFiles', fromPath, publicPath);

    // // inject again for pack path
    // await injectFiles(item);


    // // ====================================================================================

    const tasks = [() => {
        return 0;
    }, () => {
        return copyServerFiles(item);
    }, () => {
        return packZip(item);
    }];

    return Util.tasksResolver(tasks);

};


module.exports = packHandler;
