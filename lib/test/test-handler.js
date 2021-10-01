const path = require("path");
const http = require("http");
const Koa = require("koa");
const KSR = require("koa-static-resolver");
const SocketIO = require("socket.io");

const PCR = require("puppeteer-chromium-resolver");

const watch = require("../watch/watch.js");

const testBuildHandler = require("./test-build-handler.js");
const buildTest = testBuildHandler.buildTest;

const Util = require("../core/util.js");
const EC = Util.EC;

const Report = require("./test-report.js");
const reportHandler = Report.generateJobReport;

const generateDeps = function(files) {
    const list = [];
    files.forEach(function(src) {
        src = `${src}`;
        const extname = path.extname(src);
        //console.log(extname, src);
        if (extname === ".css") {
            list.push(`<link href="/${src}" rel="stylesheet" />`);
            return;
        }
        if (extname === ".js") {
            list.push(`<script src="/${src}"></script>`);
            
        }
    });
    return list;
};

const createTestEntry = (job) => {

    let deps = [];
    //ad polyfill for async/await
    deps.push('<script src="/node_modules/ie-polyfill/dist/ie-polyfill.js"></script>');
    //socket 
    deps.push('<script src="/node_modules/socket.io/client-dist/socket.io.min.js"></script>');
    
    //default to mocha
    //https://mochajs.org/#running-mocha-in-the-browser
    deps.push('<script src="/node_modules/mocha/mocha.js"></script>');

    //client
    deps.push('<script src="/client.js"></script>');

    //component deps
    const componentDeps = generateDeps(job.dependencies.files);
    deps = deps.concat(componentDeps);

    const contentDeps = deps.join("\n");

    //boot
    const testConfig = JSON.stringify(job, null, 4);
    const contentBoot = `<script>\nwindow.testAPI.start(${testConfig});\n</script>`;

    const jobTemplate = Util.getTemplate(path.resolve(__dirname, "test-template.html"));
    const html = Util.replace(jobTemplate, {
        title: `Test: ${job.name}`,
        deps: contentDeps,
        boot: contentBoot
    });

    Util.writeFileContentSync(`${job.outputPath}/index.html`, html, true);
};

//===========================================================================================================

const launchBrowser = async (job) => {
    const time_start = Date.now();
    const defaultViewport = Util.getDefaultViewport(job.defaultViewport);
    Util.logMsg(job.name, `[browser] default viewport ${JSON.stringify(defaultViewport)}`);

    //https://peter.sh/experiments/chromium-command-line-switches/
    const browserOption = {
        userDataDir: Util.getBrowserUserDataDir(),
        args: Util.getBrowserLaunchArgs(),
        ignoreDefaultArgs: Util.getBrowserLaunchIgnoreArgs(),
        defaultViewport: defaultViewport
    };

    job.userDataDir = browserOption.userDataDir;

    if (job.debug) {
        browserOption.devtools = true;
    }

    const pcr = await PCR();
    browserOption.executablePath = pcr.executablePath;

    Util.logMsg(job.name, "[browser] launch ...");
    const browser = await pcr.puppeteer.launch(browserOption);
    const chromiumVersion = await browser.version();
    Util.logMsg(job.name, `[browser] ${EC.green("launched")} ${chromiumVersion}${Util.getCost(time_start, 3000)}`);
    return browser;
};

const gcHandler = async (job) => {
    const gc = job.gc;
    if (!gc) {
        return;
    }

    delete job.gc;

    if (gc.watcher) {
        gc.watcher.close();
        gc.watcher = null;
        Util.logMsg(job.name, `[watcher] ${EC.green("closed")}`);
    }

    if (gc.browser) {
        await gc.browser.close();
        gc.browser = null;
        Util.logMsg(job.name, `[browser] ${EC.green("closed")}`);
    }

    if (gc.socketIO) {
        gc.socketIO.close();
        gc.socketIO = null;
        Util.logMsg(job.name, `[socket] ${EC.green("closed")}`);
    }

    if (gc.testServer) {
        gc.testServer.close();
        gc.testServer = null;
        Util.logMsg(job.name, `[test server] ${EC.green("closed")}`);
    }

};

const finishTest = async (job, code) => {
    //resolve
    const resolve = job.resolve;
    if (!resolve) {
        return;
    }
    delete job.resolve;

    await gcHandler(job);
    await Util.delay(500);

    //can not delete user data dir im, mark as finished
    Util.finishBrowserUserDataDir(job.userDataDir);

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
    Util.forEachFile(job.outputPath, [".png"], function(fileName, filePath) {
        const screenshot = `${filePath}/${fileName}`;
        console.log(`remove ${Util.relativePath(screenshot)}`);
        Util.rmSync(screenshot);
    });
};

