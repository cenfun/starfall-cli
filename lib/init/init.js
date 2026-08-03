import fs from 'fs';
import path from 'path';

import {
    state, editFile, replace, getProjectConf, saveProjectConf, readJSONSync
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

    // init package.json

    // ====================================================
    // init scripts
    pc.scripts = Object.assign(pc.scripts, {
        'dev': 'vite',
        'build': 'vite build',
        'lint': 'eslint src/ --fix && stylelint src/**/*.scss',
        'test': 'node scripts/test.js',
        'docs': 'vite build --mode docs',
        'preview': 'vite preview --mode docs',
        'version': 'npm run build',
        'publish': 'node ./scripts/publish.js'
    });
    // ====================================================

    const cliPkg = readJSONSync(`${state.cliRoot}/package.json`);
    pc.type = cliPkg.type;

    // init devDependencies
    const devDeps = pc.devDependencies || {};

    const deps = cliPkg.dependencies || {};

    const depList = [

        // common
        'eight-colors',
        'vite',
        '@vitejs/plugin-vue',
        'sass',

        // vue
        'async-tick',
        'axios',
        'vite-plugin-css-injected-by-js',

        // test
        'mocha',
        'chai',
        'playwright',
        'monocart-coverage-reports',

        // publish
        'execa',

        // eslint
        'eslint',
        'eslint-config-plus',
        'eslint-plugin-vue',

        // stylelint
        'stylelint',
        'stylelint-config-plus'

    ];

    depList.forEach((dep) => {
        devDeps[dep] = deps[dep];
    });


    const keys = Object.keys(devDeps);
    const newDevDeps = {};
    keys.sort().forEach((key) => {
        newDevDeps[key] = devDeps[key];
    });

    pc.devDependencies = newDevDeps;

    saveProjectConf(pc);


};


export default initModule;
