const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const Koa = require('koa');
const KSR = require('koa-static-resolver');
const SocketIO = require('socket.io');
const EC = require('eight-colors');

const Util = require('../core/util.js');
const build = require('../build/build.js');
const watch = require('../watch/watch.js');

// const ProxyMiddleware = require('./proxy-middleware.js');

let timeout_open;
let sockets;
let serverRestart;

// rebuild or reload
const getRefreshAction = (info, componentName) => {
    // no component name is file change, not component change
    if (!info.name) {
        // do not build when file remove, sometimes file will be clean at beginning
        if (info.event === 'unlink') {
            return;
        }
        info.name = componentName;
        info.type = 'file';
        return 'rebuild';
    }
    if (info.type === 'src') {
        return 'rebuild';
    }
    return 'reload';
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

    const devWatch = Util.option.watch;
    if (devWatch) {
        Util.logCyan(`[dev] watch: ${devWatch}`);
    }

    console.log('watch list for building automatically: ', list);

    let isBuilding = false;

    watch(list, devWatch, function(info) {
        // console.log('watch info', info);
        const action = getRefreshAction(info, componentName);
        if (!action) {
            return;
        }

        if (action === 'rebuild') {
            Util.log(`${EC.yellow('rebuild')} for ${EC.magenta(info.event)} ${info.type}: ${info.path}`);
            sockets.emit('data', {
                message: `Rebuilding for ${info.event} ${info.type}: ${info.path} ...`
            });

            // do not reload in building, may multiple dist files will be changed
            isBuilding = true;

            build.buildComponent(info.name).then((d) => {
                isBuilding = false;

                // after built reload once
                Util.log(`${EC.yellow('reload after rebuild')} for ${EC.magenta(info.event)} ${info.type}: ${info.path}`);
                sockets.emit('data', {
                    message: `Reloading for ${info.event} ${info.type}: ${info.path} ...`,
                    action: 'reload'
                });

            });
            return;
        }

        if (action === 'reload' && !isBuilding) {
            Util.log(`${EC.yellow('reload')} for ${EC.magenta(info.event)} ${info.type}: ${info.path}`);
            sockets.emit('data', {
                message: `Reloading for ${info.event} ${info.type}: ${info.path} ...`,
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

const showIpInfo = async (protocol, port) => {
    const iip = Util.getInternalIp();
    const pip = await Util.getPublicIp();
    Util.CG({
        options: {
            headerVisible: false
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
            url: `${protocol}://localhost:${port}`,
            type: 'Local'
        }, {
            url: `${protocol}://${iip}:${port}`,
            type: 'Internal'
        }, {
            url: `${protocol}://${pip}:${port}`,
            type: 'Public'
        }]
    });
};

const openUrl = (url) => {

    if (Util.option.silent) {
        return;
    }

    timeout_open = setTimeout(function() {
        console.log(`Open ${url}`);
        Util.open(url);
    }, 2000);

};

const createServer = (app) => {

    if (Util.option.ssl) {

        Util.logCyan('You are using https for localhost. run "mkcert -install" to create a local CA. (mkcert.dev)');

        const options = {
            key: fs.readFileSync(path.resolve(__dirname, 'ssl/localhost-key.pem')),
            cert: fs.readFileSync(path.resolve(__dirname, 'ssl/localhost-cert.pem'))
        };

        return https.createServer(options, app.callback());
    }

    return http.createServer(app.callback());

};


const devStart = async (componentName, env) => {

    // watch for auto refresh dev
    const componentPath = Util.getComponentPath(componentName);

    // ==================================================================

    const app = new Koa();

    // ==================================================================
    // proxy
    console.log(`${new Date().toString()} proxy env: ${env}`);
    // ProxyMiddleware(app, env);


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
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        // max-age=<seconds>
        maxAge: 1,
        livereload: '\n<script src="/livereload.js" class="livereload" client="/socket.io.min.js"></script>\n'
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

    const server = createServer(app);
    sockets = initSocketServer(server);

    // ==================================================================

    const protocol = Util.option.ssl ? 'https' : 'http';

    const expectPort = Util.getConfig('dev.port');
    const port = await Util.generatePort(expectPort);

    const url = `${protocol}://localhost:${port}`;

    server.listen(port, function() {
        Util.logLine(`${new Date().toString()} dev server started`);
        showIpInfo(protocol, port);
        openUrl(url);
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
    if (env) {
        Util.logCyan(`[dev] env: ${env}`);
    }

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
