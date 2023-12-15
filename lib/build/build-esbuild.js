const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const EC = require('eight-colors');
const Util = require('../core/util.js');

module.exports = async (item, entry) => {
    const startTime = new Date().getTime();
    const outfile = path.resolve(item.buildPath, `${item.buildName}.js`);

    const format = (item.esModule || item.esm) ? 'esm' : 'cjs';

    const relPath = Util.relativePath(outfile);
    Util.log(`start esbuild ${EC.magenta(format)}: ${relPath} ...`);

    let err;
    const result = await esbuild.build({
        entryPoints: [entry],
        outfile,
        minify: Boolean(item.production),
        metafile: true,
        bundle: true,
        define: item.define,
        format,
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

    const cost = (new Date().getTime() - startTime).toLocaleString();
    Util.log(`esbuild cost: ${cost}ms`);

    return metafile;
};
