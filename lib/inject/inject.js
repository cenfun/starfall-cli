const fs = require('fs');
const path = require('path');
const Util = require('../core/util.js');
// ====================================================================================================

const getHTMLInjectContent = function(item, type) {
    const injectContent = [];
    item.injectList.forEach(function(it) {
        if (it.type === type || type === 'html') {
            if (it.html) {
                injectContent.push(it.html);
            }
        }
    });
    return injectContent;
};

const injectPageHtmlType = (item, type, block, content, option) => {

    // <!--inject:css:start-->
    // <!--inject:css:end-->
    const hasBlock = block.test(content);
    if (!hasBlock) {
        return content;
    }

    const injectContent = getHTMLInjectContent(item, type);

    option.block = true;
    content = content.replace(block, function(match) {
        // console.log("match: ", arguments);
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

// ====================================================================================================

const getScriptInjectDeps = function(item) {
    const injectList = item.injectList;
    const list = [];
    list.push('var inject_list = [');
    injectList.forEach((it, i) => {
        let src = `    "${it.src}"`;
        if (i !== injectList.length - 1) {
            src += ',';
        }
        list.push(src);
    });
    list.push('];');
    // console.log(list);
    return list;
};

const injectPageScriptHandler = (item, content, option) => {

    /* inject:start*/
    /* inject:end*/
    const scriptBlock = /(([ \t]*)\/\*\s*inject:start\s*\*\/)(\r|\n|.)*?(\/\*\s*inject:end\s*\*\/)/gi;
    const hasScriptBlock = scriptBlock.test(content);
    if (!hasScriptBlock) {
        return content;
    }

    option.block = true;
    const scriptInjectDeps = getScriptInjectDeps(item);
    content = content.replace(scriptBlock, function(match) {
        // console.log("match: ", arguments);
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

// ====================================================================================================

const injectPageItemHandler = (item, filePath, option) => {

    let content = Util.readFileContentSync(filePath);
    if (!content) {
        return 0;
    }

    option.change = false;
    option.block = false;
    option.EOL = Util.getEOL(content);
    
    // inject into html first, only debug list
    content = injectPageHtmlHandler(item, content, option);

    // inject into script next
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
    Util.logYellow('Not found inject block.');
    console.log('HTML inject block example: <!--inject:start--> <!--inject:end-->');
    console.log('Script inject block example: /*inject:start*/ /*inject:end*/');
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

    Util.logGreen('finish inject dependencies');

    return 0;
};


const injectComponent = (item) => {

    const devPath = item.devPath;
    // check dev path
    if (!fs.existsSync(devPath)) {
        Util.logYellow(`Not found component dev path: ${devPath}`);
        return 0;
    }

    console.log('inject dependencies to dev html ...');
    const files = fs.readdirSync(devPath);

    const pageList = [];
    for (let i = 0, l = files.length; i < l; i++) {
        const filename = files[i];
        // only html file
        if (path.extname(filename) === '.html') {
            // console.log(filename);
            pageList.push(`${devPath}/${filename}`);
        }
    }

    // console.log(devPath, files, pageList);

    return injectPageListHandler(item, pageList);
};

// ====================================================================================================

const getInjectItem = (item, f) => {

    // f is relative root, change to relative dev path
    const file = Util.relativePath(f, item.devPath);

    // query only for pack cli
    const query = item.query;

    let src = file;
    const extname = path.extname(src);
    // after extname added query string
    if (query) {
        const replacedQuery = Util.replace(query, item.buildENV);
        src += `?${replacedQuery}`;
    }
    // console.log(extname, src);

    if (extname === '.css') {
        return {
            type: 'css',
            file: file,
            src: src,
            html: `<link href="${src}" rel="stylesheet" />`
        };
    }

    return {
        type: 'js',
        file: file,
        src: src,
        html: `<script src="${src}"></script>`
    };

};


const injectModule = (item) => {

    Util.jobName = 'inject';
    Util.logWorker();

    // park has generated injectFiles
    let injectFiles = item.injectFiles;

    // generate inject files,
    if (!Util.isList(injectFiles)) {
        injectFiles = Util.getInjectFiles(item);
    }
    // console.log(injectFiles);

    item.injectList = injectFiles.map((f) => {
        return getInjectItem(item, f);
    });

    return injectComponent(item);
};

module.exports = injectModule;
