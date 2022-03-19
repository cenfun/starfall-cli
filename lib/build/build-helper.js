const fs = require('fs');
const path = require('path');
const Util = require('../core/util.js');
//https://terser.org/docs/api-reference
const Terser = require('terser');

//https://github.com/parcel-bundler/parcel-css
//http://goalsmashers.github.io/css-minification-benchmark/
//TODO
//const parcelCss = require('@parcel/css');

const postcss = require('postcss');
const postcssUrl = require('postcss-url');
const cssnano = require('cssnano');

const minifyJs = async (absFilePath) => {
    const code = Util.readFileContentSync(absFilePath);
    if (!code) {
        return;
    }
    console.log(`minify js with Terser: ${Util.relativePath(absFilePath)} ...`);
    //do NOT add wrapper, because some of module do NOT register to global
    //code = "(function(window){" + code + "})(window);";
    const options = {
        output: {
            comments: false
        },
        nameCache: {}
    };
    const result = await Terser.minify(code, options);
    if (result.error) {
        console.log(result.error);
        return;
    }
    fs.writeFileSync(absFilePath, result.code, 'utf8');
    console.log(`minified js: ${path.basename(absFilePath)}`);
};

const minifyCss = async (absFilePath) => {
    const code = Util.readFileContentSync(absFilePath);
    if (!code) {
        return;
    }
    console.log(`minify css with PostCSS/CssNano: ${Util.relativePath(absFilePath)} ...`);
    const plugins = [cssnano];
    const result = await postcss(plugins).process(code, {
        //for map
        from: absFilePath
    });
    fs.writeFileSync(absFilePath, result.css, 'utf8');
    console.log(`minified css: ${path.basename(absFilePath)}`);
};

const loadCss = async (cssFile, content) => {
    //bundle url: fonts and images
    const options = {
        url: 'inline'
    };
    const result = await postcss().use(postcssUrl(options)).process(content, {
        from: cssFile
    });
    return result.css;
};

module.exports = {
    minifyJs,
    minifyCss,
    loadCss
};