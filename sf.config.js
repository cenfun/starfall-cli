// starfall-cli config
// https://github.com/cenfun/starfall-cli

export default {
    tempPath: '.temp',

    clean: {
        drillDown: ['node_modules', '.pnpm'],
        exclude: ['.env', '.ssh', 'id_rsa']
    },

    outdate: {
        exclude: [

        ]
    }
};
