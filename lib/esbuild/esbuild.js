const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const EC = require('eight-colors');
const metadataReport = require('esbuild-metadata-report');
const Util = require('../core/util.js');

// https://esbuild.github.io/
const buildItem = async (name) => {

    const production = Util.option.production;
    // const componentConf = Util.getComponentConf(name);

    const componentPath = Util.getComponentPath(name);
    // const fullName = Util.getComponentFullName(name);

    const buildName = Util.getComponentBuildName(name);

    const entry = path.resolve(componentPath, 'src/index.js');
    if (!fs.existsSync(entry)) {
        EC.logRed(`Not found build entry: ${Util.relativePath(entry)}`);
        return 1;
    }

    const outfile = path.resolve(componentPath, `dist/${buildName}.js`);

    const reportPath = `${Util.getTempRoot()}/build/`;
    const htmlPath = path.resolve(reportPath, `${buildName}.html`);

    await esbuild.build({
        entryPoints: [entry],
        outfile: outfile,
        minify: Boolean(production),
        bundle: true,
        legalComments: 'none',
        target: 'node16',
        platform: 'node',
        loader: {
            '.svg': 'text',
            '.key': 'text',
            '.pem': 'text'
        },
        plugins: [
            metadataReport({
                name: buildName,
                outputFile: htmlPath,
                json: true
            })
        ]
    }).catch((err) => {
        EC.logRed(err);
        process.exit(1);
    });

    if (!fs.existsSync(outfile)) {
        EC.logRed(`Not found build out file: ${Util.relativePath(outfile)}`);
        return 1;
    }

    const stat = fs.statSync(outfile);

    const size = Util.BF(stat.size);
    const file = Util.relativePath(outfile);

    console.log(`finish build: ${EC.green(file)} (${size})`);

    return 0;
};

const buildList = async (list) => {
    for (const item of list) {
        const code = await buildItem(item);
        if (code) {
            return code;
        }
    }
    return 0;
};

const esbuildModule = async (componentName) => {

    const list = Util.getCurrentComponentList(componentName);
    if (!list.length) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    const exitCode = await buildList(list);
    // always exit no matter exit code is 0
    process.exit(exitCode);

};

module.exports = esbuildModule;
