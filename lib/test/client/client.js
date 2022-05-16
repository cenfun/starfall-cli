(function(window) {

    const Color = {
        bg: {}
    };
    const addColor = function(start, str, end) {
        return `\x1b[${start}m${str}\x1b[${end}m`;
    };
    const list = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
    list.forEach(function(name, i) {
        Color[name] = function(str) {
            return addColor(`3${i}`, str, '39');
        };
        Color.bg[name] = function(str) {
            return addColor(`4${i}`, str, '49');
        };
    });

    const extend = function(destination, source) {
        if (source) {
            for (const property in source) {
                destination[property] = source[property];
            }
        }
        return destination;
    };

    const requestCache = {};

    //===================================================================================================

    const showMessage = function(msg) {
        const className = 'cli-live-reload-helper';
        let elem = document.querySelector(`.${className}`);
        if (!elem) {
            elem = document.createElement('div');
            elem.className = className;
            let cssText = 'pointer-events: none; position: absolute; z-index: 99998;';
            cssText += 'top: 0px; left: 0px; font-family: Helvetica, Arial; padding: 5px 5px; background-color: rgba(0,0,0,0.1);';
            elem.style.cssText = cssText;
            document.body.appendChild(elem);
        }
        if (!msg) {
            elem.style.display = 'none';
            return;
        }
        console.log(msg);
        elem.innerHTML = msg;
        elem.style.display = 'block';
    };

    const initSocket = function(testAPI, callback) {
        const socket = window.io.connect('/');
        let server_connected = false;
        let has_error = false;
        let reconnect_times = 0;

        const reload = function() {
            testAPI.sendMessage('page reloading ...');
            //socket.close();
            window.location.reload();
        };
        
        socket.on('data', function(data) {
            if (server_connected) {
                //for request callback
                const id = data.id;
                if (id) {
                    const request = requestCache[id];
                    if (request && typeof (request.onDone) === 'function') {
                        request.onDone(data);
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
            console.log('Socket Connected');
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
            console.log('Socket Connect error');
            has_error = true;
        });

        socket.on('connect_timeout', function(data) {
            console.log('Socket Connect timeout');
        });

        socket.on('reconnecting', function(data) {
            reconnect_times += 1;
            console.log(`Socket Reconnecting ... ${reconnect_times}`);
            if (reconnect_times > 20) {
                socket.close();
                console.log(`Socket closed after retry ${reconnect_times} times.`);
            }
        });

        socket.on('reconnect_error', function(data) {
            console.log('Socket Reconnect error');
            has_error = true;
        });

        socket.on('reconnect_failed', function(data) {
            console.log('Socket Reconnect failed');
            has_error = true;
        });
    };

    //===================================================================================================

    const loadSpec = function(src, testAPI, callback) {
        testAPI.sendMessage(`load spec ${src} ...`);
        const script = document.createElement('script');
        script.src = src;
        script.onload = callback;
        script.onerror = function(e) {
            testAPI.sendMessage(Color.red(`ERROR: failed to load: ${src}`));
            callback();
        };
        document.body.appendChild(script);
    };

    const getError = function(err, outputName) {
        if (!err || !err.stack) {
            return new Error('unknown error');
        }

        const stack = err.stack;
        if (stack.indexOf(outputName) === -1) {
            return err;
        }

        const ls = (`${stack}`).split(/\n/);
        const head = ls.shift();
        const atLine = ls.find(function(line) {
            return line.indexOf(outputName) !== -1;
        });

        const e = new Error(head);
        const eList = (`${e.stack}`).split('\n');
        eList.length = 1;
        eList.push(atLine);
        e.stack = eList.join('\n');

        return e;
    };

    const errorMsgHandler = function(err, config) {
        const e = getError(err, config.outputName);
        if (config.debug) {
            console.error(e);
        }
        return e.stack;
    };

    //===================================================================================================
    //mocha 

    const mochaReporter = function(config, testAPI) {

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

            //only for mocha
            mocha.suite.afterEach('defaultAfterEach', function(done) {
                const test = this.currentTest;
                if (test.state === 'failed') {
                    testAPI.sendScreenshot(test.title, function(data) {
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
                    testAPI.sendMessage(`start root suite: ${config.name}`);
                    return;
                }

                _indents++;

                let msg = indent();
                if (suite.pending) {
                    msg += Color.cyan(`－ ${suiteTitle}`);
                } else {
                    msg += `＋ ${suiteTitle}`;
                }
                testAPI.sendMessage(msg);
            });


            // runner.on(constants.EVENT_TEST_BEGIN, function(test) {
            // });

            runner.on(constants.EVENT_TEST_PENDING, function(test) {
                summary.tests += 1;
                summary.skipped += 1;
                const msg = indent(true) + Color.cyan(`－ ${test.title}`);
                testAPI.sendMessage(msg);
            });

            runner.on(constants.EVENT_TEST_FAIL, function(test, err) {
                summary.tests += 1;
                summary.failed += 1;
                const msg = `${indent(true) + Color.red('×')} ${Color.bg.red(test.title)}`;
                testAPI.sendMessage(msg);
                const errorMsg = errorMsgHandler(err, config);
                testAPI.sendMessage(Color.red(errorMsg));
                failedList.push({
                    title: test.title,
                    errorMsg: errorMsg
                });

                //hook error
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
                const msg = `${indent(true) + Color.green('√')} ${Color.green(test.title)}`;
                testAPI.sendMessage(msg);
            });

            // runner.on(constants.EVENT_TEST_END, function(test) {
            // });

            runner.on(constants.EVENT_SUITE_END, function(suite) {
                _indents--;
            });

            runner.once(constants.EVENT_RUN_END, function(e) {
                testAPI.sendFinish(time_start, summary, failedList, config);
            });
        };
    };

    const startMocha = function(config, testAPI) {
        testAPI.sendMessage('mocha start ...');
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

        mochaOption.reporter = mochaReporter(config, testAPI);

        mocha.setup(mochaOption);

        loadSpec(config.outputName, testAPI, function() {
            mocha.run();
        });

    };


    //===================================================================================================
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
        return ls.join('\n');
    };

    const testAPI = {

        sendMessage: function(msg) {
            console.log(msg);
            sendSocketData({
                type: 'onMessage',
                data: msg
            });
        },

        sendScreenshot: function(title, callback) {
            const id = `id_${Math.random().toString().substr(2)}`;
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
            const timeoutId = setTimeout(function() {
                testAPI.sendMessage('screenshot timeout');
                request.onDone();
            }, 5000);
            request.onDone = function(d) {
                clearTimeout(timeoutId);
                delete requestCache[id];
                callback(d);
            };
            requestCache[id] = request;
        },

        sendFinish: function(time_start, summary, failedList, config) {
            testAPI.sendMessage('test runner ends');

            if (config.debug) {
                if (failedList.length) {
                    testAPI.sendMessage(Color.red(getExitError(failedList)));
                } else {
                    testAPI.sendMessage(Color.green('Congratulations! All tests passed.'));
                }
                testAPI.sendMessage('test in debug mode: refresh page to test it again');
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

        start: function(config) {
            console.log('test config', config);
            
            initSocket(testAPI, function(socket) {
                window.socket = socket;
                startMocha(config, testAPI);
            });
        }
    };

    window.testAPI = testAPI;

    //following error will be caught by page.on("pageerror")

    //global error
    //https://developer.mozilla.org/zh-CN/docs/Web/API/GlobalEventHandlers/onerror
    // window.addEventListener("error", function(e) {
    //     //https://developer.mozilla.org/zh-CN/docs/Web/API/ErrorEvent
    //     const reason = e.error;
    //     const err = Color.red(reason.stack || reason);
    //     testAPI.sendMessage(err);
    // }, true);

    //promise error
    //https://developer.mozilla.org/zh-CN/docs/Web/API/Window/unhandledrejection_event
    // window.addEventListener("unhandledrejection", function(e) {
    //     const reason = e.reason;
    //     const err = Color.red(reason.stack || reason);
    //     testAPI.sendMessage(err);
    // });

})(window);
