import path from 'path';
import http from 'http';
import Koa from 'koa';
import KSR from 'koa-static-resolver';
import SocketIO from 'socket.io';
import EC from 'eight-colors';

import watch from '../watch/watch.js';

import {
    state,
    getTemplate,
    replace,
    writeFileSync,
    log,
    delay,
    forEachFile,
    relativePath,
    rmSync,
    getValue,
    getFileName,
    getCost,
    logYellow,
    generatePort,
    launchBrowser
} from '../core/util.js';
import testBuildHandler from './test-build-handler.js';
const buildTest = testBuildHandler.buildTest;


import Report from './test-report.js';
const reportHandler = Report.generateJobReport;

const generateDeps = function(files) {
    const list = [];
    files.forEach(function(src) {
        src = `${src}`;
        const extname = path.extname(src);
        // console.log(extname, src);
        if (extname === '.css') {
            list.push(`<link href="/${src}" rel="stylesheet" />`);
            return;
        }
        if (extname === '.js') {
            list.push(`<script src="/${src}"></script>`);

        }
    });
    return list;
};

const createTestEntry = (job) => {
    const dependencies = generateDeps(job.dependencies.files).join('\n');
    const config = JSON.stringify(job);
    const jobTemplate = getTemplate(path.resolve(import.meta.dirname, 'test-template.html'));
    const html = replace(jobTemplate, {
        'placeholder-title': `Test: ${job.name}`,
        'placeholder-component-dependencies': dependencies,
        'placeholder-config': config
    });
    writeFileSync(`${job.buildPath}/index.html`, html);
};

// ===========================================================================================================

const gcHandler = async (job) => {
    const gc = job.gc;
    if (!gc) {
        return;
    }

    delete job.gc;

    if (gc.watcher) {
        gc.watcher.close();
        gc.watcher = null;
        log(job.name, `[watcher] ${EC.green('closed')}`);
    }

    if (gc.browser) {
        await gc.browser.close();
        gc.browser = null;
        log(job.name, `[browser] ${EC.green('closed')}`);
    }

    if (gc.socketIO) {
        gc.socketIO.close();
        gc.socketIO = null;
        log(job.name, `[socket] ${EC.green('closed')}`);
    }

    if (gc.testServer) {
        gc.testServer.close();
        gc.testServer = null;
        log(job.name, `[test server] ${EC.green('closed')}`);
    }

};

const finishTest = async (job, code) => {
    // resolve
    const resolve = job.resolve;
    if (!resolve) {
        return;
    }
    delete job.resolve;

    await gcHandler(job);
    await delay(500);

    job.code = code;
    resolve(code);
};

const onMessageHandler = function(job, e) {
    const msg = e.data;
    if (!msg) {
        return;
    }
    console.log(msg);
};

const cleanScreenshots = (job) => {
    forEachFile(job.buildPath, ['.png'], function(fileName, filePath) {
        const screenshot = `${filePath}/${fileName}`;
        console.log(`remove ${relativePath(screenshot)}`);
        rmSync(screenshot);
    });
};

const onScreenshotHandler = async (job, e) => {
    const sockets = getValue(job, 'gc.socketIO.sockets');
    if (!sockets) {
        return;
    }
    const data = e.data;
    const page = job.gc.page;
    if (!page) {
        sockets.emit('data', data);
        return;
    }

    const title = getFileName(data.title);
    const jobId = job.jobId;
    let filename = ['job', jobId, title].join('-');
    filename = filename.replace(/-+/g, '-');
    const ext = path.extname(filename);
    if (ext !== '.png') {
        filename += '.png';
    }
    const time_start = Date.now();
    let filePath = `${job.buildPath}/${filename}`;
    let failed = false;
    await page.screenshot({
        path: filePath
    }).catch((ee) => {
        failed = true;
        EC.logRed(ee);
    });
    if (failed) {
        sockets.emit('data', data);
        return;
    }
    filePath = relativePath(filePath);
    console.log(`saved screenshot: ${filePath}${getCost(time_start, 1000)}`);
    data.screenshot = filePath;
    sockets.emit('data', data);
};

const onPageAPIHandler = async (job, e) => {
    const sockets = getValue(job, 'gc.socketIO.sockets');
    if (!sockets) {
        return;
    }
    const data = e.data;
    const page = job.gc.page;
    if (!page) {
        sockets.emit('data', data);
        return;
    }

    const actions = {
        mouse: {
            click: function(x, y, options) {
                return page.mouse.click(x, y, options);
            },
            dblclick: function(x, y, options) {
                return page.mouse.dblclick(x, y, options);
            },
            down: function(options) {
                return page.mouse.down(options);
            },
            move: function(x, y, options) {
                return page.mouse.move(x, y, options);
            },
            up: function(options) {
                return page.mouse.up(options);
            },
            wheel: function(deltaX, deltaY) {
                return page.mouse.wheel(deltaX, deltaY);
            }
        }
    };

    const action = getValue(actions, data.action);
    if (!action) {
        sockets.emit('data', data);
        return;
    }

    data.response = await action.apply(null, data.args);
    sockets.emit('data', data);

};

