const Util = require('../core/util.js');

const commitVersion = (prevVersion, changes) => {
    if (!Util.isGitProject()) {
        console.log('Undetected .git folder and ignore commit version');
        return 0;
    }

    console.log('commit new version ...');

    let message = Util.option.message || 'updated version: {prevVersion} => {version}';
    const newVersion = Util.getProjectConf(true).version;
    message = Util.replace(message, {
        prevVersion: prevVersion,
        version: newVersion
    });

    const tasks = [];
    tasks.push(() => {
        return Util.goTo(Util.root);
    });
    tasks.push(async () => {
        // after go to root
        const branch = await Util.getGitBranch();
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
    if (Util.option.debug) {
        Util.logYellow(`ignore "git push origin" version in debug mode: ${message}`);
    } else {
        tasks.push('git push origin');
    }

    return Util.tasksResolver(tasks);
};

const updateVersion = (newVersion) => {
    // [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git]
    newVersion = newVersion || 'patch';

    console.log(`update version to ${newVersion} ...`);
    const tasks = [];
    tasks.push(() => {
        return Util.goTo(Util.root);
    });

    if (Util.isGitProject()) {
        // before update version, should git reset package.json
        tasks.push('git checkout package.json');
    }

    tasks.push(`npm version ${newVersion} --no-git-tag-version`);
    return Util.tasksResolver(tasks);
};

const tagVersion = async () => {

    if (!Util.isGitProject()) {
        console.log('Undetected .git folder and ignore tag version');
        return 0;
    }

    const version = Util.getProjectConf('version');

    const tasks = [() => {
        return Util.goTo(Util.root);
    }];

    tasks.push(`git tag -l "${version}"`);

    // check exist version tag
    tasks.push((option) => {
        let prevTag = `${option.stdout}`;
        prevTag = prevTag.trim();
        if (prevTag) {
            Util.logYellow(`found exist tag: ${version}`);
            return `git tag -d "${version}"`;
        }
        option.cmd = '';
        return 0;
    });

    tasks.push((option) => {
        if (option.cmd) {
            if (Util.option.debug) {
                return 0;
            }
            return `git push origin --delete tag "${version}"`;
        }
        return 0;
    });

    tasks.push(`git tag "${version}"`);
    if (Util.option.debug) {
        Util.logYellow(`ignore "git push origin" tag in debug mode: ${version}`);
    } else {
        tasks.push(`git push origin "${version}"`);
    }

    const exitCode = await Util.tasksResolver(tasks);
    if (exitCode === 0) {
        Util.logGreen(`tag version success: ${version}`);
    }

    return exitCode;
};

const versionModule = async (newVersion) => {
    const prevVersion = Util.getProjectConf('version');
    let exitCode = await updateVersion(newVersion);
    if (exitCode === 0) {
        exitCode = await commitVersion(prevVersion);
    }
    process.exit(exitCode);
};

versionModule.updateVersion = updateVersion;
versionModule.commitVersion = commitVersion;
versionModule.tagVersion = tagVersion;

module.exports = versionModule;
