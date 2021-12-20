const fs = require('fs');
const assert = require('assert');
const shelljs = require('shelljs');

const Util = require('../lib/core/util.js');

const appConfPath = 'packages/app/package.json';
const componentConfPath = 'packages/component-1/package.json';
const projectConfPath = 'package.json';

describe('sf install', function() {
    this.timeout(60 * 1000);
      
    it('before sf install', () => {
        Util.editJSON(appConfPath, function(json) {
            json.dependencies['console-grid'] = 'latest';
            //console.log(json);
            return json;
        });
        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies['console-grid'], 'latest');
    });

    it('exec sf install', () => {
        //force install first
        const sh = shelljs.exec('sf install -f');
        assert.strictEqual(sh.code, 0);
    });

    it('check component package.json', () => {
        assert.strictEqual(fs.existsSync(appConfPath), true);
        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.version, '');
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

    it('exec sf install component-1 -c app --remove', () => {
        const sh = shelljs.exec('sf install component-1 -c app --remove');
        assert.strictEqual(sh.code, 0);

        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies.hasOwnProperty('component-1'), false);
    });

    it('exec sf install component-1 -c app --remove --dev', () => {
        const sh = shelljs.exec('sf install component-1 -c app --remove --dev');
        assert.strictEqual(sh.code, 0);

        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.devDependencies.hasOwnProperty('component-1'), false);
    });

    //===================================================================================
    //dependencies
    it('exec sf install app,component-1 -c', () => {
        const sh = shelljs.exec('sf install app,component-1 -c');
        assert.strictEqual(sh.code, 0);

        let conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies.hasOwnProperty('app'), false);
        assert.strictEqual(conf.dependencies.hasOwnProperty('component-1'), true);

        conf = Util.readJSONSync(componentConfPath);
        assert.strictEqual(conf.dependencies.hasOwnProperty('app'), true);
        assert.strictEqual(conf.dependencies.hasOwnProperty('component-1'), false);
    });

    //devDependencies
    it('exec sf install app,component-1 -c --dev', () => {
        const sh = shelljs.exec('sf install app,component-1 -c --dev');
        assert.strictEqual(sh.code, 0);

        let conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.devDependencies.hasOwnProperty('app'), false);
        assert.strictEqual(conf.devDependencies.hasOwnProperty('component-1'), true);

        conf = Util.readJSONSync(componentConfPath);
        assert.strictEqual(conf.devDependencies.hasOwnProperty('app'), true);
        assert.strictEqual(conf.devDependencies.hasOwnProperty('component-1'), false);
    });

    //remove all deps
    it('exec sf install app,component-1 -c -d', () => {
        let sh = shelljs.exec('sf install app,component-1 -c -d -r');
        assert.strictEqual(sh.code, 0);
        sh = shelljs.exec('sf install app,component-1 -c -r');
        assert.strictEqual(sh.code, 0);

        let conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies.hasOwnProperty('app'), false);
        assert.strictEqual(conf.dependencies.hasOwnProperty('component-1'), false);
        assert.strictEqual(conf.devDependencies.hasOwnProperty('app'), false);
        assert.strictEqual(conf.devDependencies.hasOwnProperty('component-1'), false);

        conf = Util.readJSONSync(componentConfPath);
        assert.strictEqual(conf.dependencies.hasOwnProperty('app'), false);
        assert.strictEqual(conf.dependencies.hasOwnProperty('component-1'), false);
        assert.strictEqual(conf.devDependencies.hasOwnProperty('app'), false);
        assert.strictEqual(conf.devDependencies.hasOwnProperty('component-1'), false);

    });

    //===================================================================================

    it('add invalid dependencies and exec sf install', () => {

        Util.editJSON(appConfPath, function(json) {
            json.dependencies['component-1'] = '';
            json.dependencies['invalid-dependency-a'] = '~1.0.1';
            json.devDependencies['invalid-dev-dependency-a'] = '^1.0.1';
            //console.log(json);
            return json;
        });

        const sh = shelljs.exec('sf install');
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
            json.dependencies['component-1'] = '2.0.1';
            json.devDependencies['component-1'] = '2.0.1';
            //console.log(json);
            return json;
        });

        //reset project conf
        const proConf = Util.readJSONSync(projectConfPath);
        proConf.devDependencies = {};
        Util.writeJSONSync(projectConfPath, proConf);

        const sh = shelljs.exec('sf install');
        assert.strictEqual(sh.code, 0);
    });

    it('check component formatted dependencies', () => {

        const conf = Util.readJSONSync(appConfPath);
        assert.strictEqual(conf.dependencies['component-1'], '');
        assert.strictEqual(conf.devDependencies['component-1'], '');

    });

    it('check project package.json for internal', () => {
        
        assert.strictEqual(fs.existsSync(projectConfPath), true);

        const conf = Util.readJSONSync(projectConfPath);
        assert.ok(conf.dependencies);
        assert.ok(conf.devDependencies);
    });

    it('check link module for internal', () => {
        const internalModulePath = 'node_modules/component-1';
        assert.strictEqual(fs.existsSync(internalModulePath), true);
        const conf = Util.readJSONSync(`${internalModulePath}/package.json`);
        assert.ok(conf.name, 'component-1');
    });


    it('after sf install', () => {
        Util.editJSON(appConfPath, function(json) {
            delete json.dependencies['console-grid'];
            //console.log(json);
            return json;
        });
        const conf = Util.readJSONSync(appConfPath);
        assert.ok(!conf.dependencies['console-grid']);
    });

});
