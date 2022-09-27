const path = require('path');
const webpack = require('webpack');
const WSR = require('webpack-stats-report');
const Util = require('../core/util.js');

const startWebpack = function(conf) {
    return new Promise(function(resolve) {
        webpack(conf, (err, stats) => {
            resolve({
                err,
                stats
            });
        });
    });
};

// https://webpack.js.org/configuration/stats/
const reportHandler = async (webpackResults, statsReportOptions, relPath) => {

    const { err, stats } = webpackResults;

    // error for webpack self
    if (err) {
        Util.logRed(err.stack || err);
        if (err.details) {
            Util.logRed(err.details);
        }
        return;
    }

    //save stats report
    statsReportOptions.stats = stats;
    const statsReport = await WSR.StatsReportGenerator(statsReportOptions);

    const reportPath = Util.relativePath(statsReportOptions.output);

    const statsData = statsReport.statsData;
    if (!statsData) {
        Util.logRed(`failed to save stats report: ${reportPath}`);
        return;
    }

    Util.logEnd(`generated stats report: ${reportPath}`);

    //console.log(statsReport);
    //add outputFile for report list name
    statsData.outputFile = statsReport.output;

    const report = stats.toJson();
    report.statsData = statsData;

    // error for project
    if (stats.hasErrors()) {
        Util.logRed(`ERROR: Found ${report.errors.length} Errors on building ${relPath}`);
        report.errors.forEach(function(item, i) {
            const msg = item.stack || item.message;
            Util.logRed(`【${i + 1}】 ${msg}`);
        });
        return;
    }

    if (stats.hasWarnings()) {
        Util.logYellow(`WARN: Found ${report.warnings.length} Warnings on building ${relPath} (check detail from html stats report)`);
        report.warnings.forEach(function(item, i) {
            // no details for warning
            const msg = item.message || item.stack;
            Util.logYellow(`【${i + 1}】 ${msg}`);
        });
    }

    return report;

};

const packModule = async (conf, statsReportOptions) => {

    if (!conf) {
        Util.logRed('ERROR: Invalid webpack config');
        return;
    }

    const webpackConfig = Util.getConfig('build.webpackConfig');
    if (webpackConfig) {
        const newConf = await webpackConfig(conf, Util);
        if (newConf) {
            conf = newConf;
        }
    }

    const startTime = new Date().getTime();
    const file = path.resolve(conf.output.path, conf.output.filename);
    const relPath = Util.relativePath(file);
    Util.log(`start webpack: ${relPath} ...`);

    const webpackResults = await startWebpack(conf);

    const report = await reportHandler(webpackResults, statsReportOptions, relPath);

    const cost = (new Date().getTime() - startTime).toLocaleString();
    Util.log(`webpack cost: ${cost}ms`);

    return report;
};

module.exports = packModule;
