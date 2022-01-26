const assert = require('assert');
const shelljs = require('shelljs');

const Util = require('../lib/core/util.js');
const ID = Util.id;

describe(`${ID} publish`, function() {
    this.timeout(50 * 1000);

    it(`exec ${ID} publish patch -d`, () => {
        const sh = shelljs.exec(`${ID} publish patch -d`);
        assert.strictEqual(sh.code, 0);
    });

    it('check project patch version', () => {
        const conf = Util.readJSONSync('package.json');
        assert.strictEqual(conf.version, '1.0.1');
    });

    it('check sub component patch version', () => {

        const confApp = Util.readJSONSync('packages/app/package.json');
        assert.strictEqual(confApp.version, '1.0.1');
        assert.ok(confApp.dependencies['my-components-component-1'], '~1.0.1');

        const confComponent1 = Util.readJSONSync('packages/component-1/package.json');
        assert.strictEqual(confComponent1.version, '1.0.1');

    });


    it(`exec ${ID} publish minor -d`, () => {
        const sh = shelljs.exec(`${ID} publish minor -d`);
        assert.strictEqual(sh.code, 0);
    });

    it('check project minor version', () => {
        const conf = Util.readJSONSync('package.json');
        assert.strictEqual(conf.version, '1.1.0');
    });

    it('check sub component minor version', () => {

        const confApp = Util.readJSONSync('packages/app/package.json');
        assert.strictEqual(confApp.version, '1.1.0');
        assert.ok(confApp.dependencies['my-components-component-1'], '~1.1.0');

        const confComponent1 = Util.readJSONSync('packages/component-1/package.json');
        assert.strictEqual(confComponent1.version, '1.1.0');

    });


});
