// https://eslint.org/docs/rules/

const coveredRules = {
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-lonely-if': 'off',
    'no-mixed-operators': 'off',
    'no-prototype-builtins': 'off',
    'no-unused-vars': ['error', {
        'args': 'none',
        'vars': 'local'
    }]
};

// plugin special rules
const sonarjsRules = {
    'sonarjs/cognitive-complexity': 'off',
    'sonarjs/no-collapsible-if': 'off',
    'sonarjs/no-duplicate-string': 'off',
    'sonarjs/no-identical-functions': 'off',
    'sonarjs/no-nested-template-literals': 'warn',
    'sonarjs/prefer-single-boolean-return': 'off'
};

module.exports = {
    'root': true,
    // system globals
    'env': {
        'node': true,
        'browser': true,
        'amd': true,
        'commonjs': true,
        'es6': true,
        'mocha': true
    },
    // other globals
    'globals': {
        'assert': true
    },

    'plugins': [
        'sonarjs',
        'chain',
        'vue',
        'html'
    ],

    'extends': [
        'plus',
        'plugin:sonarjs/recommended',
        'plugin:chain/recommended',
        'plugin:vue/recommended'
    ],

    'parserOptions': {
        'ecmaVersion': 'latest',
        'sourceType': 'module'
    },

    'rules': {
        ... coveredRules,
        ... sonarjsRules
    }
};
