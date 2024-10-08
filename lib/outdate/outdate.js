const semver = require('semver');
const https = require('https');

const EC = require('eight-colors');
const Util = require('../core/util.js');
const Concurrency = require('../core/concurrency.js');

const updateModule = require('./update.js');

const colorHandler = (item, current, latest) => {
    const cs = item.pre;
    if (current.major !== latest.major) {
        return cs + EC.red(item.latest);
    }
    if (current.minor !== latest.minor) {
        const mp = EC.cyan(`${latest.minor}.${latest.patch}`);
        return `${cs + latest.major}.${mp}`;
    }
    if (current.patch !== latest.patch) {
        return `${cs + latest.major}.${latest.minor}.${EC.green(latest.patch)}`;
    }
    return cs + item.latest;
};

const updateWantedVersions = (rows, packages) => {

    // filter tag version
    const deps = {};
    rows.filter((item) => !item.tag).forEach((item) => {
        deps[item.name] = item;
    });

    // update component versions and project versions
    const jsonList = packages.map((it) => it.path);
    jsonList.push('package.json');

    jsonList.forEach((p) => {
        // console.log(item);

        Util.editJSON(p, function(json) {
            ['dependencies', 'devDependencies'].forEach((key) => {
                const d = json[key];
                if (!d) {
                    return;
                }
                Object.keys(d).forEach((k) => {
                    if (!deps[k]) {
                        return;
                    }
                    d[k] = deps[k].wanted;
                });
                json[key] = Util.getAscKeyObject(d);
            });
            return Util.sortPackageKeys(json);
        });
    });

    Util.logGreen('Versions are up to date.');

};

const showOutdate = function(list, packages) {

    list = list.filter((item) => {
        if (item.tag) {
            return true;
        }
        if (item.failed) {
            return true;
        }
        // do not check latest
        if (item.current === 'latest') {
            return false;
        }
        item.wanted = item.pre + item.latest;
        if (item.current === item.wanted) {
            return false;
        }
        try {
            const current = semver.coerce(item.current);
            const latest = semver.coerce(item.latest);
            item.latest = colorHandler(item, current, latest);
            return current.version !== latest.version;
        } catch (e) {
            console.log(e);
        }
    });

    if (!list.length) {
        Util.logGreen('Congratulations! All modules are up to date.');
        return;
    }


    // group rows
    const groups = {};
    list.forEach((item) => {
        let group = groups[item.group];
        if (!group) {
            group = {
                name: item.group,
                current: '',
                latest: '',
                subs: []
            };
            groups[item.group] = group;
        }
        group.subs.push(item);
    });

    const rows = Object.values(groups);

    Util.log('outdate list:');
    Util.CG({
        options: {
            sortField: 'name',
            sortAsc: true
        },
        columns: [{
            id: 'name',
            name: 'Name',
            maxWidth: 60
        }, {
            id: 'current',
            name: 'Current'
        }, {
            id: 'latest',
            name: 'Latest'
        }],
        rows: rows
    });

    if (Util.option.update) {
        updateWantedVersions(list, packages);
    } else {
        const cmd = `${Util.id} outdate -u`;
        Util.log(`Run ${EC.magenta(cmd)} to upgrade package.json`);
    }

};

const mergeDeps = (map, dependencies, group) => {
    if (!dependencies) {
        return;
    }

    const list = Object.keys(dependencies);
    list.forEach((k) => {
        const current = dependencies[k] || 'latest';
        const pres = ['^', '~'];
        let pre = '';
        const p = current.substr(0, 1);
        if (pres.includes(p)) {
            pre = p;
        }

        const item = {
            name: k,
            group,
            pre,
            current: current
        };

        const existsItem = map[k];
        if (existsItem && existsItem.current !== item.current) {
            const e = semver.coerce(existsItem.current);
            const v = semver.coerce(item.current);
            const smaller = semver.lt(e.version, v.version);
            if (smaller) {
                // no need change if exists smaller
                return;
            }
        }

        map[k] = item;
    });
};

const generateLatestHandler = async (item, mirrors) => {

    // console.log('mirrors', mirrors);

    if (!mirrors.length) {
        Util.logRed(`failed to generate latest version: ${item.name}`);
        item.latest = EC.red('failed');
        item.failed = true;
        return 0;
    }

    const registry = mirrors.shift();

    const url = `${registry}${item.name}/latest`;

    Util.log(`request ${url} ...`);

    const httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });

    const [err, res] = await Util.request({
        url,
        timeout: item.timeout,
        httpsAgent
    });

    if (err) {
        Util.logRed(`failed to request: ${url} ${err.message} ${err.code}`);
        // console.log(err);
        return generateLatestHandler(item, mirrors);
    }

    const latest = Util.getValue(res, 'data.version');
    if (!latest) {
        Util.log(`check ${item.name}: ${EC.red('failed')} and try again ...`);
        return generateLatestHandler(item, mirrors);
    }

    item.latest = latest;

    Util.log(`check ${item.name}: ${EC.green('done')}`);
    return 0;
};

const outdateModule = async () => {

    const { deps, packages } = await updateModule();

    if (Util.isList(packages)) {
        const subList = EC.cyan(packages.map((it) => it.name));
        Util.log('found sub packages', subList);
    }

    // save dependencies
    const map = {};
    mergeDeps(map, deps.devDependencies, 'devDependencies');
    mergeDeps(map, deps.dependencies, 'dependencies');

    const exclude = Util.getConfig('outdate.exclude');
    if (Util.isList(exclude)) {
        exclude.forEach((item) => {
            Util.logYellow(`exclude outdate checking: ${item}`);
            delete map[item];
        });
    }

    const jobList = Object.values(map);
    if (!jobList.length) {
        Util.log('no dependencies, ignore outdate checking');
        return;
    }

    let timeout = 15 * 1000;
    if (Util.option.timeout) {
        timeout = Util.toNum(Util.option.timeout) || timeout;
    }
    Util.log(`with timeout: ${EC.cyan(timeout)}`);
    jobList.forEach((item) => {
        item.timeout = timeout;
    });

    Util.log(`generating latest versions: ${jobList.length} ...`);

    const concurrency = new Concurrency();
    concurrency.addList(jobList);
    await concurrency.start((item) => {

        const mirrors = [
            // primary official, maybe try twice
            Util.registry,
            'https://registry.npmjs.org/',
            // some metadata mismatched with official
            'https://registry.npmmirror.com/',
            'https://registry.npmjs.cf/'
        ];

        return generateLatestHandler(item, mirrors);

    });

    showOutdate(jobList, packages);

};


module.exports = outdateModule;
