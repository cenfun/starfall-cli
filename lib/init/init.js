const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const shelljs = require('shelljs');
const Util = require('../core/util.js');

const createProject = (option) => {
    console.log(option);

    // copy root files
    const fileList = [
        '.vscode',
        '.eslintignore',
        '.eslintrc.js',
        '.gitignore',
        '.npmrc',
        '.stylelintignore',
        '.stylelintrc.js',
        'README.md',
        'lib/init/template/package.json'
    ];

    fileList.forEach((file) => {
        const fp = `${Util.cliRoot}/${file}`;
        if (fs.existsSync(fp)) {
            shelljs.cp('-R', fp, Util.root);
        }
    });

    // edit package.json
    const pp = `${Util.root}/package.json`;
    let str = Util.readFileContentSync(pp);
    str = Util.replace(str, {
        projectName: option.projectName
    });
    Util.writeFileContentSync(pp, str, true);
    // empty eslint ignore
    Util.writeFileContentSync(`${Util.root}/.eslintignore`, '', true);

    // create packages
    shelljs.mkdir('-p', `${Util.root}/packages`);
    if (option.componentName) {
        let cmd = `${Util.id} add ${option.componentName}`;
        if (Util.option.vue) {
            cmd += ' --vue';
        }
        shelljs.exec(cmd);
    }

    Util.logGreen(`Init Project Done.\nGetting started with command: ${Util.id} start`);

};

const initModule = () => {

    const projectName = path.relative('../', process.cwd());
    const componentName = 'app';

    if (Util.option.force) {
        const option = {
            projectName: projectName,
            componentName: componentName
        };
        createProject(option);
        return;
    }

    const promptModules = [];

    promptModules.push({
        name: 'projectName',
        default: projectName,
        message: 'Please enter the project name (package name)?'
    }, {
        name: 'componentName',
        default: componentName,
        message: 'Please enter the first component name?'
    });

    inquirer.prompt(promptModules).then((answers) => {

        const option = {
            projectName: answers.projectName,
            componentName: answers.componentName
        };
        createProject(option);
    });
};

module.exports = initModule;
