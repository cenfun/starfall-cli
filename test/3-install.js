const fs = require('fs');
const assert = require('assert');
const shelljs = require('shelljs');

const Util = require('../lib/core/util.js');
const ID = Util.id;

const appConfPath = 'packages/app/package.json';
const projectConfPath = 'package.json';

describe(`${ID} install`, function() {
    this.timeout(2 * 60 * 1000);

    it(`before ${ID} install`, () => {
        Util.editJSON(appConfPath, function(json) {
            json.dependencies['console-grid'] = 'latest';
            // console.log(json);
            return json;
        });
        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies['console-grid'], 'latest');
    });

    it(`exec ${ID} install -f`, () => {
        // remove previous dependencies, no time install
        Util.editJSON(projectConfPath, function(json) {
            json.dependencies = {
                'console-grid': 'latest'
            };
            json.devDependencies = {
                'console-grid': 'latest'
            };
            return json;
        });
        // force install first
        const sh = shelljs.exec(`${ID} install -f`);
        assert.strictEqual(sh.code, 0);
    });

    it('check component package.json', () => {
        assert.strictEqual(fs.existsSync(appConfPath), true);
        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.version, '1.0.0');
        assert.ok(conf.dependencies);
        assert.strictEqual(conf.dependencies['console-grid'], 'latest');
        assert.ok(conf.devDependencies);
    });

    it('check project package.json for default', () => {
        assert.strictEqual(fs.existsSync(projectConfPath), true);

        const conf = Util.readJSONSync(projectConfPath);
        assert.ok(conf.dependencies);
        // workspaces detected in package.json, ignore child dependencies promotion.
        if (!conf.workspaces) {
            assert.strictEqual(conf.dependencies['console-grid'], 'latest');
        }
        assert.ok(conf.devDependencies);

    });

    // ===================================================================================

    it(`add invalid dependencies and exec ${ID} install`, () => {

        Util.editJSON(appConfPath, function(json) {
            json.dependencies['invalid-dependency-a'] = '~1.0.1';
            json.devDependencies['invalid-dev-dependency-a'] = '^1.0.1';
            // console.log(json);
            return json;
        });

        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies['invalid-dependency-a'], '~1.0.1');
        assert.strictEqual(conf.devDependencies['invalid-dev-dependency-a'], '^1.0.1');

        const sh = shelljs.exec(`${ID} install -f`);
        assert.strictEqual(sh.code, 1);

    });

    it('check project package.json for invalid dependencies', () => {

        assert.strictEqual(fs.existsSync(projectConfPath), true);

        const conf = Util.readJSONSync(projectConfPath);
        assert.ok(conf.dependencies);
        assert.ok(conf.devDependencies);
        if (!conf.workspaces) {
            assert.strictEqual(conf.dependencies['invalid-dependency-a'], '~1.0.1');
            assert.strictEqual(conf.devDependencies['invalid-dev-dependency-a'], '^1.0.1');
        }

    });

    // ===================================================================================

    it('add internal dependencies and install', () => {

        Util.editJSON(appConfPath, function(json) {
            // remove invalid first
            delete json.dependencies['invalid-dependency-a'];
            delete json.devDependencies['invalid-dev-dependency-a'];
            json.dependencies['my-component-1'] = '2.0.1';
            json.devDependencies['my-component-1'] = '2.0.1';
            // console.log(json);
            return json;
        });

        // reset project conf
        const proConf = Util.readJSONSync(projectConfPath);
        proConf.devDependencies = {};
        Util.writeJSONSync(projectConfPath, proConf);

        const sh = shelljs.exec(`${ID} install -f`);
        assert.strictEqual(sh.code, 0);
    });

    it('check component formatted dependencies', () => {

        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies['my-component-1'], '');
        assert.strictEqual(conf.devDependencies['my-component-1'], '');

    });

    it('check project package.json for internal', () => {

        assert.strictEqual(fs.existsSync(projectConfPath), true);

        const conf = Util.readJSONSync(projectConfPath);
        assert.ok(conf.dependencies);
        assert.ok(conf.devDependencies);
    });

    it('check link module for internal', () => {
        const internalModulePath = 'node_modules/my-component-1';
        assert.strictEqual(fs.existsSync(internalModulePath), true);
        const conf = Util.readJSONSync(`${internalModulePath}/package.json`);
        assert.ok(conf.name, 'my-component-1');
    });


    it(`after ${ID} install`, () => {
        Util.editJSON(appConfPath, function(json) {
            delete json.dependencies['console-grid'];
            // console.log(json);
            return json;
        });
        const conf = Util.readJSONSync(appConfPath);
        assert.ok(!conf.dependencies['console-grid']);
    });

});