const onScreenshotHandler = async (job, e) => {
    const sockets = Util.getValue(job, "gc.socketIO.sockets");
    if (!sockets) {
        return;
    }
    const data = e.data;
    const page = job.gc.page;
    if (!page) {
        sockets.emit("data", data);
        return;
    }

    const title = Util.getFileName(data.title);
    const jobId = job.jobId;
    let filename = ["job", jobId, title].join("-");
    filename = filename.replace(/-+/g, "-");
    const ext = path.extname(filename);
    if (ext !== ".png") {
        filename += ".png";
    }
    const time_start = Date.now();
    let filePath = `${job.outputPath}/${filename}`;
    await page.screenshot({
        path: filePath
    });
    filePath = Util.relativePath(filePath);
    console.log(`saved screenshot: ${filePath}${Util.getCost(time_start, 1000)}`);
    data.screenshot = filePath;
    sockets.emit("data", data);
};

const onFinishHandler = (job, e) => {
    const code = reportHandler(job, e.data);
    if (e.data.debug) {
        //in debug mode, just generate report but do not finish
        return;
    }
    finishTest(job, code);
};

const socketDataHandler = async (job, e) => {
    const handlers = {
        onMessage: onMessageHandler,
        onScreenshot: onScreenshotHandler,
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
            job.outputPath,
            //for node_modules, both from project and cli
            Util.root,
            Util.nmRoot,
            //for client
            `${Util.cliRoot}/lib/test/client/`,
            //for favicon or logo
            `${Util.cliRoot}/assets/`
        ],
        //max-age=<seconds>
        maxAge: 1
    }));
    const testServer = http.createServer(app.callback());
    job.gc.testServer = testServer;

    const socketIO = SocketIO(testServer, {
        maxHttpBufferSize: 1e8
    });
    job.gc.socketIO = socketIO;

    socketIO.on("connection", function(socket) {
        Util.logMsg(job.name, `[socket] ${EC.green("connected")} (${socket.id})`);
        socket.on("data", function(e) {
            socketDataHandler(job, e);
        });
        socket.on("disconnect", function(reason) {
            Util.logMsg(job.name, `[socket] ${EC.yellow("disconnected")} (${this.id}) ${reason}`);
        });
    });

    //only for debug, watch self, include src/test folder
    if (job.debug) {
        job.gc.watcher = watch(job.name, async (res) => {
            if (res.folder === "src" || res.folder === "test") {
                const sockets = socketIO.sockets;
                const messageRebuild = `Rebuilding for ${res.type}: ${res.path} ...`;
                sockets.emit("data", {
                    message: messageRebuild
                });
                Util.logYellow(messageRebuild);
                const code = await buildTest(job);
                if (code === 0) {
                    const messageReload = `Reloading for ${res.type}: ${res.path} ...`;
                    sockets.emit("data", {
                        message: messageReload,
                        action: "reload"
                    });
                    Util.logYellow(messageReload);
                }
            }
        });
    }
    const rd = Math.round(Math.random() * (1000 + job.jobId));
    job.port = await Util.generatePort(9876 + rd);
    return new Promise((resolve) => {
        testServer.listen(job.port, function() {
            Util.logMsg(job.name, `[test server] started: ${job.port}`);
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

    const defaultPages = await browser.pages();
    const page = await browser.newPage();
    job.gc.page = page;
    Util.logMsg(job.name, `[page] ${EC.green("created")}`);
    defaultPages.forEach((dp) => {
        dp.close();
    });

    //Uncaught error
    page.on("pageerror", function(err) {
        Util.logMsg(job.name, `[page] ${EC.red(err)}`);
    });

    //crash
    page.on("error", function(err) {
        Util.logMsg(job.name, `[page] ${EC.red(err)}`);
        if (!job.exitError) {
            job.exitError = err;
        }
        finishTest(job, 1);
    });

    //could close window when debugging
    page.on("close", function() {
        Util.logMsg(job.name, `[page] ${EC.green("closed")}`);
        finishTest(job, 1);
    });
    browser.on("disconnected", () => {
        Util.logMsg(job.name, `[browser] ${EC.green("disconnected")}`);
        finishTest(job, 1);
    });

    job.testServerUrl = `http://localhost:${job.port}/#${job.name}`;
    Util.logMsg(job.name, `[page] goto ${EC.cyan(job.testServerUrl)}`);
    await page.goto(job.testServerUrl);

};

//===========================================================================================================


const testHandler = async (job) => {

    Util.jobId = job.jobId;
    Util.jobName = job.jobName;
    Util.componentName = job.name;
    Util.logWorker();

    //create index.html
    await createTestEntry(job);

    return new Promise((resolve) => {
        job.resolve = resolve;
        startTest(job);
    });

};

module.exports = testHandler;
