const path = require('path');
const semver = require('semver');
const EC = require('eight-colors');
const Util = require('../core/util.js');

const updateModule = require('../install/update.js');
const outdateHandler = require('./outdate-handler.js');

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

const updateWantedVersions = (rows) => {

    //filter tag version

    const deps = {};
    rows.filter(item => !item.tag).forEach(item => {
        deps[item.name] = item;
    });

    //update component versions and project versions
    const list = [];
    if (Util.componentsRoot) {
        Util.getComponentList().forEach(c => {
            list.push({
                name: c,
                root: Util.getComponentPath(c)
            });
        });
    }

    const pc = Util.getProjectConf();
    list.push({
        name: pc.name,
        root: Util.root
    });

    list.forEach(item => {
        //console.log(item);
        
        Util.editJSON(`${item.root}/package.json`, function(json) {
            [json.dependencies, json.devDependencies].forEach(d => {
                if (!d) {
                    return;
                }
                Object.keys(d).forEach(k => {
                    if (!deps[k]) {
                        return;
                    }
                    d[k] = deps[k].wanted;
                });
            });
            return json;
        });
    });

    Util.logGreen('Versions are up to date.');
    
};

const showOutdate = function(list) {
    
    list = list.filter(item => {
        if (item.tag) {
            return true;
        }
        if (item.latest === 'failed') {
            Util.logRed(`Failed to check outdate: ${item.name}@${item.current}`);
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


    //group rows
    const groups = {};
    list.forEach(item => {
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

    console.log('outdate list:');
    Util.consoleGrid.render({
        option: {
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
        updateWantedVersions(list);
    } else {
        const cmd = `${Util.id} outdate -u`;
        console.log(`Run ${EC.magenta(cmd)} to upgrade package.json`);
    }

};

const initDeps = (deps, pc, group) => {
    const item = pc[group];
    if (!item) {
        return;
    }

    const list = Object.keys(item);
    list.forEach(k => {
        const current = item[k] || 'latest';
        const pres = ['^', '~'];
        let pre = '';
        const p = current.substr(0, 1);
        if (pres.includes(p)) {
            pre = p;
        }

        deps[k] = {
            name: k,
            group: group,
            url: `${Util.registry}${k}`,
            pre: pre,
            current: current
        };
    });
};

const outdateModule = () => {

    const pc = updateModule({
        silent: true
    });

    //save dependencies
    const deps = {};
    initDeps(deps, pc, 'devDependencies');
    initDeps(deps, pc, 'dependencies');

    const exclude = Util.getConfig('outdate.exclude');
    if (Util.isList(exclude)) {
        exclude.forEach(item => {
            Util.logYellow(`exclude outdate checking: ${item}`);
            delete deps[item];
        });
    }

    const jobList = Object.values(deps);
    if (!jobList.length) {
        console.log('no dependencies, ignore outdate checking');
        return;
    }

    Util.logMsg('outdate', `generating latest versions: ${jobList.length} ...`);

    const option = {
        name: 'outdate',
        workerEntry: path.resolve(__dirname, 'outdate-worker.js'),
        workerHandler: outdateHandler,
        jobTimeout: 3 * 60 * 1000,
        jobList: jobList,
        logCost: false,
        reportHandler: () => {
            showOutdate(jobList);
        }
    };

    return Util.startWorker(option);
};


module.exports = outdateModule;