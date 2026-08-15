import fs from 'fs';
import path from 'path';
import EC from 'eight-colors';
import ignore from 'ignore';
import {
    state, getConfig, toList, rm, logYellow, TF, logGreen,
    readFileSync, setProgressTotal, showProgress, endProgress, log
} from '../core/util.js';

// progress state
const progressInfo = {
    loaded: 0,
    total: 0
};

// build exclude filter from clean.exclude config
// matched items are kept even if git-ignored
const generateExclude = function() {
    const excludeRules = toList(getConfig('clean.exclude'));
    if (!excludeRules.length) {
        return null;
    }
    const ig = ignore();
    log('clean exclude rules:', excludeRules);
    ig.add(excludeRules);
    return ig;
};

// =========================================================================================

// expand a scoped group like @babel to package level, e.g. @babel/core
// skip pnpm virtual store entries like @babel+core@7.0.0
// (they contain a node_modules child, not packages)
const getScopeUnits = (absPath, rel, name) => {
    let scoped;
    try {
        scoped = fs.readdirSync(`${absPath}/${name}`, {
            withFileTypes: true
        });
    } catch (e) {
        scoped = [];
    }
    const hasNm = scoped.some((sub) => sub.name === 'node_modules');
    if (scoped.length && !hasNm) {
        return scoped.map((sub) => `${rel}/${name}/${sub.name}`);
    }
    return null;
};

// enumerate the sub dirs and files of a drillDown dir as independent units,
// so the progress bar can show the exact sub item being removed
const getDirUnits = (item) => {
    const absPath = `${state.root}/${item}`;
    const units = [];
    if (!fs.existsSync(absPath)) {
        return units;
    }
    let children;
    try {
        children = fs.readdirSync(absPath, {
            withFileTypes: true
        });
    } catch (e) {
        return units;
    }
    for (const child of children) {
        if (child.name.startsWith('@') && child.isDirectory()) {
            const scopeUnits = getScopeUnits(absPath, item, child.name);
            if (scopeUnits) {
                scopeUnits.forEach((unit) => {
                    units.push(unit);
                });
            } else {
                units.push(`${item}/${child.name}`);
            }
        } else {
            units.push(`${item}/${child.name}`);
        }
    }
    return units;
};

// delete one item if exists, log failure
const removeOne = async (rel) => {
    if (fs.existsSync(`${state.root}/${rel}`)) {
        const done = await rm(rel);
        if (!done) {
            log(EC.red(`failed to remove: ${rel}`));
        }
    }
};

// delete a git-ignored item with progress,
// drillDown dirs are expanded into their sub dir and file units recursively
const deleteItem = async (rel, drillDown) => {
    if (drillDown.includes(path.basename(rel))) {
        const units = getDirUnits(rel);
        if (units.length) {
            // the container is already counted, add its sub units
            progressInfo.total += units.length;
            setProgressTotal(progressInfo.total);
            for (const unit of units) {
                await deleteItem(unit, drillDown);
            }
        }
    }
    progressInfo.loaded += 1;
    showProgress(progressInfo.loaded, rel);
    await removeOne(rel);
};

// =========================================================================================

// search .gitignore files under root (used when the root .gitignore is missing)
const findGitignoreList = (root) => {
    const list = [];
    const walk = (relDir) => {
        let entries;
        try {
            entries = fs.readdirSync(path.resolve(root, relDir), {
                withFileTypes: true
            });
        } catch (e) {
            return;
        }
        for (const item of entries) {
            if (item.name === '.git' || item.name === 'node_modules') {
                continue;
            }
            if (item.name === '.gitignore') {
                list.push(`${relDir}.gitignore`);
                continue;
            }
            if (item.isDirectory()) {
                walk(`${relDir}${item.name}/`);
            }
        }
    };
    walk('');
    return list;
};

// =========================================================================================

