const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const archiver = require('archiver');
const EC = require('eight-colors');
const Util = require('../core/util.js');

const packZip = (item) => {
    return new Promise((resolve) => {

        const timeTag = Util.dateFormat(new Date(), 'yyMMdd');

        const fileName = `${item.buildName}-${item.env.version}-${timeTag}`;

        const zipTempPath = `${Util.getTempRoot()}/pack`;
        //create temp folder if pack path not exist( like using custom pack path: docs )
        if (!fs.existsSync(zipTempPath)) {
            shelljs.mkdir('-p', zipTempPath);
        }

        const zipPath = `${zipTempPath}/${fileName}.zip`;
        if (fs.existsSync(zipPath)) {
            Util.rmSync(zipPath);
        }

        const output = fs.createWriteStream(zipPath);
        console.log(`Created zip file: ${zipPath}`);

        output.on('close', function() {
            Util.logEnd(`finish: ${path.basename(zipPath)} (${Util.BF(archive.pointer())})`);
            resolve(0);
        });
        output.on('end', function() {
            console.log('Data has been drained');
        });

        console.log(`Appending files from ${item.packPath} ... `);
        const archive = archiver('zip', {
            zlib: {
                level: 9
            }
        });
        archive.on('error', function(err) {
            EC.logRed(err);
            resolve(1);
        });
        archive.on('warning', function(err) {
            EC.logYellow(err);
        });

        archive.pipe(output);
        archive.directory(item.packPath, false);
        archive.finalize();

    });
};


module.exports = packZip;
