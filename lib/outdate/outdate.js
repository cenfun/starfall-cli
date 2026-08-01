import semver from 'semver';
import { execa } from 'execa';

import EC from 'eight-colors';
import CG from 'console-grid';
import {
    state, editJSON, getAscKeyObject, sortPackageKeys, logGreen, log, PF, isList, getConfig, logYellow, toNum, zero
} from '../core/util.js';
import Concurrency from '../core/concurrency.js';

import updateModule from './update.js';

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

        editJSON(p, function(json) {
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
                json[key] = getAscKeyObject(d);
            });
            return sortPackageKeys(json);
        });
    });

    logGreen('Versions are up to date.');

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
        logGreen('Congratulations! All modules are up to date.');
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

    log('outdate list:');
    CG({
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

    if (state.option.update) {
        updateWantedVersions(list, packages);
    } else {
        const cmd = `${state.id} outdate -u`;
        log(`Run ${EC.magenta(cmd)} to upgrade package.json`);
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

const generateLatestHandler = async (item) => {

    const packageName = `${item.name}`;
    const result = await execa('npm', ['view', packageName, 'version'], {
        timeout: item.timeout,
        reject: false
    });

    if (result.timedOut) {
        return {
            error: 'timeout'
        };
    }

    const version = result.stdout.trim();
    if (!result.failed && version) {
        return {
            version
        };
    }

    return {
        error: result.stderr.trim() || result.shortMessage || `npm exited with code ${result.exitCode}`
    };
};

const generateVersions = async (jobList) => {

    const total = jobList.length;

    const list = jobList.filter((item) => !item.latest);
    if (list.length === 0) {
        return;
    }

    let done = total - list.length;

    log(`generating latest versions: ${done}/${total} ...`);

    const concurrency = new Concurrency();
    concurrency.addList(list);
    await concurrency.start(async (item) => {

        const { error, version } = await generateLatestHandler(item);

        const msg = `${item.no} ${EC.cyan(item.name)}`;

        if (error) {
            // Mark failures so they are not retried forever by generateVersions.
            item.failed = error;
            log(`${msg} ${EC.red(error)}`);
            return;
        }

        done += 1;
        item.latest = version;
        log(`${msg} ${EC.magenta(version)} ${EC.green('done')} ${PF(done, total)} (${done}/${total})`);
    });

    // Do not recursively retry failed package lookups. A missing npm command,
    // network failure, or invalid package would otherwise cause an infinite loop.
};

const outdateModule = async () => {

    const { deps, packages } = await updateModule();

    if (isList(packages)) {
        const subList = EC.cyan(packages.map((it) => it.name));
        log('found sub packages', subList);
    }

    // save dependencies
    const map = {};
    mergeDeps(map, deps.devDependencies, 'devDependencies');
    mergeDeps(map, deps.dependencies, 'dependencies');

    const exclude = getConfig('outdate.exclude');
    if (isList(exclude)) {
        exclude.forEach((item) => {
            logYellow(`exclude outdate checking: ${item}`);
            delete map[item];
        });
    }

    const jobList = Object.values(map);
    if (!jobList.length) {
        log('no dependencies, ignore outdate checking');
        return;
    }

    let timeout = 30 * 1000;
    if (state.option.timeout) {
        timeout = toNum(state.option.timeout) || timeout;
    }
    log(`with timeout: ${EC.cyan(timeout)}`);

    const il = jobList.length.toString().length;
    jobList.forEach((item, i) => {
        item.timeout = timeout;
        item.no = zero(i + 1, il);
    });

    await generateVersions(jobList);

    showOutdate(jobList, packages);

    process.exit(0);
};


export default outdateModule;
