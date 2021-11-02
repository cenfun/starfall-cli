const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const Util = require('../core/util.js');
const EC = Util.EC;

const conf = require('./blame-conf.js');
const reportHandler = require('./blame-report.js');

const getSubFileList = async (p, ig, extList) => {
    let fileList = [];
    const list = fs.readdirSync(p);
    for (const name of list) {
        const subPath = `${p}/${name}`;
        if (ig.ignores(subPath) || ig.ignores(`${subPath}/`)) {
            continue;
        }
        const info = fs.statSync(subPath);
        if (info.isDirectory()) {
            Util.gaugeShow(subPath);
            await Util.delay();
            const subFileList = await getSubFileList(subPath, ig, extList);
            fileList = fileList.concat(subFileList);
            continue;
        }
        if (info.isFile()) {
            const extname = path.extname(subPath);
            if (extList.includes(extname)) {
                fileList.push(subPath);
            }
        }
    }
    return fileList;
};

const getFileList = async (ig, extList) => {
    Util.gaugeOutput('generate file list ...');
    let fileList = [];
    const list = fs.readdirSync(Util.root);
    for (const name of list) {
        if (name === '.git') {
            continue;
        }
        if (ig.ignores(name) || ig.ignores(`${name}/`)) {
            continue;
        }
        const info = fs.statSync(name);
        if (info.isDirectory()) {
            const subFileList = await getSubFileList(name, ig, extList);
            fileList = fileList.concat(subFileList);
            continue;
        }
        if (info.isFile()) {
            const extname = path.extname(name);
            if (extList.includes(extname)) {
                fileList.push(name);
            }
        }
    }

    Util.gaugeHide();
    return fileList;
};

const getIgnoreRules = () => {
    const confPath = `${Util.root}/.gitignore`;
    const content = Util.readFileContentSync(confPath);
    if (!content) {
        Util.logYellow(`WARN: Fail to read file: ${confPath}`);
        return [];
    }
    return content.split(/\r?\n+/);
};

const generateFileList = async (extList) => {
    const rules = await getIgnoreRules();
    const ig = ignore();
    rules.forEach((line) => {
        line = line.trim();
        if (!line) {
            return;
        }
        //remove comment line
        if (!(/^#|^$/).test(line)) {
            ig.add(line);
        }
    });
    //always add .temp for none project
    ig.add('.temp');
    return getFileList(ig, extList);
};

//============================================================================================

const gitBlameModule = async () => {

    let name = path.basename(path.resolve(Util.root));
    const pc = Util.getProjectConf();
    if (pc) {
        name = pc.name;
    }

    const cachePath = `${Util.getTempRoot()}/git-blame-${name}.${Util.DF()}.json`;
    if (fs.existsSync(cachePath)) {
        Util.logYellow(`Found git blame cache: ${Util.relativePath(cachePath)}`);
        await reportHandler(Util.readJSONSync(cachePath));
        return;
    }

    const fileList = await generateFileList(conf.extList);

    console.log(`generate files: ${EC.green(fileList.length)}`);

    const jobList = fileList.map((p, i) => {
        return {
            name: `git blame ${i + 1}`,
            filePath: p
        };
    });

    //jobList.length = 3;

    // jobList = [{
    //     name: "test",
    //     filePath: "components/account-setting-widget/src/widget/account-setting-widget-data-model.js"
    // }];

    // jobList = [{
    //     name: "test",
    //     filePath: "conf.cli.js"
    // }];

    const exitCode = await Util.startWorker({
        name: 'blame',
        workerEntry: path.resolve(__dirname, 'blame-worker.js'),
        jobList: jobList,
        logCost: 'worker',
        reportHandler: (report) => {
            //update name to project name from job name blame
            report.name = name;
            fs.writeFileSync(cachePath, JSON.stringify(report));
            return reportHandler(report);
        }
    });

    process.exit(exitCode);

};

module.exports = gitBlameModule;
