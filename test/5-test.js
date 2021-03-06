const fs = require('fs');

const assert = require('assert');
const shelljs = require('shelljs');

const Util = require('../lib/core/util.js');
const ID = Util.id;

describe(`${ID} test`, function() {
    this.timeout(30 * 1000);

    it(`exec ${ID} test`, () => {
        const sh = shelljs.exec(`${ID} test`);
        assert.strictEqual(sh.code, 0);
    });

    it('check component test folder', () => {
        assert.strictEqual(fs.existsSync('.temp/test/app/app.js'), true);
        assert.strictEqual(fs.existsSync('.temp/test/app/app.test.js'), true);

        assert.strictEqual(fs.existsSync('.temp/test/component-1/component-1.js'), true);
        assert.strictEqual(fs.existsSync('.temp/test/component-1/component-1.test.js'), true);
    });

    it('check component coverage folder', () => {

        assert.strictEqual(fs.existsSync('.temp/coverage/app/index.html'), true);
        assert.strictEqual(fs.existsSync('.temp/coverage/app/lcov.info'), true);

        assert.strictEqual(fs.existsSync('.temp/coverage/component-1/index.html'), true);
        assert.strictEqual(fs.existsSync('.temp/coverage/component-1/lcov.info'), true);
    });

});
