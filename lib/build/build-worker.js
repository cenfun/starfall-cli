const Util = require('../core/util.js');
const buildHandler = require('./build-handler.js');
Util.initWorker(buildHandler);
