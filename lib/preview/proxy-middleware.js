const HPM = require('http-proxy-middleware');
const createProxyMiddleware = HPM.createProxyMiddleware;
const KoaConnect = require('koa-connect');

const Util = require('../core/util.js');

const defaultOption = {

    //string, ['debug', 'info', 'warn', 'error', 'silent']. Default: 'info'
    logLevel: 'debug',

    //timeout (in ms) for outgoing proxy requests
    proxyTimeout: 2 * 60 * 1000,

    //timeout (in ms) for incoming requests
    timeout: 60 * 1000,

    //true/false, adds host to request header
    changeOrigin: true,

    onError: function(err, req, res) {
        console.log(err);
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });
        res.end('Proxy request error. Please check firewall or network on server.');
    },

    onProxyReq: function(proxyReq, req, res) {
        proxyReq.setHeader('x-koa-http-proxy', 'request');
    },

    onProxyRes: function(proxyRes, req, res) {
        res.setHeader('x-koa-http-proxy', 'response');
    }

};

const getProxy = function(context, option) {

    //console.log("added proxy: " + context + " => " + option.target);
    const proxyOption = Object.assign({}, defaultOption, option);

    return KoaConnect(createProxyMiddleware(context, proxyOption));

};

const proxyMiddleware = function(app, env) {

    //init header
    app.use(async (ctx, next) => {

        //check requestid
        // if (!ctx.req.headers["x-api-requestid"]) {
        //     const requestid = Util.generateGUID();
        //     ctx.req.headers["x-api-requestid"] = requestid;
        //     //console.log('set request header x-api-requestid: ' + requestid);
        // }

        await next();
    });

    const confProxy = Util.createConf('proxy', {
        env: env
    });

    const conf = Object.assign({}, confProxy.default, confProxy[env]);
    for (const context in conf) {
        const option = conf[context];
        if (option) {
            app.use(getProxy(context, option));
        }
    }
};

module.exports = proxyMiddleware;
