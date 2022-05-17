const Util = require('../core/util.js');
const EC = Util.EC;
const Table = require('../core/table.js');

const getReportData = (report, html) => {

    const columns = [{
        id: 'index',
        name: 'No.'
    }, {
        id: 'name',
        name: 'Component Name'
    }, {
        id: 'aVersion',
        name: 'Version AB',
        formatter: function(v, row) {
            if (html || row.className === 'diff-na') {
                return row.abHeadHtml;
            }
            return `${row.aResolvedVersion} - ${row.bResolvedVersion}`;
        }
    }, {
        id: 'added',
        name: '+',
        formatter: function(v) {
            if (v > 0) {
                return Util.addColor(v, 'green', html);
            }
            return v;
        }
    }, {
        id: 'deleted',
        name: '-',
        formatter: function(v) {
            if (v > 0) {
                return Util.addColor(v, 'red', html);
            }
            return v;
        }
    }, {
        id: 'status',
        name: 'Status',
        formatter: function(v, row) {
            if (row.total > 0) {
                if (html) {
                    return `<a href="./${row.name}.html" target="_blank">${v}</a>`;
                }
                return EC.magenta(v);
                
            }
            return v;
        }
    }];

    const rows = [];
    report.jobList.forEach(function(job, i) {
        const row = {
            index: i + 1,
            name: job.name,
            status: 'Changed'
        };
        const jobReport = job.report;
        if (jobReport) {
            Object.assign(row, jobReport);
            row.total = jobReport.added + jobReport.deleted;
            if (row.total === 0) {
                row.className = 'diff-no-change';
                row.status = 'No change';
            } else {
                row.className = 'diff-changed';
            }
        } else {
            Object.assign(row, {
                abHeadHtml: job.errorMsg || 'N/A',
                aVersion: '',
                bVersion: '',
                aResolvedVersion: '-',
                bResolvedVersion: '-',
                added: '-',
                deleted: '-',
                total: 0,
                status: 'N/A',
                className: 'diff-na'
            });
        }
        rows.push(row);
    });

    return {
        option: {
            hideHeaders: false,
            styleHead: {
                // "font-family": "monospace"
            }
        },
        columns: columns,
        rows: rows
    };
};

const reportHandler = async (report, config) => {

    // console log
    const gridData = getReportData(report, false);
    const title = 'Diff report';
    console.log(title);
    Util.consoleGrid.render(gridData);

    const subtitle = `
    <div>
        <label>
            <input id="only-change" type="checkbox" onchange="onlyChangedHandler()" style="vertical-align:middle;margin-bottom:5px;" />
            Only Changed
        </label>
    </div>
    `;

    // html report
    const tableData = getReportData(report, true);
    const content = Table.generateHtml(tableData);
    const diffTemplate = Util.getTemplate(`${__dirname}/diff-template.html`);
    const html = Util.replace(diffTemplate, {
        title: title,
        subtitle: subtitle,
        heads: '',
        content: content,
        about: Util.getAbout('diff', 'Diff')
    });

    const reportPath = `${report.jobFolder}/index.html`;
    Util.writeFileContentSync(reportPath, html, true);

    console.log(`${EC.green('saved')} diff report: ${Util.relativePath(reportPath)}`);

    if (Util.option.open) {
        await Util.open(reportPath);
    }

};

module.exports = reportHandler;
