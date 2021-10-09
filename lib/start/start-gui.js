const fs = require('fs');
const path = require('path');
const http = require('http');
const EventEmitter = require('events');

const shelljs = require('shelljs');
const marked = require('marked');

const Koa = require('koa');
const KSR = require('koa-static-resolver');

const open = require('open');
const SocketIO = require('socket.io');

const Util = require('../core/util.js');
const Course = require('./start-course.js');

class GUI extends EventEmitter {

    constructor(port) {
        super();
        this.port = port;
        this.socket_list = [];
        this.openBrowser = true;
        this.startServer();
    }

    startServer() {

        const app = new Koa();

        app.use(KSR({
            dirs: [
                `${Util.cliRoot}/assets/`,
                `${__dirname}/www/`,
                Util.nmRoot
            ],
            //max-age=<seconds>
            maxAge: 10,
            gzip: true,
            cache: {}
        }));

        //==============================================
        //socket server
        const server = http.createServer(app.callback());
        const socketIO = SocketIO(server, {
            maxHttpBufferSize: 1e8
        });
        socketIO.on('connection', (client) => {

            client.on('data', (data) => {
                this.socketDataHandler(data);
            });

            client.on('disconnect', function() {
                console.log(`${new Date().toLocaleString()} a GUI user disconnected`);
            });

            //new user connected
            console.log(`${new Date().toLocaleString()} a GUI user connected`);
            clearTimeout(this.timeout_open);

        });

        //for all sockets connects emit message
        const sockets = socketIO.sockets;
        this.setSockets(sockets);

        //================================================
        //start web server finally

        server.listen(this.port, () => {

            const url = `http://localhost:${this.port}`;
            console.log(`${new Date().toLocaleString()} GUI server started: ${url}`);

            if (this.openBrowser) {
                this.timeout_open = setTimeout(function() {
                    console.log(`Open ${url}`);
                    open(url);
                }, 2000);
            }

        });

    }

    switchProject(project) {
        //console.log("switchProject: " + project);
        //send process event
        process.send({
            type: 'switchProject',
            data: project
        });
    }

    //============================================================================================

    setSockets(sockets) {
        this.sockets = sockets;
    }

    sendSocketList() {
        if (!this.socket_list.length) {
            return;
        }
        const self = this;
        clearTimeout(this.timeout_socket_list);
        this.timeout_socket_list = setTimeout(function() {
            self.sendSocketItem();
        }, 0);

    }

    sendSocketItem() {
        const item = this.socket_list.shift();
        if (item && this.sockets) {
            this.sockets.emit('data', item);
        } else {
            console.log('Invalid sockets');
        }
        this.sendSocketList();
    }

    //===================================================================================

    sendMessage(data, style) {
        if (!data) {
            return;
        }
        const html = this.htmlHandler(data);
        this.socket_list.push({
            type: 'message',
            data: {
                data: html,
                style: style
            }
        });
        this.sendSocketList();
    }

