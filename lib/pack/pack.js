const fs = require("fs");
const path = require("path");
const shelljs = require("shelljs");
const archiver = require("archiver");
const injectFiles = require("../inject/inject.js");
const build = require("../build/build.js");
const Util = require("../core/util.js");

const packFiles = (item) => {
    return new Promise(resolve => {

        const timeTag = Util.dateFormat(new Date(), "yyMMdd");

        const pc = Util.getProjectConf();
        const fileName = `${pc.name}.${pc.version}.${timeTag}`;
       
        const outputPath = `${Util.getTempRoot()}/pack/${fileName}.zip`;
        if (fs.existsSync(outputPath)) {
            Util.rmSync(outputPath);
        }

        const output = fs.createWriteStream(outputPath);
        console.log(`Create output file: ${Util.relativePath(outputPath)}`);

        output.on("close", function() {
            console.log(`file size: ${archive.pointer()} bytes`);
            Util.logGreen(`packed ${outputPath}`);
            resolve(0);
        });
        output.on("end", function() {
            console.log("Data has been drained");
        });

        console.log("Start pack files ... ");
        const archive = archiver("zip", {
            zlib: {
                level: 9
            }
        });
        archive.on("error", function(err) {
            console.log(err);
            resolve(1);
        });
        archive.on("warning", function(err) {
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
        console.log("No server folder to copy");
        return;
    }

    //copy proxy config for server
    console.log("Copy conf.proxy.js ... ");
    shelljs.cp("-f", `${Util.root}/conf.proxy.js`, packPath);

    shelljs.cd(serverPath);
    if (fs.existsSync(`${serverPath}/package.json`)) {
        console.log("Install node modules for server ...");
        shelljs.exec("npm install");
    }

    console.log("Copy server files ...");
    shelljs.cp("-R", serverPath, packPath);

};

const copyStaticFiles = (item) => {
    console.log("Copy static files (fonts or svg) ... ");

    const staticFiles = Util.getSetting("staticFiles");

    staticFiles.forEach(function(filePath) {

        //do not copy from node_modules if bundle
        if (item.bundle && filePath.indexOf("node_modules") !== -1) {
            return;
        }

        const fileFrom = `${Util.root}/${filePath}`;
        console.log(`copy from: ${Util.relativePath(fileFrom)}`);

        let fileTo = path.dirname(`${item.componentPath}/${filePath}`);
        fileTo = fileTo.replace(/\/\*+/, "");
        shelljs.mkdir("-p", fileTo);
        console.log(`to: ${Util.relativePath(fileTo)}`);

        shelljs.cp("-R", fileFrom, fileTo);

    });
};

//==================================================================================================================

const copyPreviewFiles = async (item, fromPath, previewPath, publicPath) => {
    console.log("Copy component preview files ...");
    shelljs.cp("-R", `${fromPath}/${previewPath}`, publicPath);

    //remove preview src folder
    const previewSrc = `${publicPath}/src`;
    if (fs.existsSync(previewSrc)) {
        await Util.rm(previewSrc);
    }
};

//==================================================================================================================

const copyDependencies = (item, publicPath) => {

    if (item.bundle) {
        return;
    }

    console.log("Copy dependencies from node_modules ...");
    //console.log(d);

    item.dependencies.files.forEach(function(filePath) {

        const fileFrom = `${Util.root}/${filePath}`;
        console.log(`copy from: ${Util.relativePath(fileFrom)}`);

        const fileTo = path.dirname(`${publicPath}/${filePath}`);
        shelljs.mkdir("-p", fileTo);
        console.log(`to: ${Util.relativePath(fileTo)}`);

        shelljs.cp("-R", fileFrom, fileTo);

        const mapFile = Util.getMapFile(fileFrom);
        if (mapFile) {
            console.log(`copy map file: ${Util.relativePath(mapFile)}`);
            shelljs.cp("-R", mapFile, fileTo);
        }

    });

    // //update dependencies files to new pack path
    item.dependencies.files = item.dependencies.files.map(f => {
        return Util.relativePath(`${publicPath}/${f}`);
    });

};

//==================================================================================================================

const copyBuildFiles = (item, fromPath, buildPath, publicPath) => {
    console.log("Copy component build files ...");
    shelljs.cp("-R", `${fromPath}/${buildPath}`, publicPath);
};

//==================================================================================================================

const updateBuildFilePath = function(item, f, fromPath) {
    const relPath = Util.relativePath(f, fromPath);
    return Util.relativePath(`${item.componentPath}/${relPath}`);
};

const updatePathForInject = (item, fromPath, previewPath, publicPath) => {
    //update path to new pack path
    item.componentPath = publicPath;
    item.previewPath = publicPath;
  
    //only for pack
    item.query = Util.option.query;
    //update build folder files path
    if (item.bundleFiles) {
        item.bundleFiles = item.bundleFiles.map(f => {
            return updateBuildFilePath(item, f, fromPath);
        });
    }
    if (item.buildFiles) {
        item.buildFiles = item.buildFiles.map(f => {
            return updateBuildFilePath(item, f, fromPath);
        });
    }
    if (item.previewFiles) {
        item.previewFiles = item.previewFiles.map(f => {
            return updateBuildFilePath(item, f, `${fromPath}/${previewPath}`);
        });
    }
};

//==================================================================================================================

const initPackPath = async (componentName) => {
    //init pack folder
    const packPath = path.resolve(`${Util.getTempRoot()}/pack/${componentName}`);
    if (fs.existsSync(packPath)) {
        console.log("remove previous pack folder ...");
        await Util.rm(packPath);
    }
    shelljs.mkdir("-p", packPath);
    return packPath;
};

const packComponent = async (componentName) => {

    console.log("pack component: ", componentName);

    //always build first
    const item = await build.buildComponent(componentName);
    if (!item) {
        return 1;
    }

    await Util.runHook("beforePack", item.name, item);

    //====================================================================================
    //new item for new pack path
    const fromPath = Util.getComponentPath(item.name);
    
    const packPath = await initPackPath(componentName);
    const buildPath = Util.getSetting("buildPath");
    const previewPath = Util.getSetting("previewPath");

    let publicPath = Util.getSetting("publicPath");
    publicPath = `${packPath}/${publicPath}`;

    //====================================================================================
    //copy preview folder files
    await copyPreviewFiles(item, fromPath, previewPath, publicPath);

    //====================================================================================
    //copy dependencies in node_modules
    await copyDependencies(item, publicPath);

    //====================================================================================
    //copy build files
    await copyBuildFiles(item, fromPath, buildPath, publicPath);
   
    //====================================================================================

    await updatePathForInject(item, fromPath, previewPath, publicPath);
    //inject again for pack path
    await injectFiles(item);

    //====================================================================================
    //copy static files like fonts or images
    await copyStaticFiles(item);

    //====================================================================================
    //server files
    //install and copy server 
    await copyServerFiles(packPath);

    //====================================================================================

    await Util.runHook("afterPack", item.name, item);

    //zip folder
    return packFiles(item);
};

const packModule = async (componentName) => {

    //custom pack handler
    const packHandler = Util.getSetting("pack");
    if (packHandler && !componentName) {
        const packCode = await packHandler.call(this, Util);
        process.exit(packCode);
        return;
    }

    const list = Util.getCurrentComponentList(componentName);
    //pack only one
    const name = list.shift();
    if (!name) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    const exitCode = await packComponent(name);
    //always exit no matter exit code is 0
    process.exit(exitCode);

};

module.exports = packModule;
