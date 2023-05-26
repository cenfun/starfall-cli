const fs = require('fs');
const path = require('path');
const assert = require('assert');
const shelljs = require('shelljs');
const EC = require('eight-colors');

const Util = require('../lib/core/util.js');
const ID = Util.id;

const rootPath = path.resolve(__dirname, '../');
console.log(`rootPath: ${rootPath}`);
const tempPath = path.resolve(rootPath, '.temp');
console.log(`tempPath: ${tempPath}`);

describe(`${ID} init`, function() {
    this.timeout(20 * 1000);

    before(() => {
        // create .temp folder for test
        if (fs.existsSync(tempPath)) {
            shelljs.rm('-rf', tempPath);
            EC.logGreen(`removed previous .temp: ${tempPath}`);
        }

        shelljs.mkdir('-p', tempPath);
        EC.logGreen('created .temp folder for test');

        console.log('go to .temp folder');
        shelljs.cd(tempPath);

        shelljs.mkdir('-p', 'my-components');
        EC.logGreen('created project folder');

        console.log('go to my-components folder');
        shelljs.cd('my-components');

    });

    it(`exec ${ID} init -f`, () => {
        const sh = shelljs.exec(`${ID} init -f`);
        assert.strictEqual(sh.code, 0);
    });

    it('check project files', () => {
        assert.strictEqual(fs.existsSync('.eslintignore'), true);
        assert.strictEqual(fs.existsSync('.eslintrc.js'), true);
        assert.strictEqual(fs.existsSync('.gitignore'), true);
        assert.strictEqual(fs.existsSync('.npmrc'), true);
        assert.strictEqual(fs.existsSync('.stylelintignore'), true);
        assert.strictEqual(fs.existsSync('.stylelintrc.js'), true);
        assert.strictEqual(fs.existsSync('package.json'), true);
        assert.strictEqual(fs.existsSync('README.md'), true);
    });

    it('check project package.json', () => {
        const projectConfPath = 'package.json';
        assert.strictEqual(fs.existsSync(projectConfPath), true);

        const conf = Util.readJSONSync(projectConfPath);
        assert.ok(conf);
        assert.strictEqual(conf.name, 'my-components');
        assert.strictEqual(conf.version, '1.0.0');

        assert.ok(conf.scripts);

        assert.ok(conf.dependencies);
        assert.ok(conf.devDependencies);

    });

    it('check component files', () => {
        assert.strictEqual(fs.existsSync('packages/app/public/index.html'), true);
        assert.strictEqual(fs.existsSync('packages/app/src/index.js'), true);
        assert.strictEqual(fs.existsSync('packages/app/test/specs/test.js'), true);
        assert.strictEqual(fs.existsSync('packages/app/package.json'), true);
        assert.strictEqual(fs.existsSync('packages/app/README.md'), true);
    });

    it('check component package.json', () => {
        const conf = Util.readJSONSync('packages/app/package.json');
        assert.ok(conf);
        // added prefix
        assert.strictEqual(conf.name, 'my-app');
        assert.strictEqual(conf.main, 'dist/my-app.js');
        assert.ok(conf.dependencies);
    });

    it(`exec ${ID} add`, () => {
        const sh = shelljs.exec(`${ID} add component-1`);
        assert.strictEqual(sh.code, 0);
    });

    it('check component-1 files', () => {
        assert.strictEqual(fs.existsSync('packages/component-1/public/index.html'), true);
        assert.strictEqual(fs.existsSync('packages/component-1/src/index.js'), true);
        assert.strictEqual(fs.existsSync('packages/component-1/test/specs/test.js'), true);
        assert.strictEqual(fs.existsSync('packages/component-1/package.json'), true);
        assert.strictEqual(fs.existsSync('packages/component-1/README.md'), true);
    });

    it('check component-1 package.json', () => {
        const conf = Util.readJSONSync('packages/component-1/package.json');
        assert.ok(conf);
        assert.strictEqual(conf.name, 'my-component-1');
        assert.strictEqual(conf.main, 'dist/my-component-1.js');
        assert.ok(conf.dependencies);
    });

});
