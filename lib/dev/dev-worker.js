import Util from '../core/util.js';
import handler from './dev-handler.js';
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
