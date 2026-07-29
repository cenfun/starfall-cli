import {
    state, isGitProject, getProjectConf, replace, goTo, getGitBranch, logYellow, tasksResolver, logGreen
} from '../core/util.js';

const commitVersion = (prevVersion, changes) => {
    if (!isGitProject()) {
        console.log('Undetected .git folder and ignore commit version');
        return 0;
    }

    console.log('commit new version ...');

    let message = state.option.message || 'updated version: {prevVersion} => {version}';
    const newVersion = getProjectConf(true).version;
    message = replace(message, {
        prevVersion: prevVersion,
        version: newVersion
    });

    const tasks = [];
    tasks.push(() => {
        return goTo(state.root);
    });
    tasks.push(async () => {
        // after go to root
        const branch = await getGitBranch();
        console.log(`current branch: ${branch}`);
        return `git checkout ${branch}`;
    });

    tasks.push('git add package.json');
    if (changes) {
        changes.forEach((f) => {
            tasks.push(`git add ${f}`);
        });
    }
    tasks.push(`git commit --no-verify -m "${message}"`);

    const version = getProjectConf('version');
    tasks.push(`git tag -l "${version}"`);

    // check exist version tag
    tasks.push((option) => {
        let prevTag = `${option.stdout}`;
        prevTag = prevTag.trim();
        if (prevTag) {
            logYellow(`found exist tag: ${version}`);
            return `git tag -d "${version}"`;
        }
        option.cmd = '';
        return 0;
    });

    tasks.push((option) => {
        if (option.cmd) {
            if (state.option.debug) {
                return 0;
            }
            return `git push origin --delete tag "${version}"`;
        }
        return 0;
    });

    tasks.push(`git tag "${version}"`);

    if (state.option.debug) {
        logYellow(`ignore "git push origin" tag in debug mode: ${version}`);
    } else {
        tasks.push('git push origin');
        tasks.push(`git push origin "${version}"`);
    }

    const exitCode = tasksResolver(tasks);
    if (exitCode === 0) {
        logGreen(`update version success: ${version}`);
    }

    return exitCode;
};

const updateVersion = (newVersion) => {
    // [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git]
    newVersion = newVersion || 'patch';

    console.log(`update version to ${newVersion} ...`);
    const tasks = [];
    tasks.push(() => {
        return goTo(state.root);
    });

    if (isGitProject()) {
        // before update version, should git reset package.json
        tasks.push('git checkout package.json');
    }

    tasks.push(`npm version ${newVersion} --no-git-tag-version`);
    return tasksResolver(tasks);
};

const versionModule = async (newVersion) => {
    const prevVersion = getProjectConf('version');
    let exitCode = await updateVersion(newVersion);
    if (exitCode === 0) {
        exitCode = await commitVersion(prevVersion);
    }
    process.exit(exitCode);
};

versionModule.updateVersion = updateVersion;
versionModule.commitVersion = commitVersion;

export default versionModule;
