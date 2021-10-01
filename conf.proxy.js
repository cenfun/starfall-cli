module.exports = {
    create: function(option) {
        const service = {

            /*
            //proxy example:
            "/api": {
                DEV: {
                    target: '',
                    pathRewrite: {
                        '^/api/': '/service/'
                    },
                    headers: {
                    
                    }
                },
                QA: {
                    target: '',
                    headers: {
                    
                    }
                },
                STG: {
                    target: '',
                    headers: {
        
                    }
                },
                LOCAL: {
                    target: 'http://localhost:8080',
                    pathRewrite: {
                        '^/api/': '/'
                    },
                    headers: {
                        
                    }
                }
            }
            */

        };


        return service;
    }
};
