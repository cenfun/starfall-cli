const chokidar = require('chokidar');
const Util = require('../core/util.js');

const Watcher = function(onChange) {
    this.onChange = onChange;
    this.init();
};

Watcher.prototype = {

    init: function() {

        //for src build
        let srcGlob = `${Util.root}/src/**`;
        if (Util.componentsRoot) {
            srcGlob = `${Util.componentsRoot}/*/src/**`;
        }

        //for test build
        let testGlob = `${Util.root}/test/**`;
        if (Util.componentsRoot) {
            testGlob = `${Util.componentsRoot}/*/test/**`;
        }

        //for preview
        const previewPath = Util.getSetting('previewPath');
        let previewGlob = `${Util.root}/${previewPath}/**`;
        if (Util.componentsRoot) {
            previewGlob = `${Util.componentsRoot}/*/${previewPath}/**`;
        }

        //for build preview
        const buildPath = Util.getSetting('buildPath');
        let buildGlob = `${Util.root}/${buildPath}/**`;
        if (Util.componentsRoot) {
            buildGlob = `${Util.componentsRoot}/*/${buildPath}/**`;
        }

        this.watcher = chokidar.watch([srcGlob, testGlob, previewGlob, buildGlob], {
            cwd: Util.root,
            ignoreInitial: true,
            persistent: true
        });

        this.watcher.on('add', (path) => {
            this.watchEventHandler('add', path);
        }).on('change', (path) => {
            this.watchEventHandler('change', path);
        }).on('unlink', (path) => {
            this.watchEventHandler('unlink', path);
        }).on('addDir', (path) => {
            this.watchEventHandler('addDir', path);
        }).on('unlinkDir', (path) => {
            this.watchEventHandler('unlinkDir', path);
        }).on('error', (error) => {
            console.log(error);
        });
    },

    watchEventHandler: function(type, path) {

        path = Util.formatPath(path);

        console.log(type, path);

        //ignore .map
        if (path.substr(path.length - 4) === '.map') {
            return;
        }

        clearTimeout(this.timeout_watch_build);
        this.timeout_watch_build = setTimeout(() => {
            let name = '';
            let folder = '';

            //components\[name]\[src/test]\*.js
            //subsPath, name, folder
            const list = path.split(/\/+|\\+/);
            if (Util.componentsRoot) {
                name = list[1];
                folder = list[2];
            } else {
                //single component
                const pc = Util.getProjectConf();
                name = pc.name;
                folder = list[0];
            }

            const res = {
                type,
                path,
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
            if (typeof(callback) === 'function') {
                callback.call(this, res);
            }
        }
    });
};

module.exports = watchModule;
