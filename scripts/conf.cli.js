// starfall-cli config
// https://github.com/cenfun/starfall-cli

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
        exclude: ['.env', '.ssh', 'id_rsa']
    },

    outdate: {
        exclude: [
            // 'stylelint'
            // 'eslint'
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
            ext: '{css,scss,vue}',
            option: ''
        },

        eslint: {
            ext: '{js,vue}',
            option: ''
        }
    },

    test: {
        // istanbul or v8
        coverageProvider: 'istanbul',
        coverageOptions: {},
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

        // customize handler
        // handler: null,

        // output path of pack
        // output: './docs'

        // after: (item, Util) => {
        //     console.log('after pack');
        //     return 0;
        // }
    },

    build: {
        esModule: false,
        // for DefinePlugin
        define: (env) => {
            return {
                __VUE_OPTIONS_API__: true,
                __VUE_PROD_DEVTOOLS__: false,
                __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
            };
        },
        // for flatdep
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
                main: (mode) => (mode === 'production' ? 'dist/vue.runtime.global.prod.js' : 'dist/vue.runtime.global.js')
            },
            'vue-router': {
                dependencies: {},
                main: (mode) => (mode === 'production' ? 'dist/vue-router.global.prod.js' : 'dist/vue-router.global.js')
            },
            'react': {
                dependencies: {},
                main: (mode) => (mode === 'production' ? 'umd/react.production.min.js' : 'umd/react.development.js')
            },
            'react-dom': {
                dependencies: {},
                browser: {},
                main: (mode) => (mode === 'production' ? 'umd/react-dom.production.min.js' : 'umd/react-dom.development.js')
            },
            'prop-types': {
                dependencies: {},
                main: (mode) => (mode === 'production' ? 'prop-types.min.js' : 'prop-types.js')
            },
            'xlsx': {
                browser: {},
                dependencies: {},
                main: 'xlsx.mini.js'
            }
        },

        // for webpack externals matched root names
        // if externals is jquery, then it will be replaced with jQuery also
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
        safeModules: [],

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
