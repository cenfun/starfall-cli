const StatsReportPlugin = require("webpack-stats-report").StatsReportPlugin;
const VueLoaderPlugin = require("vue-loader").VueLoaderPlugin;

module.exports = {
    mode: "production",
    //mode: "development",
    //devtool: "source-map",
    externals: {
        jquery: "jQuery",
        turbogrid: "turbogrid"
    },
    entry: `${__dirname}/src`,
    output: {
        path: `${__dirname}/dist`,
        filename: "gui.js",
        umdNamedDefine: true,
        library: "gui",
        libraryTarget: "umd"
    },
    cache: true,
    plugins: [new VueLoaderPlugin(), new StatsReportPlugin({
        title: "Stats Report - GUI",
        output: ".temp/stats-report-gui.html"
    })],
    module: {
        rules: [{
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
                loader: "babel-loader",
                options: {
                    cacheDirectory: true,
                    babelrc: false
                }
            }
        }, {
            test: /\.(css|scss)$/,
            sideEffects: true,
            use: [{
                loader: "style-loader",
                options: {
                    //Reuses a single style element
                    injectType: "singletonStyleTag",
                    attributes: {
                        //Add custom attrs to style for debug
                        context: "gui"
                    }
                }
            }, {
                loader: "css-loader",
                options: {
                    url: false,
                    esModule: false,
                    sourceMap: false
                }
            }, {
                // compiles Sass to CSS
                loader: "sass-loader"
            }]
        }, {
            test: /\.(svg|woff)$/i,
            type: "asset/inline"
        }, {
            test: /\.vue$/,
            loader: "vue-loader",
            options: {
                hotReload: false
            }
        }, {
            test: /\.(html|txt)$/,
            type: "asset/source"
        }]
    }
};