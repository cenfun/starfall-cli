const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const Util = require('../core/util.js');
const EC = Util.EC;

let worker;
let switching = false;

const sendMessage = (type, msg) => {
    console.log(msg);
    if (worker) {
        worker.send({
            type: type,
            data: msg
        });
    }
};

const stopWorker = async () => {
    await Util.delay(100);

    //stop worker first
    try {
        worker.kill();
    } catch (e) {
        console.log(e);
    }
    worker = null;

    await Util.delay(100);
};

const switchProject = async (port, project) => {
    if (switching) {
        return;
    }
    switching = true;

    sendMessage('message', `Switch project to: ${EC.cyan(project)}`);

    //check path first
    const projectPath = path.resolve(project);
    if (!fs.existsSync(projectPath)) {
        sendMessage('error', `ERROR: project path not exist: ${projectPath}`);
        switching = false;
        return;
    }

    //change dir
    console.log('Change dir ...');
    process.chdir(projectPath);

    Util.root = process.cwd();
    console.log(`Project root: ${Util.root}`);
    if (!Util.initProject()) {
        sendMessage('error', `ERROR: Failed switch to: ${Util.root}`);
        switching = false;
        return;
    }

    sendMessage('message', 'Stop and Restart GUI server ...');
    await stopWorker();

    //start again
    startModule(port);

    switching = false;

};

const startModule = function(port) {

    //start port
    port = port || Util.getConfig('guiPort');

    const workerExec = `${__dirname}/start-worker.js`;
    worker = child_process.fork(workerExec);
    //from worker send
    worker.on('message', function(message) {
        if (message.type === 'switchProject') {
            switchProject(port, message.data);
        }
    });

    const workerOption = Util.getWorkerOption();
    const job = {
        workerOption: workerOption,
        port: port
    };
    worker.send({
        type: 'job',
        data: job
    });

};

module.exports = startModule;
