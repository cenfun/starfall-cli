const Util = require("../core/util.js");
const outdateHandler = require("./outdate-handler.js");
Util.initWorker(outdateHandler);
