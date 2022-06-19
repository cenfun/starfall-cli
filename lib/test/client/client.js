(function(window) {

    const EC = {
        bg: {}
    };
    const add = function(start, str, end) {
        return `\x1b[${start}m${str}\x1b[${end}m`;
    };
    const list = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
    list.forEach(function(name, i) {
        EC[name] = function(str) {
            return add(`3${i}`, str, '39');
        };
        EC.bg[name] = (str) => {
            return add(`4${i}`, str, '49');
        };
    });
    EC.log = (str) => {
        console.log(str);
    };
    EC.logColor = (str, color) => {
        const fn = EC[color];
        if (typeof fn === 'function') {
            str = fn(str);
        }
        EC.log(str);
        return str;
    };
    list.forEach((color) => {
        const api = `log${color.charAt(0).toUpperCase()}${color.slice(1)}`;
        EC[api] = function(str) {
            return EC.logColor(str, color);
        };
    });

    window.EC = EC;

    //==================================================================================================

    const extend = function(destination, source) {
        if (source) {
            for (const property in source) {
                destination[property] = source[property];
            }
        }
        return destination;
    };

    const uid = function(len = 8, prefix = '') {
        const dict = '0123456789abcdefghijklmnopqrstuvwxyz';
        const dictLen = dict.length;
        let str = prefix;
        while (len--) {
            str += dict[Math.random() * dictLen | 0];
        }
        return str;
    };

    const requestCache = {};

    // ===================================================================================================

    const showLog = function(msg) {
        console.log(`[livereload] ${msg}`);
    };

    const showMessage = function(msg) {
        const className = 'livereload-helper';
        let elem = document.querySelector(`.${className}`);
        if (!elem) {
            elem = document.createElement('div');
            elem.className = className;
            const cssText = 'pointer-events: none; position: fixed; z-index: 99998; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 8px 8px; font-family: Helvetica, Arial, sans-serif; font-size: 14px; color: #fff; border-radius: 5px; background-color: rgba(0,0,0,0.6);';
            elem.style.cssText = cssText;
            document.body.appendChild(elem);
        }
        if (!msg) {
            elem.style.display = 'none';
            return;
        }
        showLog(msg);
        elem.innerHTML = msg;
        elem.style.display = 'block';
    };

    const initSocket = function(T, callback) {

        if (!window.io) {
            showLog('not found io');
            return;
        }

        const socket = window.io.connect('/');

        let server_connected = false;
        let has_error = false;
        let reconnect_times = 0;

        const reload = function() {
            T.sendMessage('page reloading ...');
            // socket.close();
            window.location.reload();
        };

        socket.on('data', function(data) {
            if (server_connected) {
                // for request callback
                const id = data.id;
                if (id) {
                    const request = requestCache[id];
                    if (request && typeof request.onFinished === 'function') {
                        request.onFinished(data.response);
                    }
                    return;
                }
                showMessage(data.message);
                if (data.action === 'reload') {
                    reload();
                }
            }
        });
        socket.on('connect', function(data) {
            showLog('Socket Connected');
            if (server_connected) {
                if (has_error) {
                    showMessage('Reloading for socket reconnected ...');
                    reload();
                }
                return;
            }
            server_connected = true;
            has_error = false;
            reconnect_times = 0;
            callback(socket);
        });

        socket.on('connect_error', function(data) {
            showLog('Socket Connect error');
            has_error = true;
        });

        socket.on('connect_timeout', function(data) {
            showLog('Socket Connect timeout');
        });

        socket.on('reconnecting', function(data) {
            reconnect_times += 1;
            showLog(`Socket Reconnecting ... ${reconnect_times}`);
            if (reconnect_times > 20) {
                socket.close();
                showLog(`Socket closed after retry ${reconnect_times} times.`);
            }
        });

        socket.on('reconnect_error', function(data) {
            showLog('Socket Reconnect error');
            has_error = true;
        });

        socket.on('reconnect_failed', function(data) {
            showLog('Socket Reconnect failed');
            has_error = true;
        });
    };

    // ===================================================================================================

    const loadSpec = function(src, T, callback) {
        T.sendMessage(`load ${src} ...`);
        const script = document.createElement('script');
        script.src = src;
        script.onload = callback;
        script.onerror = function(e) {
            T.sendMessage(EC.red(`ERROR: failed to load: ${src}`));
            callback();
        };
        document.body.appendChild(script);
    };

    const getError = function(err, buildName) {
        if (!err || !err.stack) {
            return new Error('unknown error');
        }

        const stack = err.stack;
        if (stack.indexOf(buildName) === -1) {
            return err;
        }

        const ls = `${stack}`.split(/\n/);
        const head = ls.shift();
        const atLine = ls.find(function(line) {
            return line.indexOf(buildName) !== -1;
        });

        const e = new Error(head);
        const eList = `${e.stack}`.split('\n');
        eList.length = 1;
        eList.push(atLine);
        e.stack = eList.join('\n');

        return e;
    };

    const errorMsgHandler = function(err, config) {
        const e = getError(err, config.buildName);
        if (config.debug) {
            console.error(e);
        }
        return e.stack;
    };

    // ===================================================================================================
    // mocha

    const mochaReporter = function(config, T) {

        return function(runner) {

            let Mocha = window.Mocha;
            if (!Mocha && window.mocha) {
                Mocha = window.mocha.Mocha;
            }

            const constants = Mocha.Runner.constants;
            const time_start = new Date().getTime();
            let _indents = 0;
            const indent = function(isTest) {
                let num = _indents;
                if (isTest) {
                    num += 1;
                }
                return Array(num).join('   ');
            };
            const summary = {
                suites: 0,
                tests: 0,
                skipped: 0,
                failed: 0,
                passed: 0
            };
            const failedList = [];

            // only for mocha
            mocha.suite.afterEach('defaultAfterEach', function(done) {
                const test = this.currentTest;
                if (test.state === 'failed') {
                    T.sendScreenshot(test.title, function(data) {
                        if (data) {
                            const failedTest = failedList[failedList.length - 1];
                            if (failedTest) {
                                failedTest.errorMsg += `\n(screenshot: ${data.screenshot})`;
                            }
                        }
                        done();
                    });
                } else {
                    done();
                }
            });

            runner.on(constants.EVENT_SUITE_BEGIN, function(suite) {
                summary.suites += 1;

                const suiteTitle = suite.title;
                if (!suiteTitle) {
                    T.sendMessage(`start root suite: ${config.name}`);
                    return;
                }

                _indents++;

                let msg = indent();
                if (suite.pending) {
                    msg += EC.cyan(`－ ${suiteTitle}`);
                } else {
                    msg += `＋ ${suiteTitle}`;
                }
                T.sendMessage(msg);
            });


            // runner.on(constants.EVENT_TEST_BEGIN, function(test) {
            // });

            runner.on(constants.EVENT_TEST_PENDING, function(test) {
                summary.tests += 1;
                summary.skipped += 1;
                const msg = indent(true) + EC.cyan(`－ ${test.title}`);
                T.sendMessage(msg);
            });

            runner.on(constants.EVENT_TEST_FAIL, function(test, err) {
                summary.tests += 1;
                summary.failed += 1;
                const msg = `${indent(true) + EC.red('×')} ${EC.bg.red(test.title)}`;
                T.sendMessage(msg);
                const errorMsg = errorMsgHandler(err, config);
                T.sendMessage(EC.red(errorMsg));
                failedList.push({
                    title: test.title,
                    errorMsg: errorMsg
                });

                // hook error
                if (test.type === 'hook') {
                    const hook = test;
                    test = hook.ctx.currentTest;
                    if (test) {
                        test.state = 'failed';
                    }
                }

            });

            runner.on(constants.EVENT_TEST_PASS, function(test) {
                summary.tests += 1;
                summary.passed += 1;
                const msg = `${indent(true) + EC.green('√')} ${EC.green(test.title)}`;
                T.sendMessage(msg);
            });

            // runner.on(constants.EVENT_TEST_END, function(test) {
            // });

            runner.on(constants.EVENT_SUITE_END, function(suite) {
                _indents--;
            });

            runner.once(constants.EVENT_RUN_END, function(e) {
                T.sendFinish(time_start, summary, failedList, config);
            });
        };
    };

    const startMocha = function(config, T) {
        T.sendMessage('mocha start ...');
        const mochaOption = {
            ui: 'bdd',
            timeout: 60 * 1000,
            color: true,
            globals: ['__cov*']
        };
        extend(mochaOption, config.mochaOption);

        if (config.debug) {
            mochaOption.timeout = false;
        }

        mochaOption.reporter = mochaReporter(config, T);

        mocha.setup(mochaOption);

        loadSpec(config.buildName, T, function() {
            mocha.run();
        });

    };


    // ===================================================================================================
    const socketDataList = [];
    const sendSocketData = function(data) {
        if (window.socket) {
            if (socketDataList.length) {
                socketDataList.forEach(function(item) {
                    window.socket.emit('data', item);
                });
                socketDataList.length = 0;
            }
            window.socket.emit('data', data);
        } else {
            socketDataList.push(data);
        }
    };

    const getExitError = function(failedList) {
        const ls = ['ERROR: Failed test(s): \n'];
        failedList.forEach(function(item, i) {
            const index = i + 1;
            ls.push(`${index}, ${item.title}`);
            ls.push(`${item.errorMsg}\n`);
        });
        ls.push(`Total failed test(s): ${failedList.length}`);
        return ls.join('\n');
    };

    //==================================================================================================

    //test API
    const T = {

        sendMessage: function(msg) {
            console.log(msg);
            sendSocketData({
                type: 'onMessage',
                data: msg
            });
        },

        sendScreenshot: function(title, callback) {
            const id = uid(16, 'id-');
            const data = {
                id: id,
                title: title
            };
            sendSocketData({
                type: 'onScreenshot',
                data: data
            });
            const request = {
                id: id,
                title: title
            };
            const timeout = 10 * 1000;
            const timeoutId = setTimeout(function() {
                T.sendMessage(`screenshot timeout: ${timeout}ms`);
                request.onFinished();
            }, timeout);
            request.onFinished = function(d) {
                clearTimeout(timeoutId);
                delete requestCache[id];
                callback(d);
            };
            requestCache[id] = request;
        },

        sendPageAPI: function(action, args) {
            return new Promise((resolve) => {

                args = Array.from(args);

                const id = uid(16, 'id-');
                const data = {
                    id,
                    action,
                    args
                };
                sendSocketData({
                    type: 'onPageAPI',
                    data: data
                });
                const request = {
                    id: id
                };
                const timeout = 60 * 1000;
                const timeoutId = setTimeout(function() {
                    T.sendMessage(`page api "${action}" timeout: ${timeout}ms`);
                    request.onFinished();
                }, timeout);
                request.onFinished = function(d) {
                    clearTimeout(timeoutId);
                    delete requestCache[id];
                    resolve(d);
                };
                requestCache[id] = request;

            });

        },

        sendFinish: function(time_start, summary, failedList, config) {
            T.sendMessage('test runner ends');

            if (config.debug) {
                if (failedList.length) {
                    T.sendMessage(EC.red(getExitError(failedList)));
                } else {
                    T.sendMessage(EC.green('Congratulations! All tests passed.'));
                }
                T.sendMessage('test in debug mode: refresh page to test it again');
            }

            const time_end = new Date().getTime();
            const duration = time_end - time_start;

            sendSocketData({
                type: 'onFinish',
                data: {
                    debug: config.debug,
                    time_start: time_start,
                    time_end: time_end,
                    duration: duration,
                    summary: summary,
                    failedList: failedList,
                    coverage: window.__coverage__
                }
            });

        },

        // entry called by test page
        start: function(config) {
            console.log('test config', config);

            initSocket(T, function(socket) {
                window.socket = socket;
                startMocha(config, T);
            });
        }
    };

    window.T = T;


    //==================================================================================================

    const page = {
        mouse: {
            click: function(x, y, options) {
                return T.sendPageAPI('mouse.click', arguments);
            },
            dblclick: function(x, y, options) {
                return T.sendPageAPI('mouse.dblclick', arguments);
            },
            down: function(options) {
                return T.sendPageAPI('mouse.down', arguments);
            },
            move: function(x, y, options) {
                return T.sendPageAPI('mouse.move', arguments);
            },
            up: function(options) {
                return T.sendPageAPI('mouse.up', arguments);
            },
            wheel: function(deltaX, deltaY) {
                return T.sendPageAPI('mouse.wheel', arguments);
            }
        }
    };

    window.page = page;

    // following error will be caught by page.on("pageerror")

    // global error
    // https://developer.mozilla.org/zh-CN/docs/Web/API/GlobalEventHandlers/onerror
    // window.addEventListener("error", function(e) {
    //     //https://developer.mozilla.org/zh-CN/docs/Web/API/ErrorEvent
    //     const reason = e.error;
    //     const err = Color.red(reason.stack || reason);
    //     T.sendMessage(err);
    // }, true);

    // promise error
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Window/unhandledrejection_event
    // window.addEventListener("unhandledrejection", function(e) {
    //     const reason = e.reason;
    //     const err = Color.red(reason.stack || reason);
    //     T.sendMessage(err);
    // });

})(window);
