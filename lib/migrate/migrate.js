const Util = require('../core/util.js');

const scripts = {
    
};

const migrateModule = function(type) {
    const theModule = scripts[type];
    if (!theModule) {
        Util.logRed(`ERROR: Not found: ${type}`);
        return;
    }

    theModule();

};

module.exports = migrateModule;
