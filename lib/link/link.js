const fs = require("fs");
const path = require("path");
const shelljs = require("shelljs");
const Util = require("../core/util.js");

const getNameFromPath = function(modulePath) {
    //get name from package.json
    const pp = path.resolve(modulePath, "package.json");
    if (fs.existsSync(pp)) {
        const json = Util.readJSONSync(pp);
        if (json) {
            return json.name;
        }
    }
    return path.basename(modulePath);
};

const linkItem = function(modulePath, moduleName) {

    if (!fs.existsSync(modulePath)) {
        Util.logRed(`ERROR: Invalid module path: ${modulePath}`);
        return;
    }

    if (!moduleName) {
        moduleName = getNameFromPath(modulePath);
    }

    const nPath = path.resolve(Util.root, "node_modules", moduleName);
    if (fs.existsSync(nPath)) {
        Util.rmSync(nPath);
        console.log(`Removed link: ${nPath}`);
    }
    if (Util.option.remove) {
        return;
    }
    
    shelljs.ln("-sf", modulePath, nPath);
    Util.logGreen(`link: ${Util.relativePath(modulePath)} -> ${Util.relativePath(nPath)}`);

};

// link all internal components include app for list checking
const linkInternalComponents = function() {

    //not for single component
    if (!Util.componentsRoot) {
        return;
    }

    Util.logStart("link internal components ...");
    const list = Util.getComponentList();
    list.forEach(name => {
        const modulePath = Util.getComponentPath(name);
        linkItem(modulePath);
    });

};

const linkModule = (modulePath, moduleName) => {

    //if nothing dependencies installed
    const nodeModulesPath = path.resolve(Util.root, "node_modules");
    if (!fs.existsSync(nodeModulesPath)) {
        shelljs.mkdir("-p", nodeModulesPath);
    }

    if (modulePath) {
        linkItem(modulePath, moduleName);
        return;
    }

    linkInternalComponents();

};

module.exports = linkModule;
