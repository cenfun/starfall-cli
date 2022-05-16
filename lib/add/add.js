const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const Util = require('../core/util.js');

const addItem = (componentName, pc) => {

    const componentPath = Util.getComponentPath(componentName);
    const folder = path.resolve(componentPath);
    console.log(`Checking folder: ${folder}`);
    if (fs.existsSync(folder)) {
        Util.logRed(`Component exists already: ${componentName}`);
        return 1;
    }

    //componentName to componentFullName
    let componentFullName = componentName;
    if (componentName.indexOf(pc.name) !== 0) {
        componentFullName = [pc.name, componentName].join('-');
    }


    //create folder
    console.log('Create folder ... ');
    shelljs.mkdir('-p', folder);

    console.log('Copy template files to folder ...');
    let template = './lib/add/template/*';
    if (Util.option.vue) {
        template = './lib/add/template-vue/*';
    }

    const templatePath = path.resolve(Util.cliRoot, template);

    shelljs.cp('-R', templatePath, folder);

    const previewPath = Util.getConfig('preview.path');
    if (previewPath !== 'preview') {
        fs.renameSync(`${folder}/preview`, `${folder}/${previewPath}`);
    }

    console.log('Initialize component ...');
    const buildPath = Util.getConfig('build.path');

    const files = [`${previewPath}/index.html`, 'package.json', 'src/component.vue', 'src/index.js'];
    files.forEach(function(file) {

        const filePath = `${folder}/${file}`;
        if (!fs.existsSync(filePath)) {
            return;
        }

        console.log(`Initialize ${filePath}`);
        let content = Util.readFileContentSync(filePath);
        if (content) {
            content = content.replace(/cli-component-name/g, componentFullName);
            content = content.replace(/cli-build-path/g, buildPath);
            Util.writeFileContentSync(filePath, content);
        }

    });

    Util.logGreen(`Component added: ${componentFullName}`);

    return 0;
};

const addList = (list) => {

    console.log('add list: ', list);
    //clone list for list.shift()
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
