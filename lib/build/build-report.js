const fs = require("fs");
const path = require("path");
const shelljs = require("shelljs");
const Util = require("../core/util.js");
const EC = Util.EC;

const getConsoleRowItem = function(report, rows) {
    const statsData = report.statsData;
    //map for minify json path
    const map = statsData.map;
    statsData.assets.subs.forEach(asset => {
        const item = Object.assign({}, asset);
        item.index = rows.length + 1;
        item.name = map[item.name];
        item.modules = statsData.modules.subs.length;
        item.timestamp = statsData.info.timestamp;
        item.duration = report.stats.time;
        rows.push(item);
    });
    
};

const getHtmlRowItem = function(report, typeColumns) {
    const statsData = report.statsData;
    const map = statsData.map;
    const asset = statsData.assets.subs[0];
    const item = Object.assign({}, asset);

    item.name = map[item.name];
    item.size_label = Util.BF(item.size);

    item.output = path.basename(report.output);
    item.timestamp = statsData.info.timestamp;

    item.duration = report.stats.time;
    item.duration_label = Util.TF(item.duration, "ms");
   
    item.warnings = statsData.info.warnings.length;
    item.errors = statsData.info.errors.length;
   
    item.modules = statsData.modules.subs.length;
    if (!typeColumns.length) {
        Object.values(statsData.info.moduleTypes).forEach(mt => {
            typeColumns.push({
                id: mt.type,
                name: mt.type,
                color: mt.color,
                align: "right"
            });
        });
    }

    const typeInfo = {};
    typeColumns.forEach(tc => {
        typeInfo[tc.id] = 0;
    });

    statsData.modules.subs.forEach(sub => {
        typeInfo[sub.type] += 1;
    });

    typeColumns.forEach(tc => {
        const id = tc.id;
        const count = typeInfo[id];
        item[id] = count;
        if (count > 0 && tc.color) {
            item[`${id}_color`] = tc.color;
        }
    });

    return item;
};

const getReportData = function(report) {

    const typeColumns = [];
    const rows = [];
    report.jobList.forEach((job) => {
        if (job.report) {
            rows.push(getHtmlRowItem(job.report, typeColumns));
        }
        if (job.reportPreview) {
            rows.push(getHtmlRowItem(job.reportPreview, typeColumns));
        }
    });
    
    const modules = {
        id: "moduleTypes",
        name: "Modules",
        align: "center",
        subs: [{
            id: "modules",
            name: "Total",
            align: "right",
            width: 60
        }]
    };
    
    typeColumns.forEach(tc => {
        modules.subs.push(tc);
    });

    const columns = [{
        id: "name",
        name: "Name",
        width: 350,
        maxWidth: 2048
    }, {
        id: "size",
        name: "Size",
        align: "right",
        width: 80
    }, modules, {
        id: "warnings",
        name: "Warnings",
        align: "right",
        width: 70
    }, {
        id: "errors",
        name: "Errors",
        align: "right",
        width: 65
    }, {
        id: "duration",
        name: "Duration",
        align: "right",
        width: 80
    }];

    const data = {
        columns: columns,
        rows: rows
    };

    return data;
};

const showConsoleReport = (report) => {
    console.log("Build Report");
    const rows = [];
    report.jobList.forEach((job) => {
        if (!job.report) {
            rows.push({
                index: rows.length + 1,
                name: EC.red(job.name)
            });
            return;
        }
        getConsoleRowItem(job.report, rows);
        if (!job.reportPreview) {
            return;
        }
        getConsoleRowItem(job.reportPreview, rows);
    });

    Util.consoleGrid.render({
        option: {
            hideHeaders: false
        },
        columns: [{
            id: "index",
            name: "No.",
            align: "right"
        }, {
            id: "name",
            name: "Bundle File",
            maxWidth: 200
        }, {
            id: "size",
            name: "Size",
            align: "right",
            formatter: function(v, rowData) {
                const sizeH = Util.BF(v);
                if (rowData.size_color) {
                    return Util.addColor(sizeH, rowData.size_color);
                }
                return sizeH;
            }
        }, {
            id: "modules",
            name: "Modules",
            align: "right"
        }, {
            id: "duration",
            name: "Duration",
            align: "right",
            formatter: function(v) {
                return Util.TF(v, "ms");
            }
        }],
        rows: rows
    });
};

const generateHtmlReport = async (report) => {
    const tempPath = path.resolve(__dirname, "./build-report-template.html");
    const template = Util.readFileContentSync(tempPath);
    let html = Util.replace(template, {
        title: "Build Report",
        about: Util.getAbout("build", "Build")
    });

    let content = Util.getGridContent();
    const reportData = getReportData(report);
    content += `\nthis.reportData = ${JSON.stringify(reportData)};`;

    /*inject:start*/
    /*inject:end*/
    const scriptBlock = /(([ \t]*)\/\*\s*inject:start\s*\*\/)(\r|\n|.)*?(\/\*\s*inject:end\s*\*\/)/gi;
    const hasScriptBlock = scriptBlock.test(html);
    if (hasScriptBlock) {
        const EOL = Util.getEOL();
        html = html.replace(scriptBlock, function(match) {
            const list = [arguments[1]].concat(content).concat(arguments[4]);
            const str = list.join(EOL + arguments[2]);
            return str;
        });
    }

    const reportPath = `${Util.getTempRoot()}/build/`;
    if (!fs.existsSync(reportPath)) {
        shelljs.mkdir("-p", reportPath);
    }
    const htmlPath = `${reportPath}build-report.html`;
    Util.writeFileContentSync(htmlPath, html, true);

    Util.logCyan(`generated build report: ${Util.relativePath(htmlPath)}`);

    //open report
    if (Util.option.open) {
        await Util.open(htmlPath);
    }

};

const reportHandler = async (report) => {

    //sort job by name first
    report.jobList.sort(function(a, b) {
        if (a.name > b.name) {
            return 1;
        }
        if (a.name < b.name) {
            return -1;
        }
        return 0;
    });

    showConsoleReport(report);

    await generateHtmlReport(report);

};

module.exports = reportHandler;
