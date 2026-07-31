import fs from 'node:fs';
import path from 'node:path';
import { execaSync } from 'execa';
import EC from 'eight-colors';

import { state } from '../core/util.js';

const fail = function(message) {
    console.error(EC.red(message));
    process.exit(1);
};

const run = function(command, args, options = {}) {
    if (!options.silent) {
        console.log(EC.magenta(`> ${command} ${args.join(' ')}`));
    }
    const result = execaSync(command, args, {
        cwd: state.root,
        reject: false,
        stdio: options.capture ? 'pipe' : 'inherit'
    });
    if (result.failed) {
        const details = options.capture ? `\n${result.stderr || result.stdout}` : '';
        throw new Error(`Command failed (${result.exitCode}): ${command} ${args.join(' ')}${details}`);
    }
    return options.capture ? result.stdout.trim() : '';
};

const publishModule = () => {

    const packagePath = path.resolve(state.root, 'package.json');
    const requestedVersion = state.option.version;
    const releaseType = requestedVersion || 'patch';

    const originalPackageContent = fs.readFileSync(packagePath, 'utf8');
    const currentVersion = JSON.parse(originalPackageContent).version;
    let nextVersion;
    let startHead;

    try {
        const status = run('git', ['status', '--porcelain'], {
            capture: true,
            silent: true
        });
        if (status) {
            throw new Error(`Git working tree is not clean. Commit or stash changes first:\n${status}`);
        }

        startHead = run('git', ['rev-parse', 'HEAD'], {
            capture: true,
            silent: true
        });

        console.log(EC.magenta(`Preparing ${releaseType} release from ${currentVersion}`));
        run('npm', ['version', releaseType, '-m', 'chore(release): %s']);

        nextVersion = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
        console.log(`Version: ${EC.cyan(currentVersion)} -> ${EC.green(nextVersion)}`);

        console.log(EC.green(`\nRelease ${nextVersion} prepared successfully.`));
        console.log(EC.magenta('Next steps (run manually):'));
        console.log(`1. ${EC.cyan('git push && git push --tags')}`);
        console.log(`2. ${EC.cyan('npm login')}`);
        console.log(`3. ${EC.cyan('npm publish')}`);
    } catch (error) {
        if (startHead) {
            const currentHead = run('git', ['rev-parse', 'HEAD'], {
                capture: true,
                silent: true
            });
            if (currentHead === startHead) {
                fs.writeFileSync(packagePath, originalPackageContent);
                execaSync('git', ['reset', '--quiet', '--', 'package.json', 'package-lock.json'], {
                    cwd: state.root,
                    reject: false,
                    stdio: 'ignore'
                });
            }
        }
        fail(`Release failed: ${error.stack || error.message}`);
    }

};

export default publishModule;
