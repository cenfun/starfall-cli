module.exports = {
    vue: {
        plugin: 'vue',
        extend: 'plugin:vue/essential'
    },

    es2020: {
        plugin: 'es',
        extend: 'plugin:es/no-new-in-es2020'
    },

    es5: {
        plugin: 'es',
        extend: 'plugin:es/no-new-in-es5'
    },

    ie11: {
        plugin: 'es',
        rules: {
            'es/no-for-of-loops': 'error',
            'es/no-set': 'error',
            'es/no-map': 'error'
        }
    }

};
