const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const semver = require('semver');
const Diff = require('diff');
const beautify = require('js-beautify');

const Diff2Html = require('diff2html');

const Util = require('../core/util.js');
const EC = Util.EC;
const axios = require('axios');
const tar = require('tar');

//================================================================================

const tarExtract = (stream, folderPath) => {
    return new Promise((resolve) => {
        const extractor = tar.x({
            cwd: folderPath
        }).on('error', (err) => {
            Util.logRed(err);
            resolve(1);
        }).on('end', () => {
            Util.logMsg('[extracted]', Util.relativePath(folderPath));
            resolve(0);
        });
        stream.pipe(extractor);
    });
};

const downloadDistFile = async (url, times) => {
    times -= 1;
    const res = await axios({
        method: 'get',
        url: url,
        timeout: 10 * 1000,
        responseType: 'stream'
    }).catch(function(e) {
        Util.logRed(e);
    });
    if (!res || !res.data) {
        if (times > 0) {
            Util.logYellow('Failed to download dist tar file, try again ...');
            return downloadDistFile(url, times);
        }
        return;
    }
    return res;
};

const downloadDist = async (item, info) => {
    if (!info.dist || !info.dist.tarball) {
        Util.logRed(`ERROR: Not found ${item.name} dist or dist.tarball`);
        return;
    }
    const url = info.dist.tarball;
    const res = await downloadDistFile(url, 2);
    if (!res || !res.data) {
        Util.logRed(`ERROR: Failed to download dist tar file: ${url}`);
        return;
    }

    const folderPath = `${item.outputPath}/${info.version}`;
    if (fs.existsSync(folderPath)) {
        await Util.rm(folderPath);
    }
    shelljs.mkdir('-p', folderPath);

    const filePath = `${folderPath}/package.tgz`;
    res.data.pipe(fs.createWriteStream(filePath));

    Util.logMsg('[downloaded]', Util.relativePath(filePath));

    const code = await tarExtract(res.data, folderPath);
    if (code !== 0) {
        return;
    }

    return folderPath;
};

//================================================================================

const getSortedVersionList = (repJson) => {
    //sort versions
    const list = [];
    const versions = repJson.versions;
    Object.keys(versions).forEach(function(v) {
        if (semver.valid(v)) {
            list.push(v);
        }
    });
    list.sort(function(a, b) {
        if (semver.lt(a, b)) {
            return 1;
        }
        return -1;
    });
    return list;
};

const initABVersion = (item, ab) => {
    if (!item.ab || typeof (item.ab) !== 'string') {
        return;
    }
    const arr = item.ab.split(',');
    if (arr[0]) {
        ab.aVersion = arr[0];
    }
    if (arr[1]) {
        ab.bVersion = arr[1];
    }
};

const initVersionInfo = (v, repJson) => {
    const info = repJson.versions[v];
    const time = repJson.time;
    if (time && time[v]) {
        info.time = time[v];
    }
    if (!info.version) {
        info.version = v;
    }
    return info;
};

const getPrevVersion = (v, tags) => {
    if (!v.endsWith('prev')) {
        return;
    }
    const latestV = tags.latest;
    if (!latestV) {
        return;
    }

    //console.log(v);
    const lv = semver.parse(latestV);
    //console.log(lv);
    
    //minor-prev
    if (v.startsWith('minor')) {
        if (lv.minor > 0) {
            return [`~${lv.major}`, lv.minor - 1].join('.');
        }
        return [`<${lv.major}`, 0].join('.');
    }

    //latest-prev
    //patch-prev
    //other
    if (lv.patch > 0) {
        return [`<=${lv.major}`, lv.minor, lv.patch - 1].join('.');
    }
    //patch is 0, use minor prev
    return [`<${lv.major}`, lv.minor, 0].join('.');
    
};

const getVersionInfo = (v, repJson, list) => {

    //console.log(v);

    //latest
    //match version from dist-tags first
    const tags = repJson['dist-tags'];
    if (tags) {
        const tv = tags[v];
        if (tv) {
            return initVersionInfo(tv, repJson);
        }
    }

    const pv = getPrevVersion(v, tags);
    //console.log(pv);
    if (pv) {
        v = pv;
    }

    //range ~1.65
    //choose from list
    for (let i = 0, l = list.length; i < l; i++) {
        const lv = list[i];
        if (semver.satisfies(lv, v)) {
            return initVersionInfo(lv, repJson);
        }
    }

};

//sort ab, a always less than b, because diff report will show code changes with right ab
const sortAB = (ab) => {
    if (semver.lt(ab.aVersionInfo.version, ab.bVersionInfo.version)) {
        return;
    }

    //exchange ab version
    const tVersion = ab.aVersion;
    ab.aVersion = ab.bVersion;
    ab.bVersion = tVersion;

    const tVersionInfo = ab.aVersionInfo;
    ab.aVersionInfo = ab.bVersionInfo;
    ab.bVersionInfo = tVersionInfo;

};

