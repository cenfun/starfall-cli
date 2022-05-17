const child_process = require('child_process');
const Util = require('../core/util.js');

const Course = function(gui, cmd) {
    this.gui = gui;
    this.cmd = `${cmd}`;
    this.init();
};

Course.prototype = {
    closed: false,

    init: function() {

        Util.logStart(this.cmd);

        this.gui.sendCMD({
            start: true,
            silent: true,
            cmd: this.cmd
        });

        const args = this.cmd.split(' ');
        const name = args.shift();

        if (name === Util.id) {
            this.cliHandler(args);
            return;
        }

        if (name === 'n') {
            const newCmd = args.join(' ');
            this.openNew(newCmd);
            return;
        }

        this.run(this.cmd);

        return this;
    },

    needOpenNew: function(args) {
        const subCmd = args.shift();
        // dev
        if (subCmd === 'dev') {
            return true;
        }
        // test in debug mode
        if (subCmd === 'test') {
            if (args.includes('-d') || args.includes('--debug')) {
                return true;
            }
        }
        return false;
    },

    cliHandler: function(args) {
        if (this.needOpenNew(args)) {
            this.openNew(this.cmd);
            return;
        }
        this.run(this.cmd);
    },

    getNewWindowScript: function(command) {
        let script = '';
        if (process.platform === 'win32') {
            // for windows cmd
            script = `start ${command}`;
        } else {
            // for mac
            const cd = `cd ${Util.root} && `;
            script = `osascript -e 'tell application "Terminal" to do script "${cd}${command}"'`;
        }
        return script;
    },

    openNew: function(cmd) {

        const script = this.getNewWindowScript(cmd);
        // console.log(script);

        const self = this;
        this.worker = child_process.exec(script, function(err, stdout, stderr) {
            if (err) {
                console.log(err);
                return;
            }
            // close if not 3000ms later
            self.closeForNew();
        });

        // open new, remove button loading status after 3000ms
        setTimeout(function() {
            self.closeForNew();
        }, 3000);

    },

    run: function(command) {

        const self = this;
        this.worker = child_process.exec(command, {
            // 10M
            maxBuffer: 10 * 1024 * 1024
        });

        this.worker.stdout.on('data', function(data) {
            self.sendMessage(data.toString());
        });

        this.worker.stderr.on('data', function(data) {
            self.sendMessage(data.toString());
        });

        this.worker.on('close', function(code) {
            self.closeForFinish(code);
        });

        return this;
    },

    sendMessage: function(msg, style) {
        if (this.closed) {
            return;
        }
        this.gui.sendMessage(msg, style);
    },

    closeForNew: function() {
        if (this.closed) {
            return;
        }

        this.kill();

        this.gui.sendCMD({
            cmd: this.cmd,
            code: 0
        });

        this.gui = null;
    },

    closeForFinish: function(code) {

        console.log('closeForFinish');

        if (this.closed) {
            return;
        }

        this.kill();

        this.gui.sendCMD({
            cmd: this.cmd,
            code: code
        });

        this.gui = null;
    },

    // close by public API
    close: function() {

        if (this.closed) {
            return;
        }

        this.sendMessage(`Close uncompleted job: ${this.cmd}`, 'yellow');

        this.kill();

        this.gui.sendCMD({
            cmd: this.cmd,
            silent: true
        });

        this.gui = null;

    },

    kill: function() {
        this.closed = true;
        if (this.worker) {
            this.worker.kill();
            this.worker = null;
        }
    }
};

module.exports = Course;
