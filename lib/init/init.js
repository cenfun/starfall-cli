import fs from 'fs';
import path from 'path';

import {
    state, editFile, replace, getProjectConf
} from '../core/util.js';

const copyFiles = (src, dest, pc) => {
    if (!fs.existsSync(src)) {
        return;
    }

    const list = fs.readdirSync(src);
    list.forEach((file) => {
        const srcFile = path.resolve(src, file);
        const destFile = path.resolve(dest, file);
        const stat = fs.statSync(srcFile);
        if (stat && stat.isDirectory()) {
            if (!fs.existsSync(destFile)) {
                fs.mkdirSync(destFile);
            }
            copyFiles(srcFile, destFile, pc);
        } else {
            editFile(srcFile, (content) => {
                return replace(content, {
                    'your-library-id': pc.name
                });
            }, destFile);
        }
    });

};

const initModule = () => {
    const pc = getProjectConf();
    const templatesPath = path.resolve(import.meta.dirname, 'templates');
    copyFiles(templatesPath, state.root, pc);
};


export default initModule;
