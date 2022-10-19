//starfall-cli config
//https://github.com/cenfun/starfall-cli

module.exports = {

    build: {

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
