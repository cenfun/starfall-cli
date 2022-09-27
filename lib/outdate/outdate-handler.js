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

    if (retry > 3) {
        Util.logRed(`failed to generate ${item.name}: ${item.url}`);
        item.latest = 'failed';
        return 0;
    }

    const str = retry ? EC.yellow('reloading') : 'loading';
    Util.log(`${str} ${item.url}`);

    const [err, res] = await Util.request({
        url: item.url,
        timeout: item.timeout
    });

    if (err) {
        Util.logRed(`failed to request: ${item.url}`);
        return generateLatestHandler(item, retry + 1);
    }

    const done = updateLatest(item, res);
    if (!done) {
        console.log(`check ${item.name}: ${EC.red('failed')} and try again ...`);
        return generateLatestHandler(item, retry + 1);
    }

    console.log(`check ${item.name}: ${EC.green('done')}`);
    return 0;
};


const outdateHandler = (item) => {

    Util.jobId = item.jobId;
    Util.jobName = item.jobName;
    Util.componentName = item.name;
    Util.log();

    return generateLatestHandler(item);
};

module.exports = outdateHandler;
