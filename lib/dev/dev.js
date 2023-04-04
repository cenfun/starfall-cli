const child_process = require('child_process');
const EC = require('eight-colors');
const chokidar = require('chokidar');
const Util = require('../core/util.js');
const build = require('../build/build.js');

let worker;
let apiWatchTimeout;
let restarting = false;

const startWorker = function(name, restart = false) {
    console.log('Staring dev worker ...');
    const workerExec = `${__dirname}/dev-worker.js`;
    worker = child_process.fork(workerExec);

    const workerOption = Util.getWorkerOption();
    worker.send({
        type: 'job',
        data: {
            workerOption,
            name,
            restart
        }
    });
};

const stopWorker = async () => {
    clearTimeout(apiWatchTimeout);

    if (!worker) {
        return;
    }

    // stop worker first
    try {
        worker.kill();
    } catch (e) {
        console.log(e);
    }
    worker = null;

    await Util.delay(100);
};

const restartHandler = async (name) => {
    if (restarting) {
        return;
    }
    restarting = true;

    EC.logRed('Stopping server ...');
    await stopWorker();

    EC.logRed('Restarting server ...');
    startWorker(name, true);

    restarting = false;

};

const sendMessage = function(message) {
    console.log(message);
    if (worker) {
        worker.send({
            type: 'message',
            data: message
        });
    }
};

// ==================================================================================

const addWatcher = function(glob, callback) {
    const watcher = chokidar.watch(glob, {
        cwd: Util.root,
        ignoreInitial: true,
        persistent: true
    });

    watcher.on('add', (dir) => {
        callback('add', dir);
    }).on('change', (dir) => {
        callback('change', dir);
    }).on('unlink', (dir) => {
        callback('unlink', dir);
    }).on('addDir', (dir) => {
        callback('addDir', dir);
    }).on('unlinkDir', (dir) => {
        callback('unlinkDir', dir);
    }).on('error', (error) => {
        EC.logRed(error);
    });

    return watcher;
};

// ==================================================================================

const apiWatchHandler = function(name) {
    const apiWatch = Util.getConfig('dev.apiWatch');
    if (!apiWatch) {
        return;
    }

    EC.logCyan(`[dev] api watch: ${apiWatch}`);

    addWatcher(apiWatch, function(type, dir) {

        sendMessage(`Dev API ${type}: ${dir} ... (server will be restarted)`);

        clearTimeout(apiWatchTimeout);
        apiWatchTimeout = setTimeout(function() {
            restartHandler(name);
        }, 100);
    });

};

// ==================================================================================

let devWatchTimeout;
const devWatchHandler = function(name) {
    const devWatch = Util.option.watch;
    if (!devWatch) {
        return;
    }

    EC.logCyan(`[dev] watch: ${devWatch}`);

    addWatcher(devWatch, function(type, dir) {

        if (type === 'unlink' || type === 'unlinkDir') {
            return;
        }

        clearTimeout(devWatchTimeout);
        devWatchTimeout = setTimeout(() => {
            build.buildComponent(name);
        }, 100);

    });
};

// ==================================================================================

const devModule = async (componentName) => {

    const name = Util.getReasonableComponentName(componentName);
    if (!name) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    // build at least once, no matter failed or success
    await build.buildComponent(name);

    startWorker(name);

    // restart server for api change (apiCallback)
    apiWatchHandler(name);

    // rebuild for file change
    devWatchHandler(name);

};

module.exports = devModule;