    htmlHandler(data) {
        const arr = data.split(/\n/g);
        arr.forEach(function(str, i) {

            //space to &nbsp;
            str = str.replace(/ +/g, function(word) {
                const arr = [];
                arr.length = word.length + 1;
                return arr.join('&nbsp;');
            });
            str = str.replace(/</g, '&lt;');
            str = str.replace(/>/g, '&gt;');

            //0-7
            //'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'

            //font color
            str = str.replace(/\033\[39m/g, '</span>');
            str = str.replace(/\033\[(3[0-7])m/g, '<span class="c$1">');
            str = str.replace(/\033\[(9[0-7])m/g, '<span class="c$1">');

            //background color
            str = str.replace(/\033\[49m/g, '</span>');
            str = str.replace(/\033\[(4[0-7])m/g, '<span class="bg$1">');
            str = str.replace(/\033\[(10[0-7])m/g, '<span class="bg$1">');

            //bold
            str = str.replace(/\033\[1m/g, '<span class="bold">');
            str = str.replace(/\033\[22m/g, '</span>');

            //italic
            str = str.replace(/\033\[3m/g, '<span class="italic">');
            str = str.replace(/\033\[23m/g, '</span>');

            //underline
            str = str.replace(/\033\[4m/g, '<span class="underline">');
            str = str.replace(/\033\[24m/g, '</span>');

            //blink
            str = str.replace(/\033\[5m/g, '<span class="blink">');
            str = str.replace(/\033\[25m/g, '</span>');

            //inverse
            str = str.replace(/\033\[7m/g, '<span class="inverse">');
            str = str.replace(/\033\[27m/g, '</span>');

            //strike
            str = str.replace(/\033\[9m/g, '<span class="strike">');
            str = str.replace(/\033\[29m/g, '</span>');

            //other
            str = str.replace(/\033\[(\d+)m/g, '');

            //link 
            const re = /(http[s]?:\/\/([\w-]+.)+([:\d+])?(\/[\w-./?%&=]*)?)/gi;
            str = str.replace(re, function(a) {
                return `<a href="${a}" target="_blank">${a}</a>`;
            });

            arr[i] = str;
        });

        return `<div>${arr.join('</div><div>')}</div>`;
    }

    sendCMD(data) {
        if (!data) {
            return;
        }
        this.socket_list.push({
            type: 'cmd',
            data: data
        });
        this.sendSocketList();
    }

    sendData(data) {
        if (!data) {
            return;
        }
        this.socket_list.push({
            type: 'data',
            data: data
        });
        this.sendSocketList();
    }

    //===================================================================================

    socketDataHandler(data) {
        if (!data) {
            return;
        }

        const handlers = {
            //only for text message
            message: this.messageHandler,
            //only for sf cmd
            cmd: this.cmdHandler,
            //for data function 
            data: this.dataHandler
        };

        const handler = handlers[data.type];
        if (handler) {
            handler.call(this, data.data);
        }

    }

    messageHandler(message) {
        this.sendMessage(message);
    }

    cmdHandler(cmd) {
        if (!cmd) {
            return;
        }
        this.courseHandler(cmd);
    }

    dataHandler(data) {
        if (!data || !data.name) {
            console.log('invalid data arguments');
            return;
        }
        const handler = this[data.name];
        if (typeof(handler) === 'function') {
            console.log(`data handler: ${data.name}`);
            handler.call(this, data.data);
        } else {
            const msg = `Not found handler: ${data.name}`;
            console.log(msg);
            this.sendMessage(msg, '#ff0000');
        }
    }

    //===================================================================================

    closeCourse() {
        if (!this.course) {
            return false;
        }
        this.course.close();
        this.course = null;
        return true;
    }

    courseHandler(cmd) {
        this.closeCourse();
        this.course = new Course(this, cmd);
    }

    //===================================================================================
    async getProjectInfo() {
        const pc = Util.getProjectConf(true);

        let repository = '';
        if (pc.repository && pc.repository.url) {
            repository = pc.repository.url;
        }

        const branch = await Util.getGitBranch();

        const info = {
            project: Util.formatPath(Util.root),
            repository: repository,
            name: pc.name,
            version: pc.version,
            cliVersion: Util.getCLIVersion(),
            guiHistory: Util.getSetting('guiHistory'),
            list: Util.getComponentList(true),
            branch: branch
        };

        //console.log(JSON.stringify(info, null, 2));
        this.sendData({
            name: 'updateProjectInfo',
            data: info
        });

    }

    getTestSpecs() {
        const specs = {};
        const list = Util.getComponentList();
        list.forEach(function(componentName) {
            const componentPath = Util.getComponentPath(componentName);
            const specsPath = path.resolve(`${componentPath}/test/specs`);
            if (!fs.existsSync(specsPath)) {
                return;
            }
            const files = [];
            Util.forEachFile(specsPath, ['.js'], function(fileName, filePath) {
                let p = path.relative(specsPath, `${filePath}/${fileName}`);
                p = Util.formatPath(p);
                files.push(p);
            });
            specs[componentName] = files;
        });
        this.sendData({
            name: 'updateTestSpecs',
            data: specs
        });
    }

    getTabs() {
        const tabs = Util.getSetting('guiTabs');
        this.sendData({
            name: 'updateTabs',
            data: tabs
        });
    }

    getReadme() {

        //marked
        // marked.setOptions({
        //     renderer: new marked.Renderer(),
        //     highlight: function(code) {
        //         return highlightJs.highlightAuto(code).value;
        //     },
        //     pedantic: false,
        // gfm: true,
        // tables: true,
        // breaks: false,
        // sanitize: true,
        // smartLists: true,
        // smartypants: false,
        //     xhtml: false
        // });

        let readmePath = `${Util.root}/README.md`;
        if (!fs.existsSync(readmePath)) {
            readmePath = `${Util.root}/readme.md`;
        }

        // Compile
        let content = Util.readFileContentSync(readmePath);
        if (!content) {
            content = 'Not found README.md';
        }

        const html = marked(content);
        this.sendData({
            name: 'updateReadme',
            data: html
        });

    }

    async getBrowseInfo(browsePath) {
        browsePath = path.resolve(browsePath || Util.root);
        if (!fs.existsSync) {
            browsePath = Util.root;
        }

        const data = await this.generateBrowseInfo(browsePath);

        //console.log("updateBrowseInfo", data);

        this.sendData({
            name: 'updateBrowseInfo',
            data: data
        });

    }

    generateBrowseFileItem(subName, stats, files) {
        if (subName !== 'package.json') {
            return;
        }
        files.push({
            icon: 'json',
            name: subName,
            unsorted: true,
            size: Util.BF(stats.size),
            mtime: stats.mtime.toLocaleString()
        });
    }

    async generateBrowseDirItem(subName, stats, dirs, browsePath) {
        if (subName.indexOf('.') === 0) {
            return;
        }
        const hasProject = await this.checkBrowseProject(`${browsePath}/${subName}`);
        if (!hasProject) {
            return;
        }
        dirs.push({
            icon: 'dir',
            name: subName,
            mtime: stats.mtime.toLocaleString()
        });
    }

    async checkBrowseProject(folderPath) {

        const isProject = (subName, stats) => {
            if (stats.isFile() && subName === 'package.json') {
                return true;
            }
            if (stats.isDirectory() && subName.indexOf('.') !== 0) {
                return true;
            }
            return false;
        };

        const list = await this.readdir(folderPath);
        for (const subName of list) {
            const subPath = path.resolve(folderPath, subName);
            const stats = await this.stat(subPath);
            if (!stats) {
                continue;
            }
            if (isProject(subName, stats)) {
                return true;
            }
        }
        return false;
    }

    async generateBrowseInfo(browsePath) {

        const dirs = [];
        const files = [];
        const list = await this.readdir(browsePath);
        for (const subName of list) {
            const subPath = path.resolve(browsePath, subName);
            const stats = await this.stat(subPath);
            if (!stats) {
                continue;
            }
            if (stats.isFile()) {
                await this.generateBrowseFileItem(subName, stats, files);
                continue;
            }
            if (stats.isDirectory()) {
                await this.generateBrowseDirItem(subName, stats, dirs, browsePath);
            }
        }

        let rows = [{
            name: '../',
            icon: 'up',
            unsorted: true,
            unsortedTop: true
        }];

        rows = rows.concat(dirs);
        rows = rows.concat(files);

        const gridData = {
            option: {
                sortField: 'name',
                frozenColumn: 1
            },
            columns: [{
                id: 'icon',
                name: '',
                dataType: 'icon',
                resizable: false,
                width: 35
            }, {
                id: 'name',
                name: 'Name',
                width: 200,
                dataType: 'string',
                formatter: 'string'
            }, {
                id: 'mtime',
                name: 'Date modified',
                dataType: 'date',
                width: 150
            }, {
                id: 'size',
                name: 'Size'
            }],
            rows: rows
        };

        return {
            browsePath: browsePath,
            gridData: gridData,
            packageJson: files.length
        };
    }

    //===================================================================================
    updateVersion(version) {
        console.log(`new version: ${version}`);
        Util.updateVersion(version);
        this.sendMessage(`version updated: ${version}`);
    }

    //===================================================================================

    cancel() {
        console.log('cancel running process ...');
        const res = this.closeCourse();
        if (!res) {
            this.sendMessage('Not found running process');
        }
    }

    //===================================================================================

    loadFile(file) {
        if (!file) {
            console.log('invalid file');
            return;
        }
        if (Buffer.isBuffer(file)) {
            file = file.toString('utf8');
        }
        this.sendMessage(file);
    }

    //===================================================================================

    syncFile(data) {
        if (!data) {
            this.sendMessage('Error: Invalid sync data', '#ff0000');
            return;
        }
        const syncPath = path.resolve(data.syncPath);
        if (!fs.existsSync(syncPath)) {
            this.sendMessage(`Error: Not found sync path: ${syncPath}`, '#ff0000');
            return;
        }

        this.sendMessage('Start sync components ...');

        const self = this;
        data.componentList.forEach(function(name) {

            const fromPath = Util.getComponentPath(name);
            if (!fs.existsSync(fromPath)) {
                self.sendMessage(`Ignore: Not found component folder: ${fromPath}`, 'yellow');
                return;
            }

            const fullName = Util.getComponentFullName(name);
            const destPath = path.resolve(syncPath, fullName);
            if (!fs.existsSync(destPath)) {
                self.sendMessage(`Ignore: Not found dest folder: ${destPath}`, 'yellow');
                return;
            }

            //just copy build folder
            const sh = shelljs.cp('-R', `${fromPath}/build`, destPath);
            if (sh.code) {
                self.sendMessage(sh.stderr, '#ff0000');
                return;
            }

            self.sendMessage(`Succeed: sync ${name}`, '#859900');

        });

    }

    readdir(p) {
        return new Promise((resolve) => {
            fs.readdir(p, (err, list) => {
                if (err) {
                    console.log(`ERROR: fs.readdir: ${p}`);
                    resolve([]);
                    return;
                }
                resolve(list);
            });
        });
    }

    stat(p) {
        return new Promise((resolve) => {
            fs.stat(p, (err, stats) => {
                if (err) {
                    //console.log("ERROR: fs.stat: " + p);
                    resolve(null);
                    return;
                }
                resolve(stats);
            });
        });
    }

}

module.exports = GUI;
