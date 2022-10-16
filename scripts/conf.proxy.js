module.exports = {
    create: function(option) {
        return {

            default: {
                '/my-api-name': {
                    target: 'http://localhost:8080',
                    pathRewrite: {
                        '^/my-api-name/': '/'
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
