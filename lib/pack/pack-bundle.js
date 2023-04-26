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

    let content = Util.readFileSync(file);
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
        if (item.production) {
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

const vendorHandler = async (item) => {

    // no extname, for css and js
    item.bundleName = `${item.buildName}.vendor`;

    // only dependencies files
    const bundleList = Util.getComponentFiles(item.dependencies.files);
    const bundleFiles = await bundleHandler(item, bundleList);
    if (!bundleFiles) {
        return 1;
    }

    // copy build files to distPath
    const componentFiles = Util.getComponentFiles(item.buildFiles);
    componentFiles.forEach(function(filePath) {
        // console.log(filePath);
        const filename = path.basename(filePath);
        // update new abs path
        bundleFiles.push(`${item.distPath}/${filename}`);
        Util.copyFileAndMap(filePath, item.distPath, Util.option.map);
    });

    item.injectFiles = bundleFiles;

    return 0;
};

const allHandler = async (item) => {

    item.bundleName = `${item.buildName}.bundle.js`;

    const bundleList = Util.getInjectFiles(item);
    const bundleFiles = await bundleHandler(item, bundleList);
    if (!bundleFiles) {
        return 1;
    }

    item.injectFiles = bundleFiles;

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
