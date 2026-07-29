// starfall-cli config
// https://github.com/cenfun/starfall-cli

export default {
    tempPath: '.temp',

    clean: {
        exclude: ['.env', '.ssh', 'id_rsa']
    },

    outdate: {
        exclude: [
            'commander'
        ]
    },

    test: {
        // v8 only (Playwright CDP coverage), see monocart-coverage-reports for options
        coverageOptions: {},
        mocha: {
            timeout: 60 * 1000
        }
    }
};
