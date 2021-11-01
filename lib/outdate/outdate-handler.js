const axios = require('axios');
const Util = require('../core/util.js');
const EC = Util.EC;

const updateLatest = (item, res) => {
    const tags = Util.getValue(res, 'data.dist-tags');
    if (tags) {
        const tagVersion = tags[item.current];
        if (tagVersion) {
            item.latest = tagVersion;
            item.tag = true;
            return true;
        }
        if (tags.latest) {
            item.latest = tags.latest;
            return true;
        }
    }
};

const generateLatestHandler = async (item, retry = 0) => {

    console.log(`loading ${item.url}`);
    const res = await axios.get(item.url, {
        timeout: 30 * 1000
    }).catch(function(e) {
        Util.logRed(e);
    });

    const done = updateLatest(item, res);
    if (done) {
        console.log(`check ${item.name}: ${EC.green('done')}`);
        return 0;
    }
    
    if (retry > 3) {
        Util.logRed(`failed to generate ${item.name}: ${item.url}`);
        item.latest = 'failed';
        return 0;
    }
   
    console.log(`check ${item.name}: ${EC.red('failed')} and try again ...`);
    
    return generateLatestHandler(item, retry + 1);
};


const outdateHandler = (item) => {

    Util.jobId = item.jobId;
    Util.jobName = item.jobName;
    Util.componentName = item.name;
    Util.logWorker();

    return generateLatestHandler(item);
};

module.exports = outdateHandler;
