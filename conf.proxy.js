module.exports = {
    create: function(option) {
        const service = {

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


        return service;
    }
};
