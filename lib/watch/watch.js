const chokidar = require('chokidar');
const Util = require('../core/util.js');
const Ignore = require('../core/ignore.js');
const Watcher = function(onChange) {
    this.onChange = onChange;
    this.init();
};

Watcher.prototype = {

    init: function() {

        // for src build
        let srcGlob = `${Util.root}/src/**`;
        let srcRules = 'src/*';
        if (Util.componentsRoot) {
            srcGlob = `${Util.componentsRoot}/*/src/**`;
            srcRules = 'packages/*/src/*';
        }

        const srcIgnore = Ignore.createIgnore([srcRules]);
        // console.log(srcIgnore);

        // for test build
        let testGlob = `${Util.root}/test/**`;
        if (Util.componentsRoot) {
            testGlob = `${Util.componentsRoot}/*/test/**`;
        }

        // for dev
        const devPath = Util.getConfig('dev.path');
        let devGlob = `${Util.root}/${devPath}/**`;
        if (Util.componentsRoot) {
            devGlob = `${Util.componentsRoot}/*/${devPath}/**`;
        }

        // for build dev
        const buildPath = Util.getConfig('build.path');
        let buildGlob = `${Util.root}/${buildPath}/**`;
        if (Util.componentsRoot) {
            buildGlob = `${Util.componentsRoot}/*/${buildPath}/**`;
        }

        this.watcher = chokidar.watch([srcGlob, testGlob, devGlob, buildGlob], {
            cwd: Util.root,
            ignoreInitial: true,
            persistent: true
        });

        this.watcher.on('add', (dir) => {
            this.watchEventHandler('add', dir, srcIgnore);
        }).on('change', (dir) => {
            this.watchEventHandler('change', dir, srcIgnore);
        }).on('unlink', (dir) => {
            // Do NOT update when removing a file like a dist file, it will be a error if reload
        }).on('addDir', (dir) => {
            this.watchEventHandler('addDir', dir, srcIgnore);
        }).on('unlinkDir', (dir) => {
            // same as unlink
            console.log(`watch: unlink dir: ${dir}`);
        }).on('error', (error) => {
            console.log(error);
        });
    },

    watchEventHandler: function(type, dir, srcIgnore) {

        dir = Util.formatPath(dir);
        // console.log(type, dir);

        // ignore .map
        if (dir.substr(dir.length - 4) === '.map') {
            return;
        }

        // ignore .gitignore rules in src
        if (Ignore.isIgnored(srcIgnore, dir) && Ignore.isProjectIgnored(dir)) {
            // Util.logYellow(`ignore watch: ${dir}`);
            return;
        }

        clearTimeout(this.timeout_watch_build);
        this.timeout_watch_build = setTimeout(() => {
            let name = '';
            let folder = '';

            // components\[name]\[src/test]\*.js
            // packages, name, folder
            const list = dir.split(/\/+|\\+/);
            if (Util.componentsRoot) {
                name = list[1];
                folder = list[2];
            } else {
                // single component
                const pc = Util.getProjectConf();
                name = pc.name;
                folder = list[0];
            }

            const res = {
                type,
                path: dir,
                name,
                folder
            };

            this.onChange(res);

        }, 100);

    },

    close: function() {
        clearTimeout(this.timeout_watch_build);
        this.onChange = null;
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

};

const watchModule = function(list, callback) {
    list = Util.toList(list);
    return new Watcher(function(res) {
        if (Util.inList(res.name, list)) {
            if (typeof callback === 'function') {
                callback.call(this, res);
            }
        }
    });
};

module.exports = watchModule;
