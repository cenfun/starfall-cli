const fs = require('fs');
const archiver = require('archiver');
const EC = require('eight-colors');
const Util = require('../core/util.js');

const packZip = (item) => {
    return new Promise((resolve) => {

        const timeTag = Util.dateFormat(new Date(), 'yyMMdd');

        const fileName = `${item.buildName}-${item.buildENV.version}-${timeTag}`;
       
        const zipPath = `${Util.getTempRoot()}/pack/${fileName}.zip`;
        if (fs.existsSync(zipPath)) {
            Util.rmSync(zipPath);
        }

        const output = fs.createWriteStream(zipPath);
        console.log(`Create output file: ${Util.relativePath(zipPath)}`);

        output.on('close', function() {
            EC.logGreen(`Packed ${zipPath} (${Util.BF(archive.pointer())})`);
            resolve(0);
        });
        output.on('end', function() {
            console.log('Data has been drained');
        });

        console.log('Start pack files ... ');
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
