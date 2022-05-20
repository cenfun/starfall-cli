
const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const EC = require('eight-colors');
const Util = require('../core/util.js');
const injectFiles = require('../inject/inject.js');
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

const copyDevFiles = async (item) => {
    //copy files not dev folder
    shelljs.cp('-R', `${item.devPath}/*`, item.staticPath);
    console.log(`Copied component dev files: ${item.devPath}`);

    // remove dev src folder
    const devSrc = `${item.staticPath}/src`;
    if (fs.existsSync(devSrc)) {
        await Util.rm(devSrc);
        console.log(`Removed component dev src: ${devSrc}`);
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

const copyStaticFiles = async (item) => {

    item.staticPath = getStaticPath(item);
    
    // ====================================================================================
    // copy dev folder files
    await copyDevFiles(item);

    //console.log(item);
     
    //const bundle = Util.option.bundle;
    //const query = Util.option.query;

    // new item for new pack path
    //const fromPath = Util.getComponentPath(componentName);
    
    // const packPath = await initPackPath(componentName);
    // const buildPath = Util.getConfig('build.path');


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

    return 0;
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
