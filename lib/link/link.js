const fs = require('fs');
const path = require('path');
const Util = require('../core/util.js');

const linkItem = function(modulePath, moduleName) {

    if (!fs.existsSync(modulePath)) {
        Util.logRed(`ERROR: Invalid module path: ${modulePath}`);
        return;
    }

    const moduleJson = Util.readJSONSync(path.resolve(modulePath, 'package.json'));

    if (!moduleName) {
        moduleName = moduleJson ? moduleJson.name : path.basename(modulePath);
    }

    const nPath = path.resolve(Util.root, 'node_modules', moduleName);
    if (fs.existsSync(nPath)) {
        Util.rmSync(nPath);
        console.log(`Removed previous link: ${nPath}`);
    }
    if (Util.option.remove) {
        return;
    }

    if (moduleJson && moduleJson.link === false) {
        Util.logYellow(`Ignored link false: ${Util.relativePath(modulePath)}`);
        return;
    }

    fs.symlinkSync(modulePath, nPath);
    Util.logGreen(`link: ${Util.relativePath(modulePath)} -> ${Util.relativePath(nPath)}`);

};

// link all internal components include app for list checking
const linkInternalComponents = function() {

    // not for single component
    if (!Util.componentsRoot) {
        return;
    }

    Util.logLine('link internal components ...');
    const list = Util.getComponentList();
    list.forEach((name) => {
        const modulePath = Util.getComponentPath(name);
        linkItem(modulePath);
    });

};

const linkModule = (modulePath, moduleName) => {

    // if nothing dependencies installed
    const nodeModulesPath = path.resolve(Util.root, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        fs.mkdirSync(nodeModulesPath, {
            recursive: true
        });
    }

    if (modulePath) {
        linkItem(modulePath, moduleName);
        return;
    }

    linkInternalComponents();

};

module.exports = linkModule;
