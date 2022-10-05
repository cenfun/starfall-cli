const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

//https://webpack.js.org/configuration/

module.exports = {

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
            test: /\.m?js$/,
            resourceQuery: {
                not: [/url/, /raw/, /file/]
            },
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
            type: 'asset/inline'
        });

        //========================================================================
        //resourceQuery
        //https://webpack.js.org/guides/asset-modules/#replacing-inline-loader-syntax

        //asset/inline exports a data URI of the asset.
        //Previously achievable by using url-loader.
        rules.push({
            resourceQuery: /url/,
            type: 'asset/inline'
        });

        //asset/source exports the source code of the asset.
        //Previously achievable by using raw-loader.
        rules.push({
            resourceQuery: /raw/,
            type: 'asset/source'
        });

        //asset/resource emits a separate file and exports the URL.
        //Previously achievable by using file-loader.
        rules.push({
            resourceQuery: /file/,
            type: 'asset/resource'
        });

        //========================================================================

        //console.log("webpack externals:");
        //console.log(externals);

        const library = option.esModule ? {
            type: 'module'
        } : {
            name: option.componentName,
            type: 'umd',
            umdNamedDefine: true
        };

        //es module no need source map
        const devtool = option.esModule ? false : 'source-map';

        return {

            mode: mode,

            //replace with component entry
            entry: '',

            //https://webpack.js.org/configuration/output/
            output: {

                // the target directory for all output files
                path: '',
                // the filename template for entry chunks
                filename: '',
                // the name of the exported library
                library: library

            },

            //https://webpack.js.org/configuration/other-options/#cache
            cache: true,

            target: ['web'],

            //https://webpack.js.org/configuration/devtool/#devtool
            devtool: devtool,

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
                syncWebAssembly: true,
                outputModule: option.esModule
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

            externalsType: library.type,
            externals: option.externals

        };
    }
};
