module.exports = {

    tempPath: '.temp',

    buildPath: 'dist',
    
    previewPath: 'preview',
    previewApiCallback: null,
    previewApiWatch: '',

    publicPath: 'public',
    srcEntry: 'index.js',

    start: {
        port: 3000,
        history: 2000,
        tabs: [
            // {
            //     title: "Custom Page 1",
            //     content: "<h1>Custom content 1</h1>"
            // }, {
            //     title: "Custom Page 2",
            //     content: "<h1>Custom content 2<h2>"
            // }
        ]
    },

    //custom pack function
    pack: null,

    //clean option
    clean: {
        exclude: []
    },

    outdate: {
        exclude: [
            //vue-loader": "^15.9.8 for vue2
            'vue-loader'
        ]
    },

    blame: {
        authorAlias: {
        
        }
    },

    lint: {
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
        }
    },

    test: {
        mocha: {
            timeout: 60 * 1000
        }
    },

    precommit: {
        gitHook: true,
        enable: 'lint + build + test'
    },

    build: {
        exclude: [],
        include: [],
        overrides: {

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
        rootNames: {
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
        vendors: ['vendor', 'lib', 'app'],

        alias: {

        },
        esModule: false,

        // true (MiniCssExtractPlugin), string (no style-loader)
        cssExtract: false,
        externals: [],

        webpackConfig: (conf, Util) => {
            return conf;
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
