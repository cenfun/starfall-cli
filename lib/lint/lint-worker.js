const Util = require('../core/util.js');
const lintHandler = require('./lint-handler.js');
Util.initWorker(lintHandler);
