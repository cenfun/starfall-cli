const child_process = require('child_process');
const EC = require('eight-colors');
const chokidar = require('chokidar');
const Util = require('../core/util.js');
const build = require('../build/build.js');

let worker;
let watchTimeout;
let restarting = false;

const sendMessage = function(message) {
    console.log(message);
    if (worker) {
        worker.send({
            type: 'message',
            data: message
        });
    }
};

const stopWorker = async () => {
    clearTimeout(watchTimeout);

    if (!worker) {
        return;
    }

    //stop worker first
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

const watchEventHandler = function(type, dir, name) {

    sendMessage(`Preview API ${type}: ${dir} ... (server will be restarted)`);

    clearTimeout(watchTimeout);
    watchTimeout = setTimeout(function() {
        restartHandler(name);
    }, 100);
};

const previewApiWatchHandler = function(name) {
    const previewApiWatch = Util.getSetting('previewApiWatch');
    if (!previewApiWatch) {
        return;
    }

    const watcher = chokidar.watch(previewApiWatch, {
        cwd: Util.root,
        ignoreInitial: true,
        persistent: true
    });

    watcher.on('add', (dir) => {
        watchEventHandler('add', dir, name);
    }).on('change', (dir) => {
        watchEventHandler('change', dir, name);
    }).on('unlink', (dir) => {
        watchEventHandler('unlink', dir, name);
    }).on('addDir', (dir) => {
        watchEventHandler('addDir', dir, name);
    }).on('unlinkDir', (dir) => {
        watchEventHandler('unlinkDir', dir, name);
    }).on('error', (error) => {
        EC.logRed(error);
    });

};

const startWorker = function(name, restart = false) {
    console.log('Staring preview worker ...');
    const workerExec = `${__dirname}/preview-worker.js`;
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

const previewModule = async (componentName) => {

    const list = Util.getCurrentComponentList(componentName);
    //preview only one
    let name = list[0];
    if (list.length > 1) {
        name = list.find(item => item === 'app');
        if (!name) {
            name = list[0];
        }
    }
    if (!name) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    //build at least once
    await build.buildComponent(name);

    startWorker(name);

    previewApiWatchHandler(name);

};

module.exports = previewModule;