const generateAB = (item, repJson) => {

    //console.log(item);

    const ab = {
        aVersion: 'latest-prev',
        bVersion: 'latest',
        sortedVersionList: getSortedVersionList(repJson)
    };
    initABVersion(item, ab);

    const aVersionInfo = getVersionInfo(ab.aVersion, repJson, ab.sortedVersionList);
    const bVersionInfo = getVersionInfo(ab.bVersion, repJson, ab.sortedVersionList);

    if (!aVersionInfo || !bVersionInfo) {
        if (!aVersionInfo) {
            item.errorMsg = `Not found version: ${ab.aVersion}`;
            Util.logRed(`ERROR: ${item.name} : ${item.errorMsg}`);
        }
        if (!bVersionInfo) {
            item.errorMsg = `Not found version: ${ab.bVersion}`;
            Util.logRed(`ERROR: ${item.name} : ${item.errorMsg}`);
        }
        return;
    }

    ab.aVersionInfo = aVersionInfo;
    ab.bVersionInfo = bVersionInfo;
    sortAB(ab);

    return ab;
};

//================================================================================

const generateFileContent = (item, p) => {
    const content = Util.readFileContentSync(p);
    if (!content) {
        return content;
    }

    //if minify try beautify
    if (!item.format) {
        return content;
    }

    //https://github.com/beautify-web/js-beautify
    const ext = path.extname(p);
    if (ext === '.js') {
        return beautify.js(content, Util.getBeautifyOption());
    }

    if (ext === '.css') {
        return beautify.css(content);
    }

    return content;
};

const readModuleFiles = (item, folder, list) => {
    if (!list.length) {
        Util.logRed('ERROR: Failed to read module output files');
        return {};
    }
    const files = {};
    list.forEach(function(p) {
        const content = generateFileContent(item, p);
        p = path.relative(folder, p);
        p = Util.formatPath(p);
        files[p] = content || '';
    });
    return files;
};

const generateModuleDistFiles = (item, folder) => {
    //for default main output
    const p = `${folder}/package`;
    const pp = `${p}/package.json`;
    const json = Util.readJSONSync(pp);
    if (!json) {
        Util.logRed(`ERROR: Failed to read package.json: ${pp}`);
        return [];
    }
    const packageJson = {};
    packageJson[item.name] = pp;
    const moduleOverrides = Util.getSetting('moduleOverrides');
    const option = {
        overrides: moduleOverrides,
        target: p
    };
    let distList = Util.getModuleFiles(p, json, option);
    distList = distList.map(function(dist) {
        if (dist.indexOf('.min') !== -1) {
            item.format = true;
        }
        return path.resolve(p, dist);
    });
    return distList;
};

const generateModuleFiles = (item, folder) => {
    console.log(`generate module files: ${folder} ...`);

    const src = item.src || 'src';
    const srcPath = path.normalize(`${folder}/package/${src}`);
    const srcList = [];
    if (fs.existsSync(srcPath)) {
        Util.forEachFile(srcPath, [], function(fileName, filePath) {
            srcList.push(path.resolve(filePath, fileName));
        });
    } else {
        //no src, try get from main output file
        const distFiles = generateModuleDistFiles(item, folder);
        distFiles.forEach(it => {
            srcList.push(it);
        });
    }
    return readModuleFiles(item, folder, srcList);
};

const generateDiffList = (item, aFiles, bFiles) => {
    const list = [];
    Object.keys(bFiles).forEach(function(k) {
        const oldStr = aFiles[k] || '';
        const newStr = bFiles[k] || '';
        if (oldStr === newStr) {
            return;
        }
        const time_start = Date.now();
        console.log(`generate diff: ${k} ...`);
        const diff = Diff.structuredPatch(k, k, oldStr, newStr);
        list.push(diff);
        const time_end = Date.now();
        const duration = Util.TF(time_end - time_start, 'ms');
        Util.logMsg('[diff]', `${EC.green('generated')} ${k} and cost: ${duration}`);
    });
    return list;
};

const generateHtmlReport = (item, report, patch) => {
    console.log('generate diff html report ...');
    const content = Diff2Html.html(patch, {
        renderNothingWhenEmpty: true,
        inputFormat: 'diff',
        showFiles: true,
        matching: 'lines'
    });

    const stylePath = `${Util.nmRoot}/node_modules/diff2html/bundles/css/diff2html.min.css`;
    const styleContent = Util.readFileContentSync(stylePath);
    const heads = `<style>${styleContent}</style>`;
    const diffTemplate = Util.getTemplate(`${__dirname}/diff-template.html`);
    const subtitle = `${report.abHeadHtml}<div>&nbsp;</div>`;
    const html = Util.replace(diffTemplate, {
        title: `Diff report: ${item.name}`,
        subtitle: subtitle,
        heads: heads,
        content: content,
        about: Util.getAbout('diff', 'Diff')
    });

    const reportPath = `${item.jobFolder}/${item.name}.html`;
    Util.writeFileContentSync(reportPath, html, true);

    console.log(`${EC.green('saved')} diff report: ${Util.relativePath(reportPath)}`);

    return reportPath;
};

