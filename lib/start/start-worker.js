const Util = require('../core/util.js');
const GUI = require('./start-handler.js');

let gui;

const startJob = (job) => {
    // console.log("job:", job);
    Util.setWorkerOption(job.workerOption);
    gui = new GUI(job.port);
};

process.on('message', function(message) {
    if (!message) {
        return;
    }
    if (message.type === 'job') {
        startJob(message.data);
    } else if (message.type === 'error') {
        gui.sendMessage(message.data, '#ff0000');
    } else if (message.type === 'message') {
        gui.sendMessage(message.data);
    }
});