// clean state and walk helpers
const runClean = async (exclude, drillDown) => {

    const queue = [];
    const processed = new Set();

    // reset progress for repeated calls
    progressInfo.loaded = 0;
    progressInfo.total = 0;

    const enqueue = (dirRel) => {
        if (!processed.has(dirRel) && !queue.includes(dirRel)) {
            queue.push(dirRel);
        }
    };

    // matched items are kept if excluded by the clean.exclude config
    const isExcluded = (rel) => {
        if (exclude && exclude.ignores(rel)) {
            return true;
        }
        return false;
    };

    // check if a path is ignored by the current gitignore rules
    // rel is relative to root, dirRel is the gitignore dir (relative to root)
    const checkIgnore = (ig, dirRel, rel, isDir) => {
        const igRel = rel.slice(dirRel.length);
        if (ig.ignores(igRel)) {
            return true;
        }
        if (isDir && ig.ignores(`${igRel}/`)) {
            return true;
        }
        return false;
    };

    // should we descend into this dir (not .git / node_modules, not ignored)
    const shouldDescend = (item, ig, dirRel, relDir) => {
        if (item.name === '.git' || item.name === 'node_modules' || !item.isDirectory()) {
            return false;
        }
        return !checkIgnore(ig, dirRel, `${relDir}${item.name}`, true);
    };

    // handle one entry: queue sub gitignore files, collect deletable items
    const handleEntry = (item, rel, ig, dirRel, relDir, deletables) => {
        if (item.name === '.gitignore') {
            // the current gitignore file itself, skip
            if (rel === `${dirRel}.gitignore`) {
                return;
            }
            if (checkIgnore(ig, dirRel, rel, false)) {
                // rule 7: the sub gitignore is ignored, delete it directly
                deletables.push(item);
            } else {
                // process its rules later
                enqueue(relDir);
            }
            return;
        }
        if (checkIgnore(ig, dirRel, rel, item.isDirectory())) {
            if (!isExcluded(rel)) {
                deletables.push(item);
            }
        }
    };

    // walk the subtree of one gitignore, count and process the ignored items
    const walk = async (dirRel, ig, relDir) => {
        const absDir = path.resolve(state.root, relDir);
        let entries;
        try {
            entries = fs.readdirSync(absDir, {
                withFileTypes: true
            });
        } catch (e) {
            // files may change while walking, skip the vanished dir
            return;
        }
        entries = entries.filter((item) => item.name !== '.git');
        if (!entries.length) {
            return;
        }

        // collect deletable items and queue sub gitignore files
        const deletables = [];
        for (const item of entries) {
            handleEntry(item, `${relDir}${item.name}`, ig, dirRel, relDir, deletables);
        }

        // count first for the dynamic total, then delete one by one
        progressInfo.total += deletables.length;
        setProgressTotal(progressInfo.total);
        for (const item of deletables) {
            // deleteItem handles its own progress (drillDown units included)
            await deleteItem(`${relDir}${item.name}`, drillDown);
        }

        // descend into non-ignored dirs
        for (const item of entries) {
            if (shouldDescend(item, ig, dirRel, relDir)) {
                await walk(dirRel, ig, `${relDir}${item.name}/`);
            }
        }
    };

    // read and analyze one .gitignore file, then walk its subtree
    const processGitignore = async (dirRel) => {
        if (processed.has(dirRel)) {
            return;
        }
        processed.add(dirRel);
        const gitignorePath = `${state.root}/${dirRel}.gitignore`;
        const content = readFileSync(gitignorePath);
        if (!content) {
            return;
        }
        const ig = ignore();
        content.split(/\r?\n/).forEach((line) => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                ig.add(line);
            }
        });
        await walk(dirRel, ig, dirRel);
    };

    // start from the root .gitignore
    if (fs.existsSync(`${state.root}/.gitignore`)) {
        await processGitignore('');
    } else {
        // no root gitignore: search sub gitignore files
        const giList = findGitignoreList(state.root);
        if (!giList.length) {
            logYellow('not found any .gitignore file, skip clean');
            return false;
        }
        giList.forEach((gi) => {
            enqueue(gi.slice(0, -'.gitignore'.length));
        });
    }

    // process all sub gitignore files one by one
    while (queue.length) {
        const dirRel = queue.shift();
        await processGitignore(dirRel);
    }

    return true;
};

// =========================================================================================

const cleanModule = async () => {
    const time_start = Date.now();
    console.log('clean project files ...');

    process.chdir(state.root);

    const exclude = generateExclude();

    const drillDown = toList(getConfig('clean.drillDown'));
    if (drillDown.length) {
        log('clean drillDown dirs:', drillDown);
    }

    // walk the .gitignore files, count and delete the ignored items with progress
    log('clean git-ignored files ...');
    const found = await runClean(exclude, drillDown);
    endProgress();
    if (!found) {
        return;
    }

    const duration = Date.now() - time_start;
    console.log(`clean duration: ${TF(duration)}`);
    logGreen('clean done');

};

export default cleanModule;
