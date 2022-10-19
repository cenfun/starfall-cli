const fs = require('fs');
const assert = require('assert');
const shelljs = require('shelljs');

const Util = require('../lib/core/util.js');
const ID = Util.id;

describe(`${ID} build`, function() {
    this.timeout(20 * 1000);

    const getInjectContent = function(name) {
        // check inject
        const indexPath = `packages/${name}/public/index.html`;
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

    // build failed test
    it(`exec ${ID} build app failed`, () => {

        const indexPath = 'packages/app/src/index.js';
        const oldContent = Util.readFileContentSync(indexPath);

        const newContent = 'var component = require("./com.js");export default component;';
        Util.writeFileContentSync(indexPath, newContent, true);

        console.log('=========================================================');
        console.log('following error is testing build failed case');
        console.log('=========================================================');

        const sh = shelljs.exec(`${ID} build app`);

        console.log('=========================================================');
        console.log(`build failed code: ${sh.code}`);
        // write old content back to index.js
        Util.writeFileContentSync(indexPath, oldContent, true);

        assert.strictEqual(sh.code, 1);

    });

    it(`exec ${ID} build app`, () => {
        const sh = shelljs.exec(`${ID} build app`);
        assert.strictEqual(sh.code, 0);
    });

    it('check component dist folder and build js', () => {
        assert.strictEqual(fs.existsSync('packages/app/dist'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/my-components-app.js'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/my-components-app.js.map'), true);
    });

    it(`exec ${ID} build app -p`, () => {
        const sh = shelljs.exec(`${ID} build app -p`);
        assert.strictEqual(sh.code, 0);
    });

    it('check component build folder and build js', () => {
        assert.strictEqual(fs.existsSync('packages/app/dist/my-components-app.js'), true);
        assert.strictEqual(fs.existsSync('packages/app/dist/my-components-app.js.map'), true);
    });

    it('check component inject content app', () => {
        const contentApp = getInjectContent('app');
        console.log(`inject content app: [${contentApp}]`);

        const arrApp = contentApp.split('\n');
        assert.strictEqual(arrApp[0].trim(), '<script src="../../../node_modules/my-components-component-1/dist/my-components-component-1.js"></script>');
        assert.strictEqual(arrApp[1].trim(), '<script src="../dist/my-components-app.js"></script>');

    });


    it(`exec ${ID} build all`, () => {
        const sh = shelljs.exec(`${ID} build`);
        assert.strictEqual(sh.code, 0);
    });

    it('check component-1 build folder and build js', () => {
        assert.strictEqual(fs.existsSync('packages/component-1/dist/my-components-component-1.js'), true);
        assert.strictEqual(fs.existsSync('packages/component-1/dist/my-components-component-1.js.map'), true);
    });

    it('check component inject content component-1', () => {
        const contentComponent1 = getInjectContent('component-1');
        console.log(`inject content component-1: [${contentComponent1}]`);
        // no dependencies
        assert.strictEqual(contentComponent1, '<script src="../dist/my-components-component-1.js"></script>');
    });

});