//================================================================================

const initVersionHead = (report) => {
    const av = `[ ${report.aVersion} ] resolved to [ <b>${report.aResolvedVersion}</b> ]`;
    const aTime = Util.dateFormat(report.aTime, 'yyyy-MM-dd hh:mm');
    const aHead = `A: ${av} - (${aTime})`;
    const bv = `[ ${report.bVersion} ] resolved to [ <b>${report.bResolvedVersion}</b> ]`;
    const bTime = Util.dateFormat(report.bTime, 'yyyy-MM-dd hh:mm');
    const bHead = `B: ${bv} - (${bTime})`;
    const html = `<div>${aHead}</div><div>${bHead}</div>`;
    report.aHead = aHead;
    report.bHead = bHead;
    report.abHeadHtml = html;
};

const createPatch = (diff, report, index) => {
    const ret = [];

    ret.push(`diff --git a/${diff.oldFileName} b/${diff.newFileName}`);
    ret.push(`index ${diff.oldFileName}`);
    ret.push(`--- ${diff.oldFileName}`);
    ret.push(`+++ ${diff.newFileName}`);
    for (let i = 0; i < diff.hunks.length; i++) {
        const hunk = diff.hunks[i];
        const arr = [
            `@@ -${hunk.oldStart}`,
            `${hunk.oldLines} +${hunk.newStart}`,
            `${hunk.newLines} @@`
        ];
        ret.push(arr.join(','));
        hunk.lines.forEach(function(line) {
            if (line.indexOf('+') === 0) {
                report.added += 1;
            } else if (line.indexOf('-') === 0) {
                report.deleted += 1;
            }
            ret.push(line);
        });
    }
    return `${ret.join('\n')}\n`;
};

const diffVersion = async (item, repJson) => {
    const ab = generateAB(item, repJson);
    if (!ab) {
        return;
    }

    console.log(`diff ${item.name}: `);
    Util.consoleGrid.render({
        option: {
            hideHeaders: false
        },
        columns: [{
            id: 'name',
            name: 'Name'
        }, {
            id: 'a',
            name: 'Version a'
        }, {
            id: 'b',
            name: 'Version b'
        }],
        rows: [{
            name: 'Version',
            a: ab.aVersion,
            b: ab.bVersion
        }, {
            name: 'Resolved',
            a: EC.cyan(ab.aVersionInfo.version),
            b: EC.cyan(ab.bVersionInfo.version)
        }]
    });

    const aFolder = await downloadDist(item, ab.aVersionInfo);
    const bFolder = await downloadDist(item, ab.bVersionInfo);

    if (!aFolder || !bFolder) {
        return;
    }

    //file list
    const aFiles = await generateModuleFiles(item, aFolder);
    const bFiles = await generateModuleFiles(item, bFolder);

    //diff list
    const diffList = await generateDiffList(item, aFiles, bFiles);

    //patch

    const report = {
        aVersion: ab.aVersion,
        bVersion: ab.bVersion,
        aResolvedVersion: ab.aVersionInfo.version,
        bResolvedVersion: ab.bVersionInfo.version,
        aTime: ab.aVersionInfo.time,
        bTime: ab.bVersionInfo.time,
        added: 0,
        deleted: 0
    };
    initVersionHead(report);

    const patchList = [];
    diffList.forEach(function(diff, i) {
        patchList.push(createPatch(diff, report, i));
    });

    const patch = patchList.join('\n');
    Util.writeFileContentSync(`${item.outputPath}/diff.patch`, patch, true);
    const reportPath = await generateHtmlReport(item, report, patch);
    report.reportPath = reportPath;

    item.report = report;

};

const downloadRepJson = async (item) => {
    const url = item.infoRegistry + item.name;
    const res = await axios({
        method: 'get',
        url: url,
        timeout: 10 * 1000,
        responseType: 'json'
    }).catch(function(e) {
        Util.logRed(e);
    });

    if (!res || !res.data) {
        Util.logRed(`ERROR: Failed to get module info: ${url}`);
        return null;
    }
    const info = res.data;
    if (!info.name || !info.versions) {
        Util.logRed(`ERROR: Invalid JSON data: ${url}`);
        return null;
    }
    const confPath = `${item.outputPath}/repository.json`;
    Util.writeJSONSync(confPath, info, true);
    console.log(`${EC.green('saved')} repository: ${Util.relativePath(confPath)}`);
    return info;
};

//================================================================================

const diffHandler = async (item) => {
    Util.jobId = item.jobId;
    Util.jobName = item.jobName;
    Util.componentName = item.name;
    Util.logWorker();
    let repJson = await downloadRepJson(item);
    if (!repJson) {
        console.log('Try download again ...');
        repJson = await downloadRepJson(item);
    }
    if (repJson) {
        await diffVersion(item, repJson);
    }
    return 0;
};

module.exports = diffHandler;
