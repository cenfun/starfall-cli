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
            loader: 'vue-loader',
            options: {
                hotReload: false
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
                    //https://babeljs.io/docs/en/babel-plugin-proposal-object-rest-spread
                    // ... to Object.assign()
                    assumptions: {
                        setSpreadProperties: true
                    },
                    plugins: [
                        [`${option.nmRoot}/node_modules/@babel/plugin-proposal-object-rest-spread`, {
                            useBuiltIns: true
                        }]
                    ],
                    presets: [
                        `${option.nmRoot}/node_modules/@babel/preset-env`,
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
                }
            }
        };

        const cssLoader = {
            loader: 'css-loader',
            options: {
                esModule: false,
                //import: false,
                sourceMap: false
            }
        };

        // const lzLoader = {
        //     loader: "lz-loader",
        //     options: {
        //         esModule: false,
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

        rules.push({
            test: /\.less$/,
            use: [styleLoader, cssLoader, {
                loader: 'less-loader',
                options: {
                    lessOptions: {
                        strictMath: true
                    }
                }
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

        rules.push({
            test: /\.(html|txt)$/,
            type: 'asset/source'
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

            target: ['web', 'es5'],
            
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
