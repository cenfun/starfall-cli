import fs from 'fs';
import path from 'path';
import EC from 'eight-colors';
import ignore from 'ignore';
import { execa } from 'execa';
import {
    state, getConfig, toList, rm, logCyan, logLine, logYellow, tasksResolver, TF, logGreen
} from '../core/util.js';

// build exclude filter from clean.exclude config
// matched items are kept even if git-ignored
const generateExclude = function() {
    const excludeRules = toList(getConfig('clean.exclude'));
    if (!excludeRules.length) {
        return null;
    }
    const ig = ignore();
    console.log('clean exclude rules:', excludeRules);
    ig.add(excludeRules);
    return ig;
};

// =========================================================================================

// batch check with git check-ignore
// exit code: 0 = at least one ignored, 1 = none ignored, others = git error (e.g. not a repository)
const checkIgnored = async (relPaths) => {
    const result = await execa('git', ['check-ignore', '-z', '--stdin'], {
        input: `${relPaths.join('\0')}\0`,
        reject: false
    });
    if (result.exitCode === 1) {
        return [];
    }
    if (result.exitCode !== 0) {
        return null;
    }
    return result.stdout.split('\0').filter((item) => item);
};

// generate git-ignored file list, do not descend into ignored directories
const generateCleanList = async (root) => {
    console.log('generate ignore list ...');
    const list = [];
    let gitOk = true;

    const walk = async (relDir) => {
        if (!gitOk) {
            return;
        }
        const absDir = path.resolve(root, relDir);
        const entries = fs.readdirSync(absDir, {
            withFileTypes: true
        }).filter((item) => {
            return item.name !== '.git';
        });
        if (!entries.length) {
            return;
        }

        const ignored = await checkIgnored(entries.map((item) => `${relDir}${item.name}`));
        if (ignored === null) {
            gitOk = false;
            return;
        }
        const ignoredSet = new Set(ignored);

        for (const item of entries) {
            const rel = `${relDir}${item.name}`;
            if (ignoredSet.has(rel)) {
                // ignored: no need to check its children
                list.push(rel);
            } else if (item.isDirectory()) {
                await walk(`${rel}/`);
            }
        }
    };

    await walk('');

    return gitOk ? list : null;
};

// =========================================================================================

const removeListHandler = async (removeList) => {
    const len = removeList.length;
    if (!len) {
        return;
    }
    console.log(`start to remove ${EC.green(len)} items ...`);
    for (const item of removeList) {
        if (!fs.existsSync(`${state.root}/${item}`)) {
            continue;
        }
        console.log(`removing ${item} ...`);
        const done = await rm(item);
        if (done) {
            console.log(`${EC.green('removed')} ${item}`);
        } else {
            console.log(EC.red(`failed to remove: ${item}`));
        }
    }
};

// =========================================================================================

const cleanModule = async () => {
    const time_start = Date.now();
    console.log('clean project files ...');

    process.chdir(state.root);

    const isWindows = process.platform === 'win32';
    if (isWindows) {
        logCyan('Try following to improve File System performance on win32 platform:');
        console.log(' 1, Whitelist project folder from Anti Virus');
        console.log(' 2, Whitelist npm/Yarn cache directory from Anti Virus');
        console.log(' 3, Adding node.exe to Windows Defender exclusions');
        console.log(' 4, Disabling Indexing service on Windows or node_modules folder');
        logLine();
    }

    let cleanList = await generateCleanList(state.root);
    if (cleanList === null) {
        logYellow('not a git repository, cannot check git-ignored files, skip clean');
        return;
    }
    // console.log(cleanList);

    const exclude = generateExclude();
    if (exclude) {
        console.log(`generated ignore items before exclude: ${EC.red(cleanList.length)}`);
        cleanList = cleanList.filter((item) => !exclude.ignores(item));
        console.log(`generated ignore items after exclude: ${EC.red(cleanList.length)}`);
    } else if (cleanList.length) {
        console.log(`generated ignore items: ${EC.red(cleanList.length)}`);
    }

    // debug
    if (state.option.debug) {
        logYellow('debug mode does not perform delete operations');
        return;
    }

    await removeListHandler(cleanList);

    if (state.option.git) {
        await tasksResolver([
            'git reset --hard',
            'git clean -df'
        ]);
    }

    const duration = Date.now() - time_start;
    console.log(`clean duration: ${TF(duration)}`);
    logGreen('clean done');

};

export default cleanModule;
