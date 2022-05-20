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
    console.log(`append: ${file} ...`);
    const extname = path.extname(file);
    let bundlePath = bundleMap[extname];
    if (!bundlePath) {
        // bundleName is no extname
        bundlePath = path.resolve(item.buildPath, item.bundleName + extname);
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

const bundleModule = async (item) => {


    // const filename = `${item.buildName}.js`;
    
    // item.bundleName = filename;
    
    // // bundle from files
    // let bundleList = [].concat(item.dependencies.files);
    // bundleList = bundleList.concat(item.buildFiles);
    // if (item.devFiles) {
    //     bundleList = bundleList.concat(item.devFiles);
    // }
    
    // // return a list may includes 2 files for js and css
    // const bundleFiles = await packBundle(item, bundleList);
    // if (!bundleFiles) {
    //     return 1;
    // }
    
    // item.bundleFiles = bundleFiles;
    // Util.logWorker(`finish: ${bundleFiles.join(', ')}`);
        

    // console.log('generate bundle ...');

    // const bundleMap = {};
    // for (const file of bundleList) {
    //     const success = await bundleFile(item, file, bundleMap);
    //     if (!success) {
    //         return;
    //     }
    // }

    // for (const extname in bundleMap) {
    //     const absFilePath = bundleMap[extname];
    //     const relFilePath = Util.relativePath(absFilePath);
    //     if (item.minify) {
    //         console.log(`minify bundle: ${relFilePath} ...`);
    //         await minifyBundle(extname, absFilePath);
    //     }
    //     bundleMap[extname] = relFilePath;
    // }

    // const bundleFiles = Object.values(bundleMap);
    // // for file inject order: .css first than .js
    // bundleFiles.sort();
     
    // if (bundleFiles.length) {
    //     return bundleFiles;
    // }

    return 0;

};

module.exports = bundleModule;
