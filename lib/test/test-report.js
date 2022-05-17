const istanbulLibCoverage = require('istanbul-lib-coverage');
const istanbulLibReport = require('istanbul-lib-report');
const istanbulReports = require('istanbul-reports');
const Util = require('../core/util.js');
const EC = Util.EC;

const getExitError = (job, option) => {
    const list = [`ERROR: Unit test failed (${job.name})\n`];
    if (Util.isList(option.failedList)) {
        option.failedList.forEach((item, i) => {
            const index = i + 1;
            list.push(`${index}, ${item.title}`);
            list.push(`${item.errorMsg}\n`);
        });
        return list.join('\n');
    }

    if (option.summary && option.summary.tests === 0) {
        list.push('No tests started');
        return list.join('\n');
    }

};

const generateTestReport = (job, summary) => {
    if (!summary) {
        return;
    }

    Util.logMsg(job.name, 'unit test summary');
    job.summary = summary;
    Util.logObject(summary);
};

const generateCoverageReport = (job, coverage) => {

    // Not found istanbul coverage (window.__coverage__);
    if (!coverage) {
        return;
    }

    Util.logMsg(job.name, 'coverage report');

    // https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-lib-coverage
    const coverageMap = istanbulLibCoverage.createCoverageMap(coverage);
    const summary = istanbulLibCoverage.createCoverageSummary();
    coverageMap.files().forEach(function(f) {
        const fc = coverageMap.fileCoverageFor(f);
        const s = fc.toSummary();
        summary.merge(s);
    });

    const jobReport = summary.data;
    const rows = [];
    Object.keys(jobReport).forEach((key) => {
        const row = jobReport[key];
        row.name = key;
        row.uncovered = row.total - row.covered;
        if (row.total === 0) {
            row.percent = '-';
        } else {
            row.percent = Util.getCoveragePercent(row.covered, row.total);
        }
        rows.push(row);
    });
    rows.push({
        innerBorder: true
    });
    const rowCoverage = {
        name: 'coverage',
        total: jobReport.lines.total + jobReport.branches.total,
        covered: jobReport.lines.covered + jobReport.branches.covered
    };
    rowCoverage.uncovered = rowCoverage.total - rowCoverage.covered;
    rowCoverage.percent = Util.getCoveragePercent(rowCoverage.covered, rowCoverage.total);
    rows.push(rowCoverage);
    Util.consoleGrid.render({
        rows: rows,
        columns: [{
            id: 'name',
            name: 'Name'
        }, {
            id: 'total',
            name: 'Total',
            align: 'right'
        }, {
            id: 'covered',
            name: 'Covered',
            align: 'right'
        }, {
            id: 'uncovered',
            name: 'Uncovered',
            align: 'right'
        }, {
            id: 'percent',
            name: 'Percent',
            align: 'right'
        }]
    });

    job.coverageReport = jobReport;

    // for coverage reporters
    const coveragePath = `${Util.getTempRoot()}/coverage/${job.name}`;

    const configWatermarks = {
        statements: [50, 80],
        functions: [50, 80],
        branches: [50, 80],
        lines: [50, 80]
    };

    // https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-lib-report
    // create a context for report generation
    const context = istanbulLibReport.createContext({
        dir: coveragePath,
        // The summarizer to default to (may be overridden by some reports)
        // values can be nested/flat/pkg. Defaults to 'pkg'
        defaultSummarizer: 'nested',
        watermarks: configWatermarks,
        coverageMap
    });

    const htmlReport = istanbulReports.create('html', {});
    htmlReport.execute(context);

    const htmlCoverageReport = `${coveragePath}/index.html`;
    console.log(`${EC.green('saved')} html coverage report: ${Util.relativePath(htmlCoverageReport)}`);
    job.htmlCoverageReport = htmlCoverageReport;

    const lcovReport = istanbulReports.create('lcovonly', {});
    lcovReport.execute(context);

    const lcovCoverageReport = `${coveragePath}/lcov.info`;
    console.log(`${EC.green('saved')} lcov coverage report: ${Util.relativePath(lcovCoverageReport)}`);
    job.lcovCoverageReport = lcovCoverageReport;

};

const generateJobReport = (job, option) => {
    if (!option) {
        return 0;
    }

    const exitError = getExitError(job, option);
    if (exitError) {
        job.exitError = exitError;
        return 1;
    }

    generateTestReport(job, option.summary);
    generateCoverageReport(job, option.coverage);

    return 0;
};

const generateReport = (option) => {

    if (Util.option.debug) {
        return;
    }

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

    const overall = {
        total: 0,
        covered: 0
    };

    const summary = {
        suites: 0,
        tests: 0,
        skipped: 0,
        failed: 0,
        passed: 0
    };

    rows = rows.map(function(job, i) {
        let name = job.name;
        if (job.code !== 0) {
            name = EC.red(name);
        }
        const item = {
            index: i + 1,
            name: name,
            duration: Util.TF(job.duration)
        };

        const js = job.summary;
        if (js) {
            summary.suites += js.suites;
            summary.tests += js.tests;
            summary.skipped += js.skipped;
            summary.failed += js.failed;
            summary.passed += js.passed;
        }

        // Istanbul summary report: coverage-summary.json
        const jcr = job.coverageReport;
        if (jcr) {
            // for summary
            item.statements = Util.getCoveragePercent(jcr.statements.covered, jcr.statements.total);
            item.functions = Util.getCoveragePercent(jcr.functions.covered, jcr.functions.total);
            item.branches = Util.getCoveragePercent(jcr.branches.covered, jcr.branches.total);
            item.lines = Util.getCoveragePercent(jcr.lines.covered, jcr.lines.total);

            // coverage
            const itemCovered = jcr.lines.covered + jcr.branches.covered;
            const itemTotal = jcr.lines.total + jcr.branches.total;
            overall.total += itemTotal;
            overall.covered += itemCovered;

            item.coverage = Util.getCoveragePercent(itemCovered, itemTotal);

            // uncovered
            item.linesUncovered = jcr.lines.total - jcr.lines.covered;
            item.branchesUncovered = jcr.branches.total - jcr.branches.covered;

        }

        return item;
    });

    console.log('Unit Test Overview');
    Util.logObject(summary);

    const coverage = Util.getCoveragePercent(overall.covered, overall.total);
    console.log(`Coverage Overview ${coverage}`);

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
            id: 'statements',
            name: 'S %',
            align: 'right'
        }, {
            id: 'functions',
            name: 'F %',
            align: 'right'
        }, {
            id: 'branches',
            name: 'B %',
            align: 'right'
        }, {
            id: 'lines',
            name: 'L %',
            align: 'right'
        }, {
            id: 'coverage',
            name: 'Coverage',
            align: 'right'
        }, {
            id: 'linesUncovered',
            name: 'UL',
            align: 'right'
        }, {
            id: 'branchesUncovered',
            name: 'UB',
            align: 'right'
        }, {
            id: 'duration',
            name: 'Duration',
            align: 'right'
        }],
        rows: rows
    });
    console.log('S: Statements, F: Functions, B: Branches, L: Lines, U: Uncovered');
    console.log('Coverage = Covered Branches and Lines / Total Branches and Lines');

};

const Report = {
    generateJobReport: generateJobReport,
    generateReport: generateReport
};

module.exports = Report;
