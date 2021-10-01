const fs = require("fs");
const path = require("path");
const Util = require("../core/util.js");
//====================================================================================================

const getHTMLInjectContent = function(item, type) {
    const injectContent = [];
    //alway full list for html injection
    item.injectFullList.forEach(function(item) {
        if (item.type === type || type === "html") {
            if (item.html) {
                injectContent.push(item.html);
            }
        }
    });
    return injectContent;
};

const injectPageHtmlType = (item, type, block, content, option) => {

    //<!--inject:css:start-->
    //<!--inject:css:end-->
    const hasBlock = block.test(content);
    if (!hasBlock) {
        return content;
    }

    const injectContent = getHTMLInjectContent(item, type);

    option.block = true;
    content = content.replace(block, function(match) {
        //console.log("match: ", arguments);
        const prevStr = arguments[0];
        const list = [arguments[1]].concat(injectContent).concat(arguments[4]);
        const str = list.join(option.EOL + arguments[2]);
        if (str !== prevStr) {
            option.change = true;
        }
        return str;
    });

    return content;

};

const injectPageHtmlHandler = (item, content, option) => {

    const injectBlock = {
        css: /(([ \t]*)<!--\s*inject:css:start\s*-->)(\r|\n|.)*?(<!--\s*inject:css:end\s*-->)/gi,
        js: /(([ \t]*)<!--\s*inject:js:start\s*-->)(\r|\n|.)*?(<!--\s*inject:js:end\s*-->)/gi,
        svg: /(([ \t]*)<!--\s*inject:svg:start\s*-->)(\r|\n|.)*?(<!--\s*inject:svg:end\s*-->)/gi,
        html: /(([ \t]*)<!--\s*inject:start\s*-->)(\r|\n|.)*?(<!--\s*inject:end\s*-->)/gi
    };

    for (const k in injectBlock) {
        content = injectPageHtmlType(item, k, injectBlock[k], content, option);
    }

    return content;
};

//====================================================================================================

const generateScriptInjectDeps = function(list, name, deps) {
    list.push(`var ${name} = [`);
    deps.forEach((item, i) => {
        let src = `    "${item.src}"`;
        if (i !== deps.length - 1) {
            src += ",";
        }
        list.push(src);
    });
    list.push("];");
};

const getScriptInjectDeps = function(item) {
    const list = [];
    if (item.injectList) {
        generateScriptInjectDeps(list, "inject_list", item.injectList);
        generateScriptInjectDeps(list, "inject_debug_list", item.injectFullList);
    } else {
        generateScriptInjectDeps(list, "inject_list", item.injectFullList);
    }
    //console.log(list);
    return list;
};

const injectPageScriptHandler = (item, content, option) => {

    /*inject:start*/
    /*inject:end*/
    const scriptBlock = /(([ \t]*)\/\*\s*inject:start\s*\*\/)(\r|\n|.)*?(\/\*\s*inject:end\s*\*\/)/gi;
    const hasScriptBlock = scriptBlock.test(content);
    if (!hasScriptBlock) {
        return content;
    }

    option.block = true;
    const scriptInjectDeps = getScriptInjectDeps(item);
    content = content.replace(scriptBlock, function(match) {
        //console.log("match: ", arguments);
        const prevStr = arguments[0];
        const list = [arguments[1]].concat(scriptInjectDeps).concat(arguments[4]);
        const str = list.join(option.EOL + arguments[2]);
        if (str !== prevStr) {
            option.change = true;
        }
        return str;
    });

    return content;
};

//====================================================================================================

const injectPageItemHandler = (item, filePath, option) => {

    let content = Util.readFileContentSync(filePath);
    if (!content) {
        return 0;
    }

    option.change = false;
    option.block = false;
    option.EOL = Util.getEOL(content);
    
    //inject into html first, only debug list
    content = injectPageHtmlHandler(item, content, option);

    //inject into script next
    content = injectPageScriptHandler(item, content, option);

    if (option.block) {
        option.blockNum += 1;
    }

    if (option.change) {
        option.changeNum += 1;
        Util.writeFileContentSync(filePath, content);
        console.log(`Updated html: ${filePath}`);
    }

    return 0;

};

const showTips = () => {
    Util.logYellow("Not found inject block.");
    console.log("HTML inject block example: <!--inject:start--> <!--inject:end-->");
    console.log("Script inject block example: /*inject:start*/ /*inject:end*/");
};


const injectPageListHandler = async (item, pageList) => {

    if (!pageList.length) {
        return 0;
    }

    const option = {
        changeNum: 0,
        blockNum: 0
    };

    const tasks = [];
    pageList.forEach(function(filePath) {
        tasks.push(() => {
            return injectPageItemHandler(item, filePath, option);
        });
    });

    await Util.tasksResolver(tasks);

    if (!option.blockNum) {
        showTips();
    }

    if (option.changeNum) {
        console.log(`${option.changeNum} files changed`);
    }

    Util.logGreen("finish inject dependencies");

    return 0;
};


