const { EC } = require('flatdep');
const fs = require('fs');
const path = require('path');
const Util = require('../core/util.js');
const helper = require('./pack-helper.js');
// ==============================================================================================

const minifyBundle = async (type, absFilePath) => {
    if (type === '.js') {
        await helper.minifyJs(absFilePath);
    } else if (type === '.css') {
        await helper.minifyCss(absFilePath);
    }
};

// ==============================================================================================

const bundleFile = async (item, file, bundleMap) => {
    Util.log(`append: ${file} ...`);
    const extname = path.extname(file);
    let bundlePath = bundleMap[extname];
    if (!bundlePath) {
        // bundleName is no extname
        bundlePath = path.resolve(item.distPath, item.bundleName + extname);
        // remove first because need appending content
        if (fs.existsSync(bundlePath)) {
            await Util.rm(bundlePath);
        }
        bundleMap[extname] = bundlePath;
    }

    let content = Util.readFileContentSync(file);
    if (!content) {
        Util.logRed(`ERROR: Can NOT read: ${file}`);
        return;
    }
    
    if (extname === '.css') {
        content = await helper.loadCss(file, content);
    }

    fs.appendFileSync(bundlePath, content + Util.getEOL());
    return true;
};

const bundleHandler = async (item, bundleList) => {
    
    Util.log('generating bundle ...');

    const bundleMap = {};
    for (const file of bundleList) {
        const success = await bundleFile(item, file, bundleMap);
        if (!success) {
            return;
        }
    }

    for (const extname in bundleMap) {
        const absFilePath = bundleMap[extname];
        const relFilePath = Util.relativePath(absFilePath);
        if (item.minify) {
            Util.log(`minify bundle: ${relFilePath} ...`);
            await minifyBundle(extname, absFilePath);
        }
        bundleMap[extname] = relFilePath;
    }

    const bundleFiles = Object.values(bundleMap);
    // for file inject order: .css first than .js
    bundleFiles.sort();
     
    if (bundleFiles.length) {
        return bundleFiles;
    }
};

const getBundleInjectFiles = function(bundleFiles, buildFiles, devFiles) {
    let files = [];
    files = files.concat(bundleFiles);
    if (buildFiles) {
        files = files.concat(buildFiles);
    }
    if (devFiles) {
        files = files.concat(devFiles);
    }
    files = files.filter((it) => it);
    return files;
};

const vendorHandler = async (item) => {

    //no extname, for css and js
    item.bundleName = `${item.buildName}.vendor`;

    const bundleList = Util.getInjectFiles(item, true);
    const bundleFiles = await bundleHandler(item, bundleList);
    if (!bundleFiles) {
        return 1;
    }

    //need copy build and dev files to distPath

    item.injectFiles = getBundleInjectFiles(bundleFiles, item.buildFiles, item.devFiles);

    return 0;
};

const allHandler = async (item) => {

    item.bundleName = `${item.buildName}.bundle.js`;

    const bundleList = Util.getInjectFiles(item);
    const bundleFiles = await bundleHandler(item, bundleList);
    if (!bundleFiles) {
        return 1;
    }

    item.injectFiles = getBundleInjectFiles(bundleFiles);

    return 0;
};

const bundleModule = (item) => {

    const bundleType = item.bundle === 'vendor' ? 'vendor' : 'all';
    Util.log(`bundle type: ${EC.cyan(bundleType)}`);
    
    if (bundleType === 'vendor') {
        return vendorHandler(item);
    }

    return allHandler(item);

};

module.exports = bundleModule;
