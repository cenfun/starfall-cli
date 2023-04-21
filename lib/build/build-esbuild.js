const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const EC = require('eight-colors');
const Util = require('../core/util.js');

module.exports = async (item, entry) => {
    const outfile = path.resolve(item.buildPath, `${item.buildName}.js`);

    let err;
    const result = await esbuild.build({
        entryPoints: [entry],
        outfile,
        minify: item.production,
        metafile: true,
        bundle: true,
        format: item.esm ? 'esm' : 'cjs',
        legalComments: 'none',
        target: 'node16',
        platform: 'node',
        loader: {
            '.svg': 'text',
            '.key': 'text',
            '.pem': 'text'
        }
    }).catch((e) => {
        err = e;
    });

    if (err) {
        EC.logRed(err);
        return;
    }

    if (!fs.existsSync(outfile)) {
        EC.logRed(`Not found out file: ${Util.relativePath(outfile)}`);
        return;
    }

    const metafile = result.metafile;

    // save metafile
    const reportPath = `${Util.getTempRoot()}/build/`;
    if (!fs.existsSync(reportPath)) {
        fs.mkdirSync(reportPath, {
            recursive: true
        });
    }

    const metaPath = path.resolve(reportPath, `${item.buildName}.json`);
    Util.writeJSONSync(metaPath, metafile);

    return metafile;
};
