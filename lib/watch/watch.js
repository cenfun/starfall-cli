const chokidar = require('chokidar');
const Util = require('../core/util.js');
const Ignore = require('../core/ignore.js');
class Watcher {

    constructor(onChange) {
        this.onChange = onChange;

        this.list = [];

        this.watcher = chokidar.watch(Util.root, {
            cwd: Util.root,
            ignoreInitial: true,
            persistent: true,
            ignored: this.getIgnored()
        });

        this.watcher.on('add', (p) => {
            this.changeHandler('add', p);
        }).on('change', (p) => {
            this.changeHandler('change', p);
        }).on('unlink', (p) => {
            this.changeHandler('unlink', p);
        // }).on('addDir', (p) => {
        //     this.changeHandler('addDir', p);
        // }).on('unlinkDir', (p) => {
        //     this.changeHandler('unlinkDir', p);
        // }).on('error', (error) => {
        //     console.log(error);
        });

    }

    getIgnored() {
        const ignoreRules = Ignore.getProjectIgnoreRules();

        if (!ignoreRules) {
            return;
        }

        let ignored = ignoreRules.map((item) => {
            // remove start /
            return item.replace(/^\//g, '');
        });

        // remove temp/packages/build/dev/
        const tempPath = Util.relativePath(Util.getTempRoot());
        const list = [tempPath];
        if (Util.componentsRoot) {
            list.push('packages/');
        } else {
            const buildPath = Util.getConfig('build.path');
            const devPath = Util.getConfig('dev.path');
            list.push(buildPath);
            list.push(devPath);
        }

        ignored = ignored.filter((item) => {
            return !list.find((p) => item.startsWith(p));
        });

        // add map
        ignored.push('**/*.map');

        // console.log('ignored', ignored);

        return ignored;
    }

    changeHandler(event, p) {
        this.list.push({
            event,
            path: Util.formatPath(p)
        });
        clearTimeout(this.timeout_watch_build);
        this.timeout_watch_build = setTimeout(() => {
            const list = [].concat(this.list);
            this.list = [];
            this.onChange(list);
        }, 200);
    }

    close() {
        clearTimeout(this.timeout_watch_build);
        this.list = [];
        this.onChange = null;
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

}

const getChangedFile = (changeList, fileList) => {
    return changeList.find((item) => {
        const p = item.path;
        return fileList.find((f) => {
            if (f === p) {
                return true;
            }
            const re = new RegExp(f);
            if (re.test(p)) {
                return true;
            }
        });
    });
};

const initComponentInfo = (cfn) => {
    // cfn component folder name
    const buildPath = Util.getConfig('build.path');
    const devPath = Util.getConfig('dev.path');

    if (Util.componentsRoot) {
        return {
            name: cfn,
            src: `packages/${cfn}/src/`,
            build: `packages/${cfn}/${buildPath}/`,
            dev: `packages/${cfn}/${devPath}/`,
            test: `packages/${cfn}/test/`
        };
    }

    return {
        name: cfn,
        src: 'src/',
        build: `${buildPath}/`,
        dev: `${devPath}/`,
        test: 'test/'
    };

};

const getChangedComponent = (changeList, componentList) => {
    return changeList.find((item) => {
        const p = item.path;
        return componentList.find((c) => {
            return ['src', 'build', 'dev', 'test'].find((type) => {
                if (p.startsWith(c[type])) {
                    item.name = c.name;
                    item.type = type;
                    return true;
                }
            });
        });
    });
};

const watchModule = function(componentList, fileList, callback) {
    componentList = Util.toList(componentList).map((cfn) => initComponentInfo(cfn));

    if (fileList) {
        fileList = Util.toList(fileList);
    }

    return new Watcher(function(changeList) {

        // console.log('changeList', changeList);

        if (fileList) {
            const info = getChangedFile(changeList, fileList);
            if (info) {
                callback(info);
                return;
            }
        }

        const info = getChangedComponent(changeList, componentList);
        if (info) {
            callback(info);
        }

    });
};

module.exports = watchModule;
