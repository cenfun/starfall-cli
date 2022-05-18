module.exports = {

    tempPath: '.temp',
    
    dev: {
        port: 8080,
        path: 'public',
        apiCallback: null,
        apiWatch: ''
    },

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

    clean: {
        exclude: []
    },

    outdate: {
        exclude: [
            //vue-loader": "^15.9.8 for vue2
            //'vue-loader'
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

    pack: {
        path: 'public',
        //custom pack function
        handler: null
    },

    build: {
        //for flatdep
        exclude: [],
        include: [],
        overrides: {
            'axios': {
                browser: {
                    axios: 'dist/axios.min.js'
                },
                dependencies: {}
            },
            'core-js': {
                dependencies: {},
                main: ['client/core.min.js']
            },
            'i18next': {
                dependencies: {},
                main: ['i18next.min.js']
            },
            'select2': {
                dependencies: {},
                main: ['dist/css/select2.css', 'dist/js/select2.full.js']
            },
            'vue': {
                main: ['dist/vue.min.js']
            },
            'vue-router': {
                main: ['dist/vue-router.min.js']
            },
            'xlsx': {
                browser: {},
                dependencies: {},
                main: 'xlsx.mini.js'
            }
        },
        
        //for webpack externals matched root names
        //if externals is jquery, then it will be replaced with jQuery also
        rootNames: {
            'file-saver': 'saveAs',
            'golden-layout': 'GoldenLayout',
            'jquery': 'jQuery',
            'lodash': '_',
            'pdfjs-dist': 'PDFJS',
            'vue': 'Vue',
            'vue-router': 'VueRouter',
            'vuex': 'Vuex'
        },
        
        vendors: ['vendor', 'lib', 'app'],

        alias: {

        },
        esModule: false,

        path: 'dist',
        entryFile: 'index.js',
        // true (MiniCssExtractPlugin), string (no style-loader)
        cssExtract: false,
        externals: []

        // webpackConfig: (conf, Util) => {

        //     conf.module.rules.forEach(rule => {
        //         if (rule.use && Array.isArray(rule.use)) {
        //             rule.use.forEach(item => {
        //                 if (item.loader === 'sass-loader') {
        //                     if (!item.options) {
        //                         item.options = {};
        //                     }
        //                     item.options.additionalData = '';
        //                 } else if (item.loader === 'css-loader') {
        //                     if (!item.options) {
        //                         item.options = {};
        //                     }
        //                     item.options.modules = {
        //                         localIdentName: '[local]'
        //                     };
        //                 }
        //             });
        //         }
        //         if (rule.use && rule.use.loader === 'babel-loader') {
        //             //delete rule.exclude;
        //         }
        //     });
    
        //     return conf;
        // }

        // before: (item, Util) => {
        //     console.log('beforeBuild');
        //     return 0;
        // },

        // after: (item, Util) => {
        //     console.log('afterBuild');
        //     return 0;
        // }

        // beforeAll: (jobList, Util) => {
        //     console.log('beforeBuildAll');
        //     return 0;
        // },

        // afterAll: (option, Util) => {
        //     console.log('afterBuildAll');
        //     return 0;
        // }
    }

};
