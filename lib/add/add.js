const fs = require('fs');
const path = require('path');
const Util = require('../core/util.js');

const getNamePrefix = (str) => {
    str = `${str}`.trim();
    str = str.split(/\W/).filter((it) => it).shift();
    return str;
};

const addItem = (componentName, pc) => {

    const componentPath = Util.getComponentPath(componentName);
    const folder = path.resolve(componentPath);
    console.log(`Checking folder: ${folder}`);
    if (fs.existsSync(folder)) {
        Util.logRed(`Component exists: ${componentName}`);
        return 1;
    }

    const prefix = getNamePrefix(pc.name);

    let componentFullName;
    if (componentName.startsWith(prefix)) {
        componentFullName = componentName;
    } else {
        componentFullName = [prefix, componentName].join('-');
    }

    // create folder
    console.log('Create folder ... ');

    fs.mkdirSync(folder, {
        recursive: true
    });

    console.log('Copy template files to folder ...');
    const fromDir = path.resolve(Util.cliRoot, './lib/add/template/');
    Util.copyDir(fromDir, folder);

    console.log('Initialize component ...');
    const buildPath = Util.getConfig('build.path');

    Util.forEachFile(folder, ['.html', '.json', '.js', '.md'], function(fileName, filePath) {
        const p = `${filePath}/${fileName}`;
        if (!fs.existsSync(p)) {
            return;
        }

        console.log(`Initialize ${p}`);
        let content = Util.readFileSync(p);
        if (content) {
            content = content.replace(/cli-component-name/g, componentFullName);
            content = content.replace(/cli-build-path/g, buildPath);
            Util.writeFileSync(p, content);
        }
    });

    Util.logGreen(`Component added: ${componentFullName}`);

    return 0;
};

const addList = (list) => {

    console.log('add list: ', list);
    // clone list for list.shift()
    list = [].concat(list);

    const pc = Util.getProjectConf();

    const tasks = [];

    list.forEach(function(item) {
        tasks.push(() => {
            return addItem(item, pc);
        });
    });

    return Util.tasksResolver(tasks);

};


const add = async (componentName) => {

    if (!Util.componentsRoot) {
        Util.logRed('ERROR: Can NOT add components without sub components folder');
        return;
    }

    let list = [];
    if (componentName) {
        componentName = componentName.toLowerCase();
        list = componentName.split(',');
    }

    if (!list.length) {
        Util.logRed('Require a specified component name');
        return;
    }

    const exitCode = await addList(list);
    process.exit(exitCode);

};

module.exports = add;
