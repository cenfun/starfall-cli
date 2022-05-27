const http = require('http');
const Koa = require('koa');
const KSR = require('koa-static-resolver');
const open = require('open');
const SocketIO = require('socket.io');
const EC = require('eight-colors');

const Util = require('../core/util.js');
const build = require('../build/build.js');
const watch = require('../watch/watch.js');

const ProxyMiddleware = require('./proxy-middleware.js');

let timeout_open;
let sockets;
let serverRestart;

// rebuild or reload
const getRefreshType = (res, componentName) => {
    if (res.folder === 'src') {
        return 'rebuild';
    }

    const buildPath = Util.getConfig('build.path');
    if (res.folder === buildPath) {
        return 'reload';
    }
};

const initLiveReload = (componentName) => {

    // watch self and dependencies for auto build
    // include src folder only
    const list = [componentName];

    // only internal module
    const dependencies = Util.getComponentDependencies(componentName);
    if (dependencies) {
        const internals = Util.getInternalDependencies();
        dependencies.modules.forEach(function(item) {
            if (Util.hasOwn(internals, item)) {
                const folderName = Util.getComponentFolderName(item);
                list.push(folderName);
            }
        });
    }

    console.log('watch list for building automatically: ', list);

    watch(list, function(res) {
        
        const type = getRefreshType(res, componentName);
        Util.log(`${EC.magenta(res.name)} ${EC.yellow(type)} for ${EC.magenta(res.folder)} folder ${res.type}: ${res.path}`);

        if (type === 'rebuild') {
            sockets.emit('data', {
                message: `Rebuilding for ${res.type}: ${res.path} ...`
            });
            //no dist removed anymore
            //some times nothing changed in src but rebuilt by file saving
            //but no need reload, just clean message
            build.buildComponent(res.name).then((d) => {
                sockets.emit('data', {
                    message: ''
                });
            });
            return;
        }
        if (type === 'reload') {
            sockets.emit('data', {
                message: `Reloading for ${res.type}: ${res.path} ...`,
                action: 'reload'
            });
        }
    });
};

const initSocketServer = (server, restart) => {
    const socketIO = SocketIO(server, {
        maxHttpBufferSize: 1e8
    });
    socketIO.on('connection', function(client) {

        // client.on('data', function(data) {

        // });

        client.on('disconnect', function() {
            console.log(`${new Date().toString()} ${EC.yellow('a dev page disconnected')}`);
        });

        // new user connected
        console.log(`${new Date().toString()} ${EC.green('a dev page connected')}`);
        clearTimeout(timeout_open);

        if (serverRestart && sockets) {
            sockets.emit('data', {
                message: '',
                action: 'reload'
            });
            serverRestart = false;
        }

    });

    return socketIO.sockets;
};


const devStart = async (componentName, env) => {

    // watch for auto refresh dev
    const componentPath = Util.getComponentPath(componentName);

    // ==================================================================

    const app = new Koa();

    // ==================================================================
    // proxy
    console.log(`${new Date().toString()} proxy env: ${env}`);
    ProxyMiddleware(app, env);


    // ==================================================================
    // static files
    const devPath = Util.getConfig('dev.path');
    app.use(KSR({
        dirs: [
            `${componentPath}/${devPath}/`,
            componentPath,
            Util.root,
            // for livereload
            `${Util.nmRoot}/node_modules/socket-livereload/dist/`,
            `${Util.nmRoot}/node_modules/socket.io/client-dist/`,
            // for favicon or logo
            `${Util.cliRoot}/assets/`
        ],
        // max-age=<seconds>
        maxAge: 1,
        livereload: '\n<script src="/livereload.js" class="livereload" client="socket.io.min.js"></script>\n'
    }));

    // ==================================================================
    const devApiCallback = Util.getConfig('dev.apiCallback');
    if (typeof devApiCallback === 'function') {
        const devApi = devApiCallback();
        if (devApi) {
            const KoaBodyParser = require('koa-bodyparser');
            // https://github.com/koajs/bodyparser
            // must be after proxy, do NOT parse proxy body
            app.use(KoaBodyParser());

            const KoaRouter = require('@koa/router');
            // https://github.com/koajs/router
            const router = new KoaRouter();
            router.all('/api/:action', async (ctx) => {
                await devApi(ctx);
            });

            app.use(router.routes()).use(router.allowedMethods());
        }

    }

    // ==================================================================
   
    const server = http.createServer(app.callback());
    sockets = initSocketServer(server);

    // ==================================================================
    const expectPort = Util.option.port || Util.getConfig('dev.port');
    const port = await Util.generatePort(expectPort);

    const url = `http://localhost:${port}`;
    Util.logGreen(url);
    const iip = Util.getInternalIp();
    const pip = await Util.getPublicIp();

    server.listen(port, function() {
        Util.logLine(`${new Date().toString()} dev server started`);

        Util.consoleGrid.render({
            option: {
                hideHeaders: true
            },
            columns: [{
                id: 'type'
            }, {
                id: 'url',
                formatter: (v) => {
                    return EC.green(v);
                }
            }],
            rows: [{
                url: url,
                type: 'Local'
            }, {
                url: `http://${iip}:${port}`,
                type: 'Internal'
            }, {
                url: `http://${pip}:${port}`,
                type: 'Public'
            }]
        });

        timeout_open = setTimeout(function() {
            console.log(`Open ${url}`);
            open(url);
        }, 2000);

    });

    initLiveReload(componentName);

};

const devHandler = (componentName, restart) => {
    serverRestart = restart;
    // proxy --env -e QA
    // dev(default), qa, stg, local
    let env = Util.option.env;
    if (env) {
        env = `${env}`.toLowerCase();
    }
    Util.logCyan(`dev env: ${env}`);

    devStart(componentName, env);

};

devHandler.sendMessage = function(data) {
    if (sockets) {
        if (typeof data === 'string') {
            data = {
                message: data
            };
        }
        sockets.emit('data', {
            message: data.message,
            action: data.action
        });
    }
};

module.exports = devHandler;
