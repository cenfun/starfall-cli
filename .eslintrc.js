// https://eslint.org/docs/rules/
module.exports = {
    'root': true,
    // system globals
    'env': {
        'node': true,
        'browser': true,
        'worker': true,
        'amd': true,
        'commonjs': true,
        'es6': true,
        'mocha': true
    },
    // other globals
    'globals': {

    },

    'plugins': [
        'vue',
        // 'react',
        'html'
    ],

    'extends': [
        'plugin:vue/recommended',
        // 'plugin:react/recommended',
        'plus'
    ],

    'parserOptions': {
        'ecmaVersion': 'latest',
        'sourceType': 'module'
    },

    'rules': {
        'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn'
    }
};
