const Util = require('../core/util.js');
const EC = Util.EC;

const lintFormatter = (v) => {
    if (v === 0) {
        return EC.green('passed');
    }
    return EC.red('failed');
};

const reportHandler = (option) => {

    let rows = option.jobList.slice();
    rows.sort((a, b) => {
        if (a.name < b.name) {
            return -1;
        }
        if (a.name > b.name) {
            return 1;
        }
        return 0;
    });

    rows = rows.map(function(job, i) {
        let name = job.name;
        if (job.code !== 0) {
            name = EC.red(name);
        }
        const item = {
            index: i + 1,
            name: name
        };
        const jobReport = job.report;
        if (jobReport) {
            item.naming = jobReport.naming;
            item.stylelint = jobReport.stylelint;
            item.eslint = jobReport.eslint;
        }
        return item;
    });

    console.log('Lint Overview');

    Util.consoleGrid.render({
        option: {
            hideHeaders: false
        },
        columns: [{
            id: 'index',
            name: 'No.'
        }, {
            id: 'name',
            name: 'Name'
        }, {
            id: 'naming',
            name: 'naming',
            align: 'right',
            formatter: lintFormatter
        }, {
            id: 'stylelint',
            name: 'stylelint',
            align: 'right',
            formatter: lintFormatter
        }, {
            id: 'eslint',
            name: 'eslint',
            align: 'right',
            formatter: lintFormatter
        }],
        rows: rows
    });

    console.log('naming rules: lowercase-dashed/lowercase-dashed.ext');
    console.log(`stylelint rules: ${Util.relativePath(option.stylelintConfPath)}`);
    console.log(`eslint rules: ${Util.relativePath(option.eslintConfPath)}`);

};

module.exports = reportHandler;
