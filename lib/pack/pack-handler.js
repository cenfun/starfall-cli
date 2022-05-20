
const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const archiver = require('archiver');
const Util = require('../core/util.js');
const injectFiles = require('../inject/inject.js');
const packBundle = require('./pack-bundle.js');


const generateZipFile = (item) => {
    return new Promise((resolve) => {

        const timeTag = Util.dateFormat(new Date(), 'yyMMdd');

        const pc = Util.getProjectConf();
        const fileName = `${pc.name}.${pc.version}.${timeTag}`;
       
        const outputPath = `${Util.getTempRoot()}/pack/${fileName}.zip`;
        if (fs.existsSync(outputPath)) {
            Util.rmSync(outputPath);
        }

        const output = fs.createWriteStream(outputPath);
        console.log(`Create output file: ${Util.relativePath(outputPath)}`);

        output.on('close', function() {
            console.log(`file size: ${archive.pointer()} bytes`);
            Util.logGreen(`packed ${outputPath}`);
            resolve(0);
        });
        output.on('end', function() {
            console.log('Data has been drained');
        });

        console.log('Start pack files ... ');
        const archive = archiver('zip', {
            zlib: {
                level: 9
            }
        });
        archive.on('error', function(err) {
            console.log(err);
            resolve(1);
        });
        archive.on('warning', function(err) {
            console.log(err);
        });

        archive.pipe(output);
        archive.directory(item.componentPath, false);
        archive.finalize();

    });
};

const copyServerFiles = (packPath) => {

    const serverPath = `${Util.root}/server`;
    if (!fs.existsSync(serverPath)) {
        console.log('No server folder to copy');
        return;
    }

    // copy proxy config for server
    console.log('Copy conf.proxy.js ... ');
    shelljs.cp('-f', `${Util.root}/conf.proxy.js`, packPath);

    shelljs.cd(serverPath);
    if (fs.existsSync(`${serverPath}/package.json`)) {
        console.log('Install node modules for server ...');
        shelljs.exec('npm install');
    }

    console.log('Copy server files ...');
    shelljs.cp('-R', serverPath, packPath);

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
    const bundleName = `${item.outputName}.bundle`;

    const filename = `${bundleName}.js`;
    cleanJsAndCssFiles(path.resolve(item.outputPath, filename));
    
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

const initOutputPath = async (outputPath) => {
    // init pack folder
    if (fs.existsSync(outputPath)) {
        await Util.rm(outputPath);
        console.log(`removed previous pack folder ${outputPath}`);
    }
    shelljs.mkdir('-p', outputPath);
};

const getOutputPath = (item) => {
    // option, config, default to temp
    const packPath = Util.option.output || Util.getConfig('pack.output') || `${Util.getTempRoot()}/pack/${item.name}`;
    return Util.relativePath(path.resolve(packPath));
};

const packHandler = async (item) => {

    console.log(item);
    const outputPath = getOutputPath(item);
    await initOutputPath(outputPath);

    console.log(`pack output: ${outputPath}`);

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
    // // server files
    // // install and copy server 
    // await copyServerFiles(packPath);

    // // ====================================================================================

    const tasks = [() => {
        return 0;
    }, () => {
        return 0;
    }, () => {
        return generateZipFile(item);
    }];

    return Util.tasksResolver(tasks);

};


module.exports = packHandler;
