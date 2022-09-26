const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

//https://webpack.js.org/configuration/

module.exports = {

    /* eslint-disable max-statements */
    create: function(option) {

        //========================================================================

        const modes = {
            production: 'production',
            development: 'development'
        };
        const mode = modes[option.mode] || modes.production;


        const plugins = [];
        const rules = [];

        //========================================================================
        //vue loader

        const VueLoaderPlugin = require(`${option.nmRoot}/node_modules/vue-loader`).VueLoaderPlugin;
        plugins.push(new VueLoaderPlugin());

        const ruleVUE = {
            test: /\.vue$/,
            use: {
                loader: 'vue-loader',
                options: {
                    hotReload: false
                }
            }
        };
        rules.push(ruleVUE);

        //========================================================================
        //babel-loader
        //https://babeljs.io/
        const ruleJS = {
            test: /\.(js|ts)$/,
            exclude: /node_modules/,
            use: {
                loader: 'babel-loader',
                options: {
                    cacheDirectory: true,
                    babelrc: false,
                    presets: [
                        [`${option.nmRoot}/node_modules/@babel/preset-env`, {
                            targets: [
                                'defaults',
                                'not IE 11',
                                'maintained node versions'
                            ]
                        }],
                        [`${option.nmRoot}/node_modules/@babel/preset-react`, {

                        }],
                        `${option.nmRoot}/node_modules/@babel/preset-typescript`
                    ]
                }
            }
        };
        rules.push(ruleJS);

        //========================================================================

        const styleLoader = {
            loader: 'style-loader',
            options: {
                //Reuses a single style element
                injectType: 'singletonStyleTag',
                attributes: {
                    //Add custom attrs to style for debug
                    context: option.componentName || ''
                },
                esModule: option.esModule
            }
        };

        const cssLoader = {
            loader: 'css-loader',
            options: {
                esModule: option.esModule,
                //import: false,
                sourceMap: false
            }
        };

        // const lzLoader = {
        //     loader: "lz-loader",
        //     options: {
        //         esModule: option.esModule,
        //         compressor: "css-loader"
        //     }
        // };

        rules.push({
            test: /\.css$/,
            use: [styleLoader, cssLoader]
        });

        rules.push({
            test: /\.scss$/,
            use: [styleLoader, cssLoader, {
                loader: 'sass-loader'
            }]
        });

        //========================================================================

        rules.push({
            test: /\.(ttf|eot|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
            type: 'asset/inline'
        });

        rules.push({
            test: /\.(png|jpg|gif|svg)$/,
            type: 'asset/inline'
        });

        //do NOT add "css" as asset string, use css-loader toString()
        rules.push({
            test: /\.(html|txt|md)$/,
            type: 'asset/source'
        });

        rules.push({
            test: /\.wasm$/,
            type: 'webassembly/async'
        });

        //========================================================================

        //console.log("webpack externals:");
        //console.log(externals);

        return {

            mode: mode,

            //replace with component entry
            entry: '',

            output: {

                // the target directory for all output files
                path: '',
                // the filename template for entry chunks
                filename: '',
                // the name of the exported library
                library: option.componentName,

                // the type of the exported library
                libraryTarget: 'umd',
                // use a named AMD module in UMD library
                umdNamedDefine: true
            },

            //https://webpack.js.org/configuration/other-options/#cache
            cache: true,

            target: ['web'],

            //https://webpack.js.org/configuration/devtool/#devtool
            devtool: 'source-map',

            optimization: {
                //minimize: true, auto enabled with production mode
                minimizer: [
                    new TerserPlugin({
                        terserOptions: {
                            output: {
                                comments: false
                            }
                        },
                        extractComments: false
                    }),
                    new CssMinimizerPlugin({
                        minimizerOptions: {
                            preset: ['default', {
                                discardComments: {
                                    removeAll: true
                                }
                            }]
                        }
                    })
                ]
            },

            experiments: {
                asyncWebAssembly: true
            },

            //for webpack loader path
            resolveLoader: {
                modules: [`${option.nmRoot}/node_modules`]
            },

            module: {
                rules: rules
            },

            resolve: {
                modules: [
                    'node_modules',
                    `${option.nmRoot}/node_modules`
                ],
                alias: option.alias,
                extensions: ['.js', '.vue', '.json']
            },

            plugins: plugins,

            externals: option.externals

        };
    }
};
