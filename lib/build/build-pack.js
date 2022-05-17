const path = require('path');
const webpack = require('webpack');
const Util = require('../core/util.js');

const packStart = function(conf) {
    return new Promise(function(resolve) {

        // no conf
        if (!conf) {
            Util.logRed('ERROR: Invalid webpack config');
            resolve(1);
            return;
        }

        const now = new Date().getTime();

        const file = path.resolve(conf.output.path, conf.output.filename);
        const relPath = Util.relativePath(file);
        Util.logWorker(`start webpack: ${relPath} ...`);

        // console.log(conf);
        const callback = function(err, stats) {
            
            // https://webpack.js.org/configuration/stats/
            // console.log(stats.toString({
            //     maxModules: 300,
            //     colors: true
            // }));


            // error for webpack self
            if (err) {
                Util.logRed(err.stack || err);
                if (err.details) {
                    Util.logRed(err.details);
                }
                resolve(1);
                return;
            }

            const info = stats.toJson({
                // source for gzip
                source: true,
                reasons: false,
                chunkModules: false
            });

            // save report
            conf.report = info;

            // error for project
            if (stats.hasErrors()) {
                Util.logRed(`ERROR: Found ${info.errors.length} Errors on building ${relPath}`);
                info.errors.forEach(function(item, i) {
                    const msg = item.stack || item.message;
                    Util.logRed(`【${i + 1}】 ${msg}`);
                });
                resolve(1);
                return;
            }

            if (stats.hasWarnings()) {
                Util.logYellow(`WARN: Found ${info.warnings.length} Warnings on building ${relPath} (check detail from html stats report)`);
                info.warnings.forEach(function(item, i) {
                    // no details for warning
                    const msg = item.message || item.stack;
                    Util.logYellow(`【${i + 1}】 ${msg}`);
                });
            }

            const cost = (new Date().getTime() - now).toLocaleString();
            console.log(`webpack cost: ${cost}ms`);

            // no error
            setTimeout(function() {
                resolve(0);
            }, 100);

        };

        try {
            webpack(conf, callback);
        } catch (e) {
            Util.logRed(e);
            resolve(1);
        }

    });
};

const packModule = async (conf) => {
    const webpackConfig = Util.getConfig('build.webpackConfig');
    if (webpackConfig) {
        const newConf = await webpackConfig(conf, Util);
        if (newConf) {
            conf = newConf;
        }
    }
    return packStart(conf);
};

module.exports = packModule;
