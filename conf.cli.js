module.exports = {

    subsPath: 'packages',
    tempPath: '.temp',

    buildPath: 'dist',
    previewPath: 'preview',
    previewApi: null,
    publicPath: 'public',
    srcEntry: 'index.js',

    esModule: false,
    // true (MiniCssExtractPlugin), string (no style-loader)
    cssExtract: false,
    externals: [],

    registry: 'https://registry.npmjs.org/',

    moduleRootNames: {
        'backbone': 'Backbone',
        'exceljs': 'ExcelJS',
        'file-saver': 'saveAs',
        'golden-layout': 'GoldenLayout',
        'jquery': 'jQuery',
        'lodash': '_',
        'pdfjs-dist': 'PDFJS',
        'underscore': '_',
        'vue': 'Vue',
        'vue-custom-element': 'VueCustomElement',
        'vue-router': 'VueRouter',
        'vuex': 'Vuex'
    },

    moduleAlias: {

    },

    moduleOverrides: {

        'core-js': {
            main: [
                'client/core.min.js'
            ],
            dependencies: {}
        },

        'select2': {
            main: [
                'dist/css/select2.css',
                'dist/js/select2.full.js'
            ],
            dependencies: {}
        },

        'i18next': {
            main: ['i18next.min.js'],
            dependencies: {}
        },

        'vue': {
            main: ['dist/vue.min.js']
        },

        'vue-router': {
            main: ['dist/vue-router.min.js']
        },

        'axios': {
            browser: {
                axios: 'dist/axios.min.js'
            },
            dependencies: {}
        },

        'xlsx': {
            browser: {},
            dependencies: {},
            main: 'xlsx.mini.js'
        }
    },

    webpackConfig: (conf, Util) => {
        return conf;
    },

    staticFiles: [],

    vendors: ['vendor', 'app'],

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
        ext: '{css,scss}',
        option: ''
    },

    eslint: {
        ext: '{js,vue}',
        option: ''
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

    //clean option
    clean: {
        exclude: []
    },

    outdate: {
        exclude: [
            //'vue-loader'
        ]
    },

    blame: {
        authorAlias: {
        
        }
    },

    hooks: {

        // beforeBuildAll: (conf, Util) => {
        //     console.log('beforeBuildAll');
        //     return 0;
        // },

        // afterBuildAll: (conf, Util) => {
        //     console.log('afterBuildAll');
        //     return 0;
        // }

        // beforeBuild: (item, Util) => {
        //     console.log('beforeBuild');
        //     return 0;
        // },

        // afterBuild: (item, Util) => {
        //     console.log('afterBuild');
        //     return 0;
        // }

        // 'component-name': {
        //     beforeBuild: (item, Util) => {
        //         console.log('beforeBuild');
        //         return 0;
        //     },

        //     afterBuild: (item, Util) => {
        //         console.log('afterBuild');
        //         return 0;
        //     }
        // }

    }

};
