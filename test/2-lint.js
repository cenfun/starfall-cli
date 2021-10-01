const fs = require("fs");
const assert = require("assert");
const shelljs = require("shelljs");

const Util = require("../lib/core/util.js");

describe("sf lint", function() {
    this.timeout(10 * 1000);

    it("before sf lint", () => {
        assert.strictEqual(fs.existsSync("packages/app/src/style-lint.css"), false);
        assert.strictEqual(fs.existsSync("packages/app/src/es-lint.js"), false);

        Util.editFile("packages/app/src/style-lint.css", function() {
            return ".my-class{\nfont-size:12px;display:block\n}";
        });

        Util.editFile("packages/app/src/es-lint.js", function() {
            return "var a=1 \n var b = '2';";
        });

        assert.strictEqual(fs.existsSync("packages/app/src/style-lint.css"), true);
        assert.strictEqual(fs.existsSync("packages/app/src/es-lint.js"), true);
    });


    it("exec sf lint", () => {
        const sh = shelljs.exec("sf lint");
        // no-unused-vars
        assert.strictEqual(sh.code, 1);
    });

    it("check files after lint - auto format css/js", () => {

        const css = Util.readFileContentSync("packages/app/src/style-lint.css");
        assert.strictEqual(css.replace(/\r?\n/g, ""), ".my-class {    font-size: 12px;    display: block;}");

        const js = Util.readFileContentSync("packages/app/src/es-lint.js");
        assert.strictEqual(js.replace(/\r?\n/g, ""), 'const a = 1;const b = "2";');
        

        Util.editFile("packages/app/src/es-lint.js", function(c) {
            return `${c} \n console.log(a+b)`;
        });
        
    });

    it("exec sf lint", () => {
        const sh = shelljs.exec("sf lint");
        assert.strictEqual(sh.code, 0);
    });

    it("check files after lint - auto format css/js", () => {

        const js = Util.readFileContentSync("packages/app/src/es-lint.js");
        assert.strictEqual(js.replace(/\r?\n/g, ""), 'const a = 1;const b = "2";console.log(a + b);');
        
    });

});
