const fs = require('fs');
const assert = require('assert');
const shelljs = require('shelljs');

const Util = require('../lib/core/util.js');


describe('sf build', function() {
    this.timeout(20 * 1000);

    const getInjectContent = function(name) {
        //check inject
        const indexPath = `packages/${name}/preview/index.html`;
        let content = Util.readFileContentSync(indexPath);
        assert.ok(content);

        const startStr = '<!--inject:start-->';
        const endStr = '<!--inject:end-->';
        const startIndex = content.indexOf(startStr);
        const endIndex = content.indexOf(endStr);

        content = content.substring(startIndex + startStr.length, endIndex).trim();

        return content;
    };

    it('no component build folder before', () => {
        assert.strictEqual(fs.existsSync('packages/app/build'), false);

        const contentApp = getInjectContent('app');
        assert.strictEqual(contentApp, '');

        const contentComponent1 = getInjectContent('component-1');
        assert.strictEqual(contentComponent1, '');

    });

    //build failed test
    it('exec sf build app failed', () => {

        const indexPath = 'packages/app/src/index.js';
        const oldContent = Util.readFileContentSync(indexPath);

        const newContent = 'var component = require("./com.js");export default component;';
        Util.writeFileContentSync(indexPath, newContent, true);

        console.log('=========================================================');
        console.log('following error is testing build failed case');
        console.log('=========================================================');

        const sh = shelljs.exec('sf build app');

        console.log('=========================================================');
        console.log(`build failed code: ${sh.code}`);
        //write old content back to index.js
        Util.writeFileContentSync(indexPath, oldContent, true);

        assert.strictEqual(sh.code, 1);

    });

    it('exec sf build app', () => {
        const sh = shelljs.exec('sf build app');
        assert.strictEqual(sh.code, 0);
    });

    it('check component dist folder and build js', () => {
        assert.strictEqual(fs.existsSync('packages/app/dist'), true);

        assert.strictEqual(fs.existsSync('packages/app/dist/app.js'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js.map'), true);

        assert.strictEqual(fs.existsSync('packages/app/dist/app.min.js'), false);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.min.js.map'), false);

        assert.strictEqual(fs.existsSync('packages/app/dist/app.bundle.js'), false);
    });

    it('exec sf build app -m', () => {
        const sh = shelljs.exec('sf build app -m');
        assert.strictEqual(sh.code, 0);
    });

    it('check component build folder and build js', () => {
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js.map'), true);

        assert.strictEqual(fs.existsSync('packages/app/dist/app.min.js'), false);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.min.js.map'), false);
    });

    it('check component inject content app', () => {
        const contentApp = getInjectContent('app');
        console.log(`inject content app: [${contentApp}]`);

        const arrApp = contentApp.split('\n');
        assert.strictEqual(arrApp[0].trim(), '<script src="../../../node_modules/component-1/dist/component-1.js"></script>');
        assert.strictEqual(arrApp[1].trim(), '<script src="../dist/app.js"></script>');

    });


    it('exec sf build all', () => {
        const sh = shelljs.exec('sf build');
        assert.strictEqual(sh.code, 0);
    });

    it('check component-1 build folder and build js', () => {
        assert.strictEqual(fs.existsSync('packages/component-1/dist/component-1.js'), true);
        assert.strictEqual(fs.existsSync('packages/component-1/dist/component-1.js.map'), true);

        assert.strictEqual(fs.existsSync('packages/component-1/dist/component-1.min.js'), false);
        assert.strictEqual(fs.existsSync('packages/component-1/dist/component-1.min.js.map'), false);
    });

    it('check component inject content component-1', () => {
        const contentComponent1 = getInjectContent('component-1');
        console.log(`inject content component-1: [${contentComponent1}]`);
        //no dependencies
        assert.strictEqual(contentComponent1, '<script src="../dist/component-1.js"></script>');
    });

    //require build dependencies first because bundle require it
    it('exec sf build app -b', () => {
        const sh = shelljs.exec('sf build app -b');
        assert.strictEqual(sh.code, 0);
    });

    it('check component build folder and bundle js', () => {
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js'), false);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js.map'), false);

        assert.strictEqual(fs.existsSync('packages/app/dist/app.bundle.js'), true);
    });

    //reset to default for publish, because -b -a will remove dependencies

    it('reset dependencies to default after build to bundle', () => {

        const componentConfPath = 'packages/app/package.json';
        const conf = Util.readJSONSync(componentConfPath);
        conf.dependencies = {
            'component-1': ''
        };
        Util.writeJSONSync(componentConfPath, conf);
        const sh = shelljs.exec('sf build app');
        assert.strictEqual(sh.code, 0);

        assert.strictEqual(fs.existsSync('packages/app/dist/app.js'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js.map'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.bundle.js'), false);

    });

    //css extract
    it('exec sf build app -c without style', () => {
        const sh = shelljs.exec('sf build app -c');
        assert.strictEqual(sh.code, 0);
    });

    it('check component build folder for css extract', () => {
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js.map'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.css'), false);
        //assert.strictEqual(fs.existsSync("packages/app/dist/app.css.map"), false);
        const contentApp = getInjectContent('app');
        console.log(`inject content app: [${contentApp}]`);
        const arrApp = contentApp.split('\n');
        assert.strictEqual(arrApp[0].trim(), '<script src="../../../node_modules/component-1/dist/component-1.js"></script>');
        assert.strictEqual(arrApp[1].trim(), '<script src="../dist/app.js"></script>');
    });

    //css extract
    it('exec sf build app -c -m with style', () => {

        //add css file
        const cssPath = 'packages/app/src/style.css';
        const cssContent = '.app { position: relative; }';
        Util.writeFileContentSync(cssPath, cssContent, true);

        const indexPath = 'packages/app/src/index.js';
        const oldContent = Util.readFileContentSync(indexPath);
        const newContent = `require("./style.css")\n${oldContent}`;
        Util.writeFileContentSync(indexPath, newContent, true);

        const sh = shelljs.exec('sf build app -c');
        assert.strictEqual(sh.code, 0);

    });

    it('check component build folder for css extract', () => {
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.js.map'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/app.css'), true);
        //assert.strictEqual(fs.existsSync("packages/app/dist/app.css.map"), true);

        const contentApp = getInjectContent('app');
        console.log(`inject content app: [${contentApp}]`);
        const arrApp = contentApp.split('\n');
        assert.strictEqual(arrApp[0].trim(), '<script src="../../../node_modules/component-1/dist/component-1.js"></script>');
        assert.strictEqual(arrApp[1].trim(), '<link href="../dist/app.css" rel="stylesheet" />');
        assert.strictEqual(arrApp[2].trim(), '<script src="../dist/app.js"></script>');

    });

});
