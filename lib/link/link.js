const fs = require('fs');
const path = require('path');
const EC = require('eight-colors');

const Util = require('../core/util.js');

const getLinkPath = (modulePath, moduleName) => {

    if (!fs.existsSync(modulePath)) {
        Util.logRed(`ERROR: Invalid module path: ${modulePath}`);
        return;
    }

    const moduleJson = Util.readJSONSync(path.resolve(modulePath, 'package.json'));
    if (moduleJson) {
        if (moduleJson.link === false) {
            Util.logYellow(`Ignored link: ${Util.relativePath(modulePath)} (link is specified as false in package.json)`);
            return;
        }
        if (!moduleName) {
            moduleName = moduleJson.name;
        }
    }

    if (!moduleName) {
        moduleName = path.basename(modulePath);
    }

    return path.resolve(Util.root, 'node_modules', moduleName);
};

const addLink = function(modulePath, moduleName) {

    const linkPath = getLinkPath(modulePath, moduleName);
    if (!linkPath) {
        return;
    }

    if (fs.existsSync(linkPath)) {
        EC.logYellow(`Exists link: ${linkPath}`);
        return;
    }

    fs.symlinkSync(modulePath, linkPath);
    Util.logGreen(`Added link: ${Util.relativePath(modulePath)} -> ${Util.relativePath(linkPath)}`);

};

const removeLink = function(modulePath, moduleName) {
    const linkPath = getLinkPath(modulePath, moduleName);
    if (!linkPath) {
        return;
    }

    if (fs.existsSync(linkPath)) {
        Util.rmSync(linkPath);
        EC.logGreen(`Removed previous link: ${linkPath}`);
    }
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
        if (Util.option.remove) {
            removeLink(modulePath);
            return;
        }
        addLink(modulePath);
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
        modulePath = path.resolve(modulePath);
        if (Util.option.remove) {
            removeLink(modulePath, moduleName);
            return;
        }
        addLink(modulePath, moduleName);
        return;
    }

    linkInternalComponents();

};

linkModule.removeLink = removeLink;

module.exports = linkModule;
