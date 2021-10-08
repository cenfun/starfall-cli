const Util = require('../core/util.js');
const diffHandler = require('./diff-handler.js');
Util.initWorker(diffHandler);
