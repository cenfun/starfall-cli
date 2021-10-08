
const fkill = require('fkill');
const processExists = require('process-exists');
const Util = require('../core/util.js');

const killModule = async (name) => {

    const nameList = (`${name}`).split(',');

    const options = {
        force: true,
        ignoreCase: true
    };

    for (let item of nameList) {

        const exists = await processExists(item);
        if (!exists) {
            const itemExe = `${item}.exe`;
            const existsExe = await processExists(itemExe);
            if (!existsExe) {
                Util.logYellow(`Process doesn't exist: ${item}`);
                continue;
            }
            item = itemExe;
        }

        let killed = true;
        await fkill(item, options).catch(function(e) {
            killed = false;
            Util.logRed(e);
        });
        if (killed) {
            Util.logGreen(`Killed process: ${item}`);
        }
    }
   
};

module.exports = killModule;