const onFinishHandler = async (job, e) => {
    if (e.data.debug) {
        // in debug mode, do not finish
        return;
    }

    // generate v8 coverage data
    const page = job.gc.page;
    const [jsCoverage, cssCoverage] = await Promise.all([
        page.coverage.stopJSCoverage(),
        page.coverage.stopCSSCoverage()
    ]);
    const coverageList = [... jsCoverage, ... cssCoverage];
    // console.log('coverage list', coverageList.map((it) => it.url));
    e.data.coverage = coverageList;

    const code = await reportHandler(job, e.data);

    finishTest(job, code);
};

const socketDataHandler = async (job, e) => {
    const handlers = {
        onMessage: onMessageHandler,
        onScreenshot: onScreenshotHandler,
        onPageAPI: onPageAPIHandler,
        onFinish: onFinishHandler
    };
    const handler = handlers[e.type];
    if (handler) {
        await handler.call(this, job, e);
    }
};

const createTestServer = async (job) => {
    const app = new Koa();
    app.use(KSR({
        dirs: [
            job.buildPath,
            // for node_modules, both from project and cli
            state.root,
            // for client
            `${state.cliRoot}/lib/test/client/`,
            // for favicon or logo
            `${state.cliRoot}/assets/`
        ],
        // max-age=<seconds>
        maxAge: 1
    }));
    const testServer = http.createServer(app.callback());
    job.gc.testServer = testServer;

    const socketIO = SocketIO(testServer, {
        maxHttpBufferSize: 1e8
    });
    job.gc.socketIO = socketIO;

    socketIO.on('connection', function(socket) {
        log(job.name, `[socket] ${EC.green('connected')} (${socket.id})`);
        socket.on('data', function(e) {
            socketDataHandler(job, e);
        });
        socket.on('disconnect', function(reason) {
            log(job.name, `[socket] ${EC.yellow('disconnected')} (${this.id}) ${reason}`);
        });
    });

    // only for debug, watch self, include src/test folder
    if (job.debug) {
        job.gc.watcher = watch(job.name, '', async (info) => {
            if (info.type === 'src' || info.type === 'test') {
                const sockets = socketIO.sockets;
                const messageRebuild = `Rebuilding for ${info.event} ${info.type}: ${info.path} ...`;
                sockets.emit('data', {
                    message: messageRebuild
                });
                logYellow(messageRebuild);
                const code = await buildTest(job);
                if (code === 0) {
                    const messageReload = `Reloading for ${info.event} ${info.type}: ${info.path} ...`;
                    sockets.emit('data', {
                        message: messageReload,
                        action: 'reload'
                    });
                    logYellow(messageReload);
                }
            }
        });
    }
    const rd = Math.round(Math.random() * (1000 + job.jobId));
    job.port = await generatePort(9876 + rd);
    return new Promise((resolve) => {
        testServer.listen(job.port, function() {
            log(job.name, `[test server] started: ${job.port}`);
            resolve(testServer);
        });
    });
};

const startTest = async (job) => {

    job.gc = {};

    await cleanScreenshots(job);

    await createTestServer(job);

    const browser = await launchBrowser(job);
    if (!browser) {
        finishTest(job, 1);
        return;
    }
    job.gc.browser = browser;

    const page = await browser.newPage();
    job.gc.page = page;
    log(job.name, `[page] ${EC.green('created')}`);

    await Promise.all([
        page.coverage.startJSCoverage({
            resetOnNavigation: false
        }),
        page.coverage.startCSSCoverage({
            resetOnNavigation: false
        })
    ]);

    // const client = await page.context().newCDPSession(page);
    // await client.send('Page.setTouchEmulationEnabled', {
    //     enabled: true
    // });
    // await client.send('Emulation.setTouchEmulationEnabled', {
    //     enabled: true
    // });
    // await client.send('Emulation.setEmitTouchEventsForMouse', {
    //     enabled: true,
    //     configuration: 'mobile'
    // });


    // Uncaught error
    page.on('pageerror', function(err) {
        log(job.name, `[page] ${EC.red(err)}`);
    });

    // crash
    page.on('error', function(err) {
        log(job.name, `[page] ${EC.red(err)}`);
        if (!job.exitError) {
            job.exitError = err;
        }
        finishTest(job, 1);
    });

    // could close window when debugging
    page.on('close', function() {
        log(job.name, `[page] ${EC.green('closed')}`);
        finishTest(job, 1);
    });
    browser.on('disconnected', () => {
        log(job.name, `[browser] ${EC.green('disconnected')}`);
        finishTest(job, 1);
    });

    job.testServerUrl = `http://localhost:${job.port}/#${job.name}`;
    log(job.name, `[page] goto ${EC.cyan(job.testServerUrl)}`);
    await page.goto(job.testServerUrl);

};

// ===========================================================================================================


const testHandler = async (job) => {

    state.jobId = job.jobId;
    state.jobName = job.jobName;
    state.componentName = job.name;
    log();

    // create index.html
    await createTestEntry(job);

    return new Promise((resolve) => {
        job.resolve = resolve;
        startTest(job);
    });

};

export default testHandler;
