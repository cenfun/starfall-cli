const fs = require('fs');
const assert = require('assert');
const shelljs = require('shelljs');

const Util = require('../lib/core/util.js');
const ID = Util.id;

const appConfPath = 'packages/app/package.json';
const componentConfPath = 'packages/component-1/package.json';
const projectConfPath = 'package.json';

describe(`${ID} install`, function() {
    this.timeout(2 * 60 * 1000);

    it(`before ${ID} install`, () => {
        Util.editJSON(appConfPath, function(json) {
            json.dependencies['console-grid'] = 'latest';
            //console.log(json);
            return json;
        });
        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies['console-grid'], 'latest');
    });

    it(`exec ${ID} install -f`, () => {
        //remove previous dependencies, no time install
        Util.editJSON(projectConfPath, function(json) {
            json.dependencies = {
                'console-grid': 'latest'
            };
            json.devDependencies = {
                'console-grid': 'latest'
            };
            return json;
        });
        //force install first
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
        //workspaces detected in package.json, ignore child dependencies promotion.
        if (!conf.workspaces) {
            assert.strictEqual(conf.dependencies['console-grid'], 'latest');
        }
        assert.ok(conf.devDependencies);

    });

    //===================================================================================
    //install module

    it(`exec ${ID} install component-1 -c app --remove`, () => {
        const sh = shelljs.exec(`${ID} install component-1 -c app --remove`);
        assert.strictEqual(sh.code, 0);

        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(Util.hasOwn(conf.dependencies, 'component-1'), false);
    });

    it(`exec ${ID} install component-1 -c app --remove --dev`, () => {
        const sh = shelljs.exec(`${ID} install component-1 -c app --remove --dev`);
        assert.strictEqual(sh.code, 0);

        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(Util.hasOwn(conf.devDependencies, 'component-1'), false);
    });

    //===================================================================================
    //dependencies
    it(`exec ${ID} install my-components-app,component-1 -c`, () => {
        const sh = shelljs.exec(`${ID} install my-components-app,component-1 -c`);
        assert.strictEqual(sh.code, 0);

        let conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(Util.hasOwn(conf.dependencies, 'my-components-app'), false);
        assert.strictEqual(Util.hasOwn(conf.dependencies, 'component-1'), true);

        conf = Util.readJSONSync(componentConfPath);
        assert.strictEqual(Util.hasOwn(conf.dependencies, 'my-components-app'), true);
        assert.strictEqual(Util.hasOwn(conf.dependencies, 'component-1'), true);
    });

    //devDependencies
    it(`exec ${ID} install my-components-app,component-1 -c --dev`, () => {
        const sh = shelljs.exec(`${ID} install my-components-app,component-1 -c --dev`);
        assert.strictEqual(sh.code, 0);

        let conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(Util.hasOwn(conf.devDependencies, 'my-components-app'), false);
        assert.strictEqual(Util.hasOwn(conf.devDependencies, 'component-1'), true);

        conf = Util.readJSONSync(componentConfPath);
        assert.strictEqual(Util.hasOwn(conf.devDependencies, 'my-components-app'), true);
        assert.strictEqual(Util.hasOwn(conf.devDependencies, 'component-1'), true);
    });

    //remove all deps
    it(`exec ${ID} install app,component-1 -c -d`, () => {
        let sh = shelljs.exec(`${ID} install my-components-app,component-1 -c -d -r`);
        assert.strictEqual(sh.code, 0);
        sh = shelljs.exec(`${ID} install my-components-app,component-1 -c -r`);
        assert.strictEqual(sh.code, 0);

        let conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(Util.hasOwn(conf.dependencies, 'my-components-app'), false);
        assert.strictEqual(Util.hasOwn(conf.dependencies, 'component-1'), false);
        assert.strictEqual(Util.hasOwn(conf.devDependencies, 'my-components-app'), false);
        assert.strictEqual(Util.hasOwn(conf.devDependencies, 'component-1'), false);

        conf = Util.readJSONSync(componentConfPath);
        assert.strictEqual(Util.hasOwn(conf.dependencies, 'my-components-app'), false);
        assert.strictEqual(Util.hasOwn(conf.dependencies, 'component-1'), false);
        assert.strictEqual(Util.hasOwn(conf.devDependencies, 'my-components-app'), false);
        assert.strictEqual(Util.hasOwn(conf.devDependencies, 'component-1'), false);

    });

    //===================================================================================

    it(`add invalid dependencies and exec ${ID} install`, () => {

        Util.editJSON(appConfPath, function(json) {
            json.dependencies['invalid-dependency-a'] = '~1.0.1';
            json.devDependencies['invalid-dev-dependency-a'] = '^1.0.1';
            //console.log(json);
            return json;
        });

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

    //===================================================================================

    it('add internal dependencies and install', () => {

        Util.editJSON(appConfPath, function(json) {
            //remove invalid first
            delete json.dependencies['invalid-dependency-a'];
            delete json.devDependencies['invalid-dev-dependency-a'];
            json.dependencies['my-components-component-1'] = '2.0.1';
            json.devDependencies['my-components-component-1'] = '2.0.1';
            //console.log(json);
            return json;
        });

        //reset project conf
        const proConf = Util.readJSONSync(projectConfPath);
        proConf.devDependencies = {};
        Util.writeJSONSync(projectConfPath, proConf);

        const sh = shelljs.exec(`${ID} install -f`);
        assert.strictEqual(sh.code, 0);
    });

    it('check component formatted dependencies', () => {

        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies['my-components-component-1'], '');
        assert.strictEqual(conf.devDependencies['my-components-component-1'], '');

    });

    it('check project package.json for internal', () => {

        assert.strictEqual(fs.existsSync(projectConfPath), true);

        const conf = Util.readJSONSync(projectConfPath);
        assert.ok(conf.dependencies);
        assert.ok(conf.devDependencies);
    });

    it('check link module for internal', () => {
        const internalModulePath = 'node_modules/my-components-component-1';
        assert.strictEqual(fs.existsSync(internalModulePath), true);
        const conf = Util.readJSONSync(`${internalModulePath}/package.json`);
        assert.ok(conf.name, 'my-components-component-1');
    });


    it(`after ${ID} install`, () => {
        Util.editJSON(appConfPath, function(json) {
            delete json.dependencies['console-grid'];
            //console.log(json);
            return json;
        });
        const conf = Util.readJSONSync(appConfPath);
        assert.ok(!conf.dependencies['console-grid']);
    });

});
