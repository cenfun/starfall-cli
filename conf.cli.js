//starfall-cli config
//https://github.com/cenfun/starfall-cli

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
            'inquirer'
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
        // before: (item, Util) => {
        //     console.log('before pack');
        //     return 0;
        // },

        //customize handler
        //handler: null,

        //path of pack
        //path: './docs'

        // after: (item, Util) => {
        //     console.log('after pack');
        //     return 0;
        // }
    },

    build: {
        esModule: false,
        //for DefinePlugin
        define: {
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false
        },
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
            'i18next': {
                dependencies: {},
                main: ['i18next.min.js']
            },
            'vue': {
                dependencies: {},
                main: 'dist/vue.runtime.global.prod.js',
                main_development: 'dist/vue.runtime.global.js'
            },
            'react': {
                dependencies: {},
                main: 'umd/react.production.min.js',
                main_development: 'umd/react.development.js'
            },
            'react-dom': {
                dependencies: {},
                browser: {},
                main: 'umd/react-dom.production.min.js',
                main_development: 'umd/react-dom.development.js'
            },
            'prop-types': {
                dependencies: {},
                main: 'prop-types.min.js',
                main_development: 'prop-types.js'
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
            'vuex': 'Vuex',
            'react': 'React',
            'react-dom': 'ReactDOM',
            'prop-types': 'PropTypes'
        },

        vendors: ['vendor', 'bundle', 'app'],

        alias: {

        },

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
        //     console.log('before build');
        //     return 0;
        // },

        // after: (item, Util) => {
        //     console.log('after build');
        //     return 0;
        // }

        // beforeAll: (jobList, Util) => {
        //     console.log('before build all');
        //     return 0;
        // },

        // afterAll: (option, Util) => {
        //     console.log('after build all');
        //     return 0;
        // }
    }

};
