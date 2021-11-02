let _global = this;
if (typeof (window) !== 'undefined') {
    _global = window;
} else if (typeof (global) !== 'undefined') {
    _global = global;
}
const register = function(moduleName, globalModule) {
    // if (_global[moduleName]) {
    //     console.log("Duplicated module registered: " + moduleName);
    // }
    _global[moduleName] = globalModule;
};

//register self
register('register', register);

module.exports = register;