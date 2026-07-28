import EC from 'eight-colors';
import build from '../build/build.js';
import Util from '../core/util.js';
import packHandler from './pack-handler.js';

const packComponent = async (componentName) => {

    Util.log(`component: ${EC.cyan(componentName)}`);

    const buildRelated = true;

    let options = {
        devtool: false
    };
    if (Util.option.map) {
        options = {};
    }

    // build component and related components
    const item = await build.buildComponent(componentName, buildRelated, options);
    if (!item) {
        return 1;
    }

    const tasks = [() => {
        return Util.runHook('pack.before', item);
    }, () => {
        const handler = Util.getConfig('pack.handler');
        // customize handler
        if (typeof handler === 'function') {
            return handler(item);
        }
        // default handler
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

    // pack default to production
    Util.option.production = true;

    const exitCode = await packComponent(name);
    // always exit no matter exit code is 0
    process.exit(exitCode);

};

export default packModule;
