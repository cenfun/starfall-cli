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
        'assert': true,
        'delay': true,
        'page': true
    },

    'plugins': [
        'sonarjs',
        'chain',
        'vue',
        // 'react',
        'html'
    ],

    'extends': [
        'plugin:sonarjs/recommended',
        'plugin:chain/recommended',
        'plugin:vue/recommended',
        // 'plugin:react/recommended',
        'plus'
    ],

    'parserOptions': {
        'ecmaVersion': 'latest',
        'sourceType': 'module'
    },

    'rules': {
        'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
        'sonarjs/cognitive-complexity': 'off',
        'sonarjs/no-collapsible-if': 'off',
        'sonarjs/no-duplicate-string': 'off',
        'sonarjs/no-identical-functions': 'off',
        'sonarjs/no-nested-template-literals': 'warn',
        'sonarjs/prefer-single-boolean-return': 'off'
    }
};