const injectComponent = (item) => {

    const previewPath = item.previewPath;
    //check preview path
    if (!fs.existsSync(previewPath)) {
        Util.logYellow(`Not found component preview path: ${previewPath}`);
        return 0;
    }

    console.log("inject dependencies to preview html ...");
    const files = fs.readdirSync(previewPath);
    const pageList = [];
    for (let i = 0, l = files.length; i < l; i++) {
        const filename = files[i];
        //only html file
        if (filename.substr(-5) === ".html") {
            //console.log(filename);
            pageList.push(previewPath + filename);
        }
    }

    return injectPageListHandler(item, pageList);
};

//====================================================================================================

const getInjectItem = (item, f) => {

    //f is relative root, change to relative preview path
    let file = Util.relativePath(f, item.previewPath);
    //only for bundle
    if (item.inject) {
        if (f.indexOf("node_modules") === 0) {
            file = f;
        } else {
            file = Util.relativePath(f, item.componentPath);
        }
    }

    //hash and query only for sf pack cli
    const hash = item.hash;
    const query = item.query;

    let src = Util.getFilenameWithHash(file, hash);
    const extname = path.extname(src);
    //after extname added query string
    if (query) {
        const replacedQuery = Util.replace(query, item.buildENV);
        src += `?${replacedQuery}`;
    }
    //console.log(extname, src);

    if (extname === ".css") {
        return {
            type: "css",
            file: file,
            src: src,
            html: `<link href="${src}" rel="stylesheet" />`
        };
    }

    return {
        type: "js",
        file: file,
        src: src,
        html: `<script src="${src}"></script>`
    };

};

const getInjectList = (item) => {
    if (!item.bundleFiles) {
        //if nothing bundled using full list
        return;
    }
    let list = [].concat(item.bundleFiles);
    //if not all in one
    if (!item.all) {
        if (item.buildCssFile) {
            list.push(item.buildCssFile);
        }
        if (item.buildFile) {
            list.push(item.buildFile);
        }
        if (item.previewFile) {
            list.push(item.previewFile);
        }
    }
    list = list.map(f => {
        return getInjectItem(item, f);
    });
    return list;
};

const getInjectFullList = (item) => {

    //if no dependencies files copied by pack
    const injectList = item.injectList;
    if (item.noNeedDependenciesFiles && injectList) {
        item.injectList = null;
        return [].concat(injectList);
    }

    let list = [].concat(item.dependencies.files);
    if (item.buildCssFile) {
        list.push(item.buildCssFile);
    }
    if (item.buildFile) {
        list.push(item.buildFile);
    }
    if (item.previewFile) {
        list.push(item.previewFile);
    }
    list = list.map(f => {
        return getInjectItem(item, f);
    });
    return list;
};

const getBuildMain = (item) => {
    let main = Util.relativePath(item.buildFile, item.componentPath);
    if (item.bundleName && item.all) {
        const buildPath = Util.getSetting("buildPath");
        main = `${buildPath}/${item.bundleName}.js`;
    }
    return main;
};

const getBuildOutputs = function(item) {

    const buildFiles = [];
    if (item.buildCssFile) {
        buildFiles.push(item.buildCssFile);
    }
    if (item.buildFile) {
        buildFiles.push(item.buildFile);
    }
    //no need preview files for outputs
    
    let list = [].concat(buildFiles);
    if (item.bundle) {
        if (item.all) {
            //bundle (all in one)
            list = [].concat(item.bundleFiles);
        } else {
            //vendor + build
            list = [].concat(item.bundleFiles).concat(buildFiles);
        }
    }

    list = list.filter(item => item);
    list = list.map(f => {
        return Util.relativePath(f, item.componentPath);
    });
    
    return list;
};

const updateMainBrowser = (item, conf) => {
    let changed = false;

    //update main
    const main = getBuildMain(item);
    if (main !== conf.main) {
        conf.main = main;
        changed = true;
    }

    //update browser
    const outputs = getBuildOutputs(item);
    //console.log(outputs);
    if (outputs.length > 1) {
        Util.logCyan("add package browser for extracted files ...");
        const browser = {};
        outputs.forEach(f => {
            const extname = path.extname(f);
            let filename = path.basename(f, extname);

            //remove .bundle from filename
            const type = path.extname(filename);
            if (type === ".bundle") {
                filename = path.basename(filename, type);
            }

            //css key
            if (extname === ".css") {
                filename += "-css";
            }
            browser[filename] = f;
        });
        conf.browser = browser;
        changed = true;
    } else {
        if (conf.browser) {
            delete conf.browser;
            changed = true;
        }
    }

    return changed;
};

const updatePackage = function(item) {

    const conf = Util.getComponentConf(item.name, true);

    //update main and browser
    let changed = updateMainBrowser(item, conf);

    //update dependencies for publish
    //empty component package.json dependencies, do NOT install again
    if (item.bundle === "publish" && item.bundleName) {
        Util.logCyan(`Remove ${item.name} dependencies when publish a bundle ...`);
        conf.dependencies = {};
        changed = true;
    }
    
    if (changed) {
        Util.saveComponentConf(item.name, conf);
    }
};

const injectModule = (item) => {

    Util.jobName = "inject";
    Util.logWorker();

    //bundleFiles => .vendor => dependencies.files
    //buildCssFile
    //buildFile
    //previewFile
    //bundleFiles => .bundle => all in one

    updatePackage(item);

    //generate inject list
    item.injectList = getInjectList(item);
    item.injectFullList = getInjectFullList(item);

    return injectComponent(item);
};

module.exports = injectModule;
