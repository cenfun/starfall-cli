const fs = require("fs");
const path = require("path");
const Util = require("../core/util.js");
const EC = Util.EC;

const beautify = require("js-beautify");

const formatModule = (name) => {

    if (!name) {
        console.log(EC.red("ERROR: require a file"));
        process.exit(1);
        return;
    }

    const filePath = path.resolve(name);
    if (!fs.existsSync(filePath)) {
        console.log(EC.red(`ERROR: Not found: ${filePath}`));
        process.exit(1);
        return;
    }

    const code = Util.readFileContentSync(filePath);
    if (!code) {
        console.log(EC.red(`ERROR: Not found content: ${filePath}`));
        process.exit(1);
        return;
    }

    let str = code;
    const ext = path.extname(filePath);
    if (ext === ".css" || ext === ".scss") {
        str = beautify.css(code);
    } else if (ext === ".js") {
        str = beautify.js(code, Util.getBeautifyOption());
    } else {
        console.log(EC.yellow(`Unsupported ext: ${filePath}`));
        return;
    }

    Util.writeFileContentSync(filePath, str, true);

    console.log(`${EC.green("saved")} ${filePath}`);

};

module.exports = formatModule;
