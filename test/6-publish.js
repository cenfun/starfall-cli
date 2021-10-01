const assert = require("assert");
const shelljs = require("shelljs");

const Util = require("../lib/core/util.js");


describe("sf publish", function() {
    this.timeout(50 * 1000);

    it("exec sf publish patch -p -d", () => {
        const sh = shelljs.exec("sf publish patch -p -d");
        assert.strictEqual(sh.code, 0);
    });

    it("check project patch version", () => {
        const conf = Util.readJSONSync("package.json");
        assert.strictEqual(conf.version, "1.0.1");
    });

    it("check sub component patch version", () => {

        const confApp = Util.readJSONSync("packages/app/package.json");
        assert.strictEqual(confApp.version, "1.0.1");
        assert.ok(confApp.dependencies["component-1"], "~1.0.1");

        const confComponent1 = Util.readJSONSync("packages/component-1/package.json");
        assert.strictEqual(confComponent1.version, "1.0.1");

    });


    it("exec sf publish minor -p -d", () => {
        const sh = shelljs.exec("sf publish minor -p -d");
        assert.strictEqual(sh.code, 0);
    });

    it("check project minor version", () => {
        const conf = Util.readJSONSync("package.json");
        assert.strictEqual(conf.version, "1.1.0");
    });

    it("check sub component minor version", () => {

        const confApp = Util.readJSONSync("packages/app/package.json");
        assert.strictEqual(confApp.version, "1.1.0");
        assert.ok(confApp.dependencies["component-1"], "~1.1.0");

        const confComponent1 = Util.readJSONSync("packages/component-1/package.json");
        assert.strictEqual(confComponent1.version, "1.1.0");

    });


});
