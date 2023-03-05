const Util = require('../core/util.js');
const NMLS = require('nmls');

const lsModule = async (names) => {
    const options = {
        sort: Util.option.sort,
        asc: Util.option.asc,
        files: Util.option.files
    };
    const nmls = new NMLS(options);
    await nmls.start(names);
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

    // for projects
    await lsModule();

};

module.exports = listModule;
