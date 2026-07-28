// https://eslint.org/docs/rules/

import plus from 'eslint-config-plus';

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
export default [
    plus
];
