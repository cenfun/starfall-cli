const http = require('http');
const Koa = require('koa');
const KSR = require('koa-static-resolver');
const open = require('open');
const SocketIO = require('socket.io');

const Util = require('../core/util.js');
const EC = Util.EC;
const build = require('../build/build.js');
const watch = require('../watch/watch.js');

const ProxyMiddleware = require('./proxy-middleware.js');


let timeout_open;

//rebuild or reload
const getRefreshType = (res, componentName) => {
    if (res.folder === 'src') {
        return 'rebuild';
    }

    const buildPath = Util.getSetting('buildPath');
    if (res.folder === buildPath) {
        return 'reload';
    }

    const previewPath = Util.getSetting('previewPath');
    if (res.name === componentName && res.folder === previewPath) {

        //preview/src
        if (res.path.indexOf(`${previewPath}/src/`) !== -1) {
            return 'rebuild';
        }

        return 'reload';
    }

};

const initLiveReload = (sockets, componentName, dependencies) => {
    //watch self and dependencies for auto build
    //include src folder only
    const list = [componentName];

    //only internal module
    const internals = Util.getInternalDependencies();
    dependencies.modules.forEach(function(item) {
        if (internals.hasOwnProperty(item)) {
            const folderName = Util.getComponentFolderName(item);
            list.push(folderName);
        }
    });

    console.log('watch list for building automatically: ', list);

    watch(list, function(res) {
        
        const type = getRefreshType(res, componentName);
        console.log(`${EC.magenta(res.name)} ${EC.yellow(type)} for ${EC.magenta(res.folder)} folder ${res.type}: ${res.path}`);

        if (type === 'rebuild') {
            sockets.emit('data', {
                message: `Rebuilding for ${res.type}: ${res.path} ...`
            });
            build.buildComponent(res.name, res.folder);
        } else if (type === 'reload') {
            sockets.emit('data', {
                message: `Reloading for ${res.type}: ${res.path} ...`,
                action: 'reload'
            });
        }
    });
};

const initSocketServer = (server) => {
    const socketIO = SocketIO(server, {
        maxHttpBufferSize: 1e8
    });
    socketIO.on('connection', function(client) {

        client.on('data', function(data) {

        });

        client.on('disconnect', function() {
            console.log(`${new Date().toString()} ${EC.yellow('a preview page disconnected')}`);
        });

        //new user connected
        console.log(`${new Date().toString()} ${EC.green('a preview page connected')}`);
        clearTimeout(timeout_open);

    });

    return socketIO.sockets;
};


const previewStart = async (componentName, env, dependencies) => {

    //watch for auto refresh preview
    const componentPath = Util.getComponentPath(componentName);

    //==================================================================

    const app = new Koa();

    //==================================================================
    //proxy
    console.log(`${new Date().toString()} proxy env: ${env}`);
    ProxyMiddleware(app, env);


    //==================================================================
    //static files
    const previewPath = Util.getSetting('previewPath');
    app.use(KSR({
        dirs: [
            `${componentPath}/${previewPath}/`,
            componentPath,
            Util.root,
            //for livereload
            `${Util.nmRoot}/node_modules/socket-livereload/dist/`,
            `${Util.nmRoot}/node_modules/socket.io/client-dist/`,
            //for favicon or logo
            `${Util.cliRoot}/assets/`
        ],
        //max-age=<seconds>
        maxAge: 1,
        livereload: '\n<script src="/livereload.js" class="livereload" client="socket.io.min.js"></script>\n'
    }));

    //==================================================================
    const previewApi = Util.getSetting('previewApi');
    if (previewApi) {
        const KoaBodyParser = require('koa-bodyparser');
        //https://github.com/koajs/bodyparser
        //must be after proxy, do NOT parse proxy body
        app.use(KoaBodyParser());

        const KoaRouter = require('@koa/router');
        //https://github.com/koajs/router
        const router = new KoaRouter();
        router.all('/api/:action', async (ctx) => {
            await previewApi(ctx);
        });

        app.use(router.routes()).use(router.allowedMethods());
    }

    //==================================================================
   
    const server = http.createServer(app.callback());
    const sockets = initSocketServer(server);

    //==================================================================
    const expectPort = Util.option.port || 3000;
    const port = await Util.generatePort(expectPort);

    const url = `http://localhost:${port}`;
    Util.logGreen(url);
    const iip = Util.getInternalIp();
    const pip = await Util.getPublicIp();

    server.listen(port, function() {
        Util.logStart(`${new Date().toString()} preview server started`);

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

    initLiveReload(sockets, componentName, dependencies);

};

const previewComponent = async (componentName, env) => {

    //build first
    const info = await build.buildComponent(componentName);
    if (!info) {
        return 1;
    }

    const d = Util.getComponentDependencies(componentName);
    if (!d) {
        return 1;
    }

    return previewStart(componentName, env, d);
};


const previewModule = async (componentName) => {

    //proxy --env -e QA
    //dev(default), qa, stg, local
    let env = Util.option.env;
    if (env) {
        env = (`${env}`).toUpperCase();
    }
    Util.logCyan(`preview env: ${env}`);

    const list = Util.getCurrentComponentList(componentName);
    //preview only one
    let name = list[0];
    if (list.length > 1) {
        name = list.find(item => item === 'app');
        if (!name) {
            name = list[0];
        }
    }
    if (!name) {
        Util.logRed(`ERROR: Not found component: ${componentName}`);
        return;
    }

    const exitCode = await previewComponent(name, env);
    //do NOT exit if no error
    if (exitCode) {
        process.exit(exitCode);
    }
};

module.exports = previewModule;
