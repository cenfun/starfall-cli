const Util = require('../core/util.js');
const handler = require('./dev-handler.js');
process.on('message', function(message) {
    if (!message) {
        return;
    }
    const type = message.type;
    const data = message.data;
    if (type === 'job' && data) {
        Util.setWorkerOption(data.workerOption);
        handler(data.name, data.restart);
        return;
    }
    if (type === 'message') {
        handler.sendMessage(data);
    }
});
