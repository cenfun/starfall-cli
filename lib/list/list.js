const Util = require('../core/util.js');
const NMLS = require('nmls');

const lsModule = async (names) => {
    const nmls = new NMLS('.');
    const option = {
        workspace: Boolean(Util.componentsRoot),
        sort: Util.option.sort,
        asc: Util.option.asc,
        module: names,
        files: false,
        externalType: 'devDependencies'
    };
    // console.log(option);
    await nmls.start(option);
};

const listModule = async (componentName) => {

    if (componentName) {
        const list = Util.getCurrentComponentList(componentName);
        if (!list.length) {
            Util.logRed(`ERROR: Not found component: ${componentName}`);
            return;
        }
        const names = [];
        for (const item of list) {
            names.push(Util.getComponentFullName(item));
        }
        await lsModule(names);
        return;
    }

    // for all or a module name
    await lsModule(Util.option.module);

};

module.exports = listModule;
