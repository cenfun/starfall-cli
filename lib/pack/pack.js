const EC = require('eight-colors');
const build = require('../build/build.js');
const Util = require('../core/util.js');
const packHandler = require('./pack-handler.js');

const packComponent = async (componentName) => {

    Util.log(`component: ${EC.cyan(componentName)}`);

    const buildRelated = true;
    // build component and related components 
    const item = await build.buildComponent(componentName, buildRelated);
    if (!item) {
        return 1;
    }

    const tasks = [() => {
        return Util.runHook('pack.before', item);
    }, () => {
        const handler = Util.getConfig('pack.handler');
        //customize handler
        if (typeof handler === 'function') {
            return handler(item);
        }
        //default handler
        return packHandler(item);
    }, () => {
        return Util.runHook('pack.after', item);
    }];

    return Util.tasksResolver(tasks);

};

const packModule = async (componentName) => {

    const name = Util.getReasonableComponentName(componentName);
    if (!name) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    const exitCode = await packComponent(name);
    // always exit no matter exit code is 0
    process.exit(exitCode);

};

module.exports = packModule;
