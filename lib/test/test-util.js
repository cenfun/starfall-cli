// TestUtil for browser (support Jasmine/Mocha)

// register to global
const register = require('../core/register.js');

/*
//============================================================================
assertion testing:
https://nodejs.org/dist/latest-v10.x/docs/api/assert.html
*/
const assert = require('assert');
register('assert', assert);

/*
//============================================================================
async ()=> {
    await delay(1000);
    doNext();
}
*/
const delay = function(ms) {
    if (!arguments.length || ms <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
register('delay', delay);

/*
//============================================================================
//Check something if it's ready until timeout
async ()=> {
    await ready(()=>{
        var boolean = checkSomething();
        if (boolean) {
            return boolean;
        }
    });
    doNext();
}
*/
const ready = function(checkFn, timeout = 3000, timeoutMsg = '', freq = 100) {
    return new Promise((resolve) => {

        const resFirst = checkFn();
        if (resFirst) {
            resolve(resFirst);
            return;
        }

        let timeout_check;
        const timeout_id = setTimeout(function() {
            clearTimeout(timeout_check);
            const resTimeout = checkFn();
            timeoutMsg = timeoutMsg || resTimeout;
            console.error(`[ready] ${timeout}ms timeout: ${timeoutMsg}`);
            resolve(resTimeout);
        }, timeout);

        const checkStart = function() {
            clearTimeout(timeout_check);
            timeout_check = setTimeout(function() {
                const resCheck = checkFn();
                if (resCheck) {
                    clearTimeout(timeout_id);
                    resolve(resCheck);
                    return;
                }
                checkStart();
            }, freq);
        };

        checkStart();

    });
};
register('ready', ready);

// ============================================================================

const spyCall = function(target, fun) {
    const callback = target[fun];
    const handler = function() {
        handler.called = true;
        return callback.apply(target, arguments);
    };
    target[fun] = handler;
};
register('spyCall', spyCall);

// ============================================================================

const TestUtil = {
    assert: assert,
    delay: delay,
    ready: ready
};
register('TestUtil', TestUtil);

module.exports = TestUtil;
