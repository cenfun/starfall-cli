const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const shelljs = require('shelljs');
const Util = require('../core/util.js');

const createProject = (option) => {
    console.log(option);

    // copy root files
    const list = [
        '.vscode',
        '.eslintignore',
        '.eslintrc.js',
        '.gitignore',
        '.npmrc',
        '.stylelintignore',
        '.stylelintrc.js',
        'README.md',
        'lib/init/template/scripts',
        'lib/init/template/package.json'
    ];

    list.forEach((item) => {
        const p = path.resolve(Util.cliRoot, item);
        if (!fs.existsSync(p)) {
            return;
        }
        shelljs.cp('-R', p, Util.root);
    });

    // edit package.json
    const pp = `${Util.root}/package.json`;
    let str = Util.readFileSync(pp);
    str = Util.replace(str, {
        projectName: option.projectName
    });
    Util.writeFileSync(pp, str);
    // empty eslint ignore
    Util.writeFileSync(`${Util.root}/.eslintignore`, '');

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
