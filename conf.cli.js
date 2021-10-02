module.exports = {

    subsPath: "packages",
    tempPath: ".temp",

    buildPath: "dist",
    previewPath: "preview",
    publicPath: "public",
    srcEntry: "index.js",

    cssExtract: false,

    infoRegistry: "https://registry.npmjs.org/",
    publishRegistry: "https://registry.npmjs.org/",

    moduleRootNames: {
        "backbone": "Backbone",
        "exceljs": "ExcelJS",
        "file-saver": "saveAs",
        "golden-layout": "GoldenLayout",
        "jquery": "jQuery",
        "lodash": "_",
        "pdfjs-dist": "PDFJS",
        "underscore": "_",
        "vue": "Vue",
        "vue-custom-element": "VueCustomElement",
        "vue-router": "VueRouter",
        "vuex": "Vuex"
    },

    moduleAlias: {

    },

    moduleOverrides: {

        "core-js": {
            main: [
                "client/core.min.js"
            ],
            dependencies: {}
        },

        "select2": {
            main: [
                "dist/css/select2.css",
                "dist/js/select2.full.js"
            ],
            dependencies: {}
        },

        "i18next": {
            main: ["i18next.min.js"],
            dependencies: {}
        },

        "vue": {
            main: ["dist/vue.min.js"]
        },

        "vue-router": {
            main: ["dist/vue-router.min.js"]
        },

        "axios": {
            browser: {
                axios: "dist/axios.min.js"
            },
            dependencies: {}
        },

        "xlsx": {
            browser: {},
            dependencies: {},
            main: "xlsx.mini.js"
        }
    },

    webpackConfig: (conf, Util) => {
        return conf;
    },

    staticFiles: [],

    testFrameworkOption: {
        timeout: 60 * 1000
    },

    //default to auto, depends on CPUs
    multiprocessing: {
        // lint: false,
        // build: false,
        // test: false
    },

    //default to true
    failFast: {
        // lint: false,
        // build: false,
        // test: false
    },

    //default to true
    preCommit: {
        // lint: false,
        // build: false,
        // test: false
    },

    addPreCommitHook: true,

    injectIgnore: {},

    naming: {
        required: false
    },

    stylelint: {
        required: false,
        ext: "{css,scss}",
        option: ""
    },

    eslint: {
        ext: "js",
        option: ""
    },

    guiHistory: 2000,
    guiPort: 10000,
    guiTabs: [
        // {
        //     title: "Custom Page 1",
        //     content: "<h1>Custom content 1</h1>"
        // }, {
        //     title: "Custom Page 2",
        //     content: "<h1>Custom content 2<h2>"
        // }
    ],

    //custom pack function
    pack: null,

    hooks: {

        // beforeAutotest: async (conf, Util) => {
        //     return 0;
        // },

        // afterAutotest: async (conf, Util) => {
        //     return 0;
        // },

        // "component-name": {
        //     beforeBuild: async (item, Util) => {
        //         console.log(item);
        //         item.beforeBuild = true;
        //         return 0;
        //     },

        //     afterBuild: async (item, Util) => {
        //         console.log(item);
        //         return 0;
        //     }
        // }

    }

};
