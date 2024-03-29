const semver = require('semver');
const Util = require('./util.js');
const EC = Util.EC;


const checkVersion = function(currentVersion, newVersion) {
    // console.log("check version ...", currentVersion, newVersion);

    if (semver.lt(currentVersion, newVersion)) {

        const newV = EC.bg.green(` ${newVersion} `);

        let tips = '';
        tips += '\n';
        tips += EC.yellow('▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇\n');
        tips += `  ${Util.name}-cli update available: \n`;
        tips += `  ${currentVersion} => ${newV}`;
        tips += '\n';
        tips += EC.yellow('▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇\n');

        Util.upgradeTips = tips;

    }
};

const needUpgrade = (currentVersion, currentTimestamp, filePath) => {
    // 1 hour check
    const checkDuration = 1000 * 60 * 60;
    const json = Util.readJSONSync(filePath);
    if (json && currentTimestamp - json.timestamp < checkDuration) {
        if (Math.random() > 0.8) {
            checkVersion(currentVersion, json.version);
        }
        return false;
    }
    return true;
};

const getLatestVersion = async () => {
    const url = `${Util.registry}${Util.name}-cli/latest`;
    const [err, res] = await Util.request({
        url,
        timeout: 3000
    });
    if (err) {
        Util.logRed(`Failed to load: ${url}`);
        return;
    }
    return Util.getValue(res, 'data.version');
};

const upgradeModule = async (currentVersion) => {

    const currentTimestamp = new Date().getTime();
    // have .upgrade.json file
    const filePath = `${Util.cliRoot}/.upgrade.json`;
    // console.log(Util.cliRoot, filePath);

    if (!needUpgrade(currentVersion, currentTimestamp, filePath)) {
        return;
    }

    const newJson = {
        timestamp: currentTimestamp,
        version: currentVersion
    };

    const newVersion = await getLatestVersion();
    if (newVersion) {

        newJson.version = newVersion;
        Util.logCyan(`${Util.name}-cli latest version: ${newVersion}`);

        checkVersion(currentVersion, newVersion);

    }

    // console.log(filePath, newJson);

    Util.writeJSONSync(filePath, newJson);

};


module.exports = upgradeModule;
