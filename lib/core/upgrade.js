import semver from 'semver';
import EC from 'eight-colors';
import {
    state, readJSONSync, request, logRed, getValue, logCyan, writeJSONSync
} from './util.js';


const checkVersion = function(currentVersion, newVersion) {
    // console.log("check version ...", currentVersion, newVersion);

    if (semver.lt(currentVersion, newVersion)) {

        const newV = EC.bg.green(` ${newVersion} `);

        let tips = '';
        tips += '\n';
        tips += EC.yellow('▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇\n');
        tips += `  ${state.name}-cli update available: \n`;
        tips += `  ${currentVersion} => ${newV}`;
        tips += '\n';
        tips += EC.yellow('▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇\n');

        state.upgradeTips = tips;

    }
};

const needUpgrade = (currentVersion, currentTimestamp, filePath) => {
    // 1 hour check
    const checkDuration = 1000 * 60 * 60;
    const json = readJSONSync(filePath);
    if (json && currentTimestamp - json.timestamp < checkDuration) {
        if (Math.random() > 0.8) {
            checkVersion(currentVersion, json.version);
        }
        return false;
    }
    return true;
};

const getLatestVersion = async () => {
    const url = `${state.registry}${state.name}-cli/latest`;
    const [err, res] = await request({
        url,
        timeout: 3000
    });
    if (err) {
        logRed(`Failed to load: ${url}`);
        return;
    }
    return getValue(res, 'data.version');
};

const upgradeModule = async (currentVersion) => {

    const currentTimestamp = new Date().getTime();
    // have .upgrade.json file
    const filePath = `${state.cliRoot}/.upgrade.json`;
    // console.log(state.cliRoot, filePath);

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
        logCyan(`${state.name}-cli latest version: ${newVersion}`);

        checkVersion(currentVersion, newVersion);

    }

    // console.log(filePath, newJson);

    writeJSONSync(filePath, newJson);

};


export default upgradeModule;
