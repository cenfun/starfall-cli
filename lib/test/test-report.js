const MCR = require('monocart-coverage-reports');
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

    Util.log(job.name, 'unit test summary');
    job.summary = summary;
    Util.logObject(summary);
};

const generateCoverageReport = async (job, coverage) => {

    // Not found istanbul coverage (window.__coverage__);
    if (!coverage) {
        return;
    }

    Util.log(job.name, 'coverage report');

    const coveragePath = `${Util.getTempRoot()}/coverage/${job.name}`;

    const coverageReport = MCR({
        name: job.fullName,
        outputDir: coveragePath,
        lcov: true,
        entryFilter: (entry) => entry.url.indexOf(job.buildName) !== -1,
        sourceFilter: (sourcePath) => sourcePath.search(/src\//) !== -1,
        sourcePath: (filePath) => {
            // Remove the virtual prefix
            if (filePath.startsWith(job.name)) {
                return filePath.slice(job.name.length);
            }
            return filePath;
        },
        ... job.coverageOptions
    });

    await coverageReport.add(coverage);
    const coverageResults = await coverageReport.generate();

    job.coverageReport = coverageResults.summary;

};

const generateJobReport = async (job, option) => {
    if (!option) {
        return 0;
    }

    const exitError = getExitError(job, option);
    if (exitError) {
        job.exitError = exitError;
        return 1;
    }

    generateTestReport(job, option.summary);
    await generateCoverageReport(job, option.coverage);

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

    Util.CG({
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
