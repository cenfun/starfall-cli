module.exports = {
    create: function(option) {
        return {

            default: {
                '/api': {
                    target: 'http://localhost:8080',
                    pathRewrite: {
                        '^/api/': '/'
                    },
                    headers: {

                    }
                }
            },

            dev: {},
            qa: {},
            stg: {}

        };
    }
};
