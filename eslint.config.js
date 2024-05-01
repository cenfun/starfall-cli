// https://eslint.org/docs/rules/

const plus = require('eslint-config-plus');

plus.files = [
    '*.js',
    '**/lib/**/*.js',
    '**/src/**/*.js'
];

plus.ignores = [
    '**/dist/*',
    '.temp/*'
];

// https://eslint.org/docs/latest/use/configure/configuration-files
module.exports = [
    plus
];
