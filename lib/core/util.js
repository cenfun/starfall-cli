import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import os from 'os';
import net from 'net';
import axios from 'axios';
import { execSync } from 'child_process';
import rc from 'rc';
import { findUpSync } from 'find-up';

// 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'
import EC from 'eight-colors';
import CG from 'console-grid';

const npmConfig = rc('npm', {
    registry: 'https://registry.npmjs.org/'
});
// console.log(npmConfig);

export const state = {
    id: 'sf',
    name: 'starfall',

    registry: npmConfig.registry,

    option: {},

    // global cache
    projectConf: null,

    // global property
    root: '',
    cliRoot: '',
    projectConfPath: '',
    config: {},
    command: '',
    upgradeTips: ''

};

export function getTempRoot() {
    if (state.tempRoot) {
        return state.tempRoot;
    }

    // init temp output
    const tempPath = getConfig('tempPath');
    state.tempRoot = formatPath(path.resolve(state.root, tempPath));
    if (!fs.existsSync(state.tempRoot)) {
        fs.mkdirSync(state.tempRoot, {
            recursive: true
        });
    }

    return state.tempRoot;
}
export function getProjectConf(force) {
    if (force === true) {
        state.projectConf = null;
    }
    if (!state.projectConf) {
        if (!state.projectConfPath) {
            state.projectConfPath = `${state.root}/package.json`;
        }
        state.projectConf = readJSONSync(state.projectConfPath);
    }
    if (force && typeof force === 'string') {
        return state.projectConf[force];
    }
    return state.projectConf;
}

export function saveProjectConf(pc) {
    writeJSONSync(state.projectConfPath, sortPackageKeys(pc));
}

export function mergeOption(... args) {
    const option = {};
    args.forEach((item) => {
        if (!item) {
            return;
        }
        Object.keys(item).forEach((k) => {
            const nv = item[k];
            if (hasOwn(option, k)) {
                const ov = option[k];
                if (ov && typeof ov === 'object') {
                    if (nv && typeof nv === 'object' && !Array.isArray(nv)) {
                        option[k] = mergeOption(ov, nv);
                        return;
                    }
                }
            }
            option[k] = nv;
        });
    });
    return option;
}

const findUpConfig = (customConfigFile) => {
    if (customConfigFile) {
        if (fs.existsSync(customConfigFile)) {
            return customConfigFile;
        }
        // custom config not found
        return;
    }

    const defaultConfigList = [
        'sf.config.js',
        'sf.config.cjs',
        'sf.config.mjs',
        'sf.config.ts',
        'sf.config.json'
    ];

    const configPath = findUpSync(defaultConfigList);
    if (configPath) {
        return configPath;
    }

    // default config not found
};

const parseJsonConfig = (configPath) => {
    const content = readFileSync(configPath);
    try {
        return JSON.parse(content);
    } catch (e) {
        logRed(`ERROR: failed to parse config "${configPath}": ${e.message}`);
    }
};

const resolveConfigOptions = async (configPath) => {
    // json format
    const ext = path.extname(configPath);
    if (ext === '.json') {
        return parseJsonConfig(configPath);
    }

    let configOptions;
    let err;
    try {
        configOptions = await import(pathToFileURL(configPath));
    } catch (ee) {
        err = ee;
    }

    if (err) {
        logRed(`ERROR: failed to load config "${configPath}": ${err && err.message} `);
        return;
    }

    // could be multiple level default
    while (configOptions && configOptions.default) {
        configOptions = configOptions.default;
    }

    return configOptions;
};

export const initConfig = async (customConfig) => {

    const defaultConfig = await resolveConfigOptions(`${state.cliRoot}/sf.config.js`);

    const configPath = findUpConfig(customConfig);
    let configOptions = {};
    if (configPath) {
        configOptions = await resolveConfigOptions(configPath);
    } else {
        if (customConfig) {
            logRed(`ERROR: not found config file: ${customConfig}`);
            process.exit(1);
            return;
        }
    }
    return mergeOption(defaultConfig, configOptions);
};

export function getConfig(key) {
    return getValue(state.config, key);
}

export function copyDir(fromDir, toDir) {
    if (!fs.existsSync(fromDir) || !fs.existsSync(toDir)) {
        return;
    }

    const list = fs.readdirSync(fromDir, {
        withFileTypes: true
    });
    const dirs = [];
    for (const item of list) {
        if (item.isDirectory()) {
            dirs.push(item.name);
        } else if (item.isFile()) {
            fs.copyFileSync(path.resolve(fromDir, item.name), path.resolve(toDir, item.name));
        }
    }

    for (const dir of dirs) {

        const destDir = path.resolve(toDir, dir);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, {
                recursive: true
            });
        }

        copyDir(path.resolve(fromDir, dir), destDir);
    }

}
export function formatPath(str) {
    if (str) {
        str = str.replace(/\\/g, '/');
    }
    return str;
}

export function relativePath(p, root) {
    p = `${p}`;
    root = `${root || state.root}`;
    let rp = path.relative(root, p);
    rp = formatPath(rp);
    return rp;
}

export function isGitProject() {
    const pathHooksTo = `${state.root}/.git`;
    if (fs.existsSync(pathHooksTo)) {
        return true;
    }
    return false;
}
export const runCommand = (cmd, silent = false) => {
    try {
        return {
            code: 0,
            stdout: execSync(cmd, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            }),
            stderr: ''
        };
    } catch (error) {
        return {
            code: error.status || 1,
            stdout: `${error.stdout || ''}`,
            stderr: `${error.stderr || error.message || ''}`
        };
    }
};

export const exec = (cmd, option) => {
    const silent = Boolean(option.silent);
    if (!silent) {
        logCyan(`exec: ${cmd}`);
    }
    const sh = runCommand(cmd, silent);
    option.stderr = sh.stderr;
    option.stdout = sh.stdout;
    if (sh.code) {
        logRed(sh.stderr);
    }
    return sh.code;
};

export async function tasksResolver(list, option = {}) {

    const itemHandler = async (item, o) => {
        // change string to exec(cmd)
        if (typeof item === 'string') {
            o.cmd = item;
            item = (oo) => {
                return exec(oo.cmd, oo);
            };
        }

        const exitCode = await item.call(this, option);

        if (typeof exitCode === 'function' || (typeof exitCode === 'string' && exitCode.length > 1)) {
            return itemHandler(exitCode, option);
        }

        return exitCode;
    };

    for (const item of list) {
        const exitCode = await itemHandler(item, option);
        // return if has error and not ignore error
        if (exitCode !== 0 && !option.ignoreError) {
            EC.logRed(`ERROR: task terminated with code: ${exitCode}`);
            return exitCode;
        }
    }

    return 0;
}

export function rm(p) {
    return new Promise((resolve) => {
        fs.rm(p, {
            recursive: true,
            force: true,
            maxRetries: 10
        }, (err) => {
            if (err) {
                console.error(err);
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

export function rmSync(p) {
    let ok = true;
    try {
        fs.rmSync(p, {
            recursive: true,
            force: true,
            maxRetries: 10
        });
    } catch (err) {
        console.error(err);
        ok = false;
    }
    return ok;
}
export function forEachFile(dir, extList, callback) {
    if (!fs.existsSync(dir)) {
        return;
    }
    const list = fs.readdirSync(dir);
    list.forEach(function(name) {
        const abs = path.resolve(dir, name);
        const info = fs.statSync(abs);
        if (info.isDirectory()) {
            forEachFile(abs, extList, callback);
        } else if (!isList(extList) || extList.includes(path.extname(name)) || extList.includes(name)) {
            callback(name, dir);
        }
    });
}
export function editFile(from, callback, dest) {
    const content = readFileSync(from);
    let editedContent = callback.call(this, content);
    if (!editedContent) {
        editedContent = content;
    }
    dest = dest || from;

    if (dest === from && editedContent === content) {
        return editedContent;
    }

    writeFileSync(dest, editedContent);

    return editedContent;
}

export function editJSON(from, callback, dest) {
    const json = readJSONSync(from);
    const editedJson = callback.call(this, json);
    // can not compare json object
    dest = dest || from;
    writeJSONSync(dest, editedJson);
    return editedJson;
}

export function sortPackageKeys(json = {}) {
    // https://docs.npmjs.com/cli/v8/configuring-npm/package-json
    const orders = [
        'name',
        'version',
        'description',
        'private',

        'type',
        'main',
        'browser',
        'module',

        'bin',
        'exports',
        'types',

        'scripts',

        'workspaces',
        'files',

        'man',
        'directories',

        'keywords',
        'license',
        'author',
        'repository',
        'homepage',
        'bugs',
        'contributors',
        'funding',

        'dependencies',
        'devDependencies',
        'peerDependencies',
        'peerDependenciesMeta',
        'bundleDependencies',
        'optionalDependencies',
        'overrides',

        'engines',
        'os',
        'cpu',

        'config',
        'publishConfig'
    ];

    // auto add license
    json.license = json.license || 'MIT';

    const keys = Object.keys(json);

    // not in keys -1
    keys.forEach((key) => {
        if (orders.indexOf(key) === -1) {
            orders.push(key);
        }
    });

    keys.sort(function(a, b) {
        const ai = orders.indexOf(a);
        const bi = orders.indexOf(b);
        return ai - bi;
    });

    const sorted = {};
    keys.forEach(function(k) {
        sorted[k] = json[k];
    });
    return sorted;
}

export function readFileSync(filePath) {
    if (fs.existsSync(filePath)) {
        // Returns: <string> | <Buffer>
        const buf = fs.readFileSync(filePath);
        if (Buffer.isBuffer(buf)) {
            return buf.toString('utf8');
        }
        return buf;
    }
}

export function writeFileSync(filePath, content) {
    if (!fs.existsSync(filePath)) {
        const p = path.dirname(filePath);
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p, {
                recursive: true
            });
        }
    }
    fs.writeFileSync(filePath, content);
}

export function readJSONSync(filePath) {
    // do NOT use require, it has cache
    const content = readFileSync(filePath);
    if (content) {
        return JSON.parse(content);
    }
}

export function writeJSONSync(filePath, json) {
    let content = jsonString(json, 4);
    if (!content) {
        logRed('Invalid JSON object');
        return false;
    }
    // end of line
    const EOL = getEOL();
    content = content.replace(/\r|\n/g, EOL);
    content += EOL;
    return writeFileSync(filePath, content);
}

export function jsonString(obj, spaces) {

    if (typeof obj === 'string') {
        return obj;
    }

    if (!spaces) {
        spaces = 2;
    }

    let str = '';
    try {
        str = JSON.stringify(obj, null, spaces);
    } catch (e) {
        console.log(e);
    }

    return str;
}

export function getAscKeyObject(obj) {
    const ascObj = {};
    if (obj) {
        Object.keys(obj).sort().forEach(function(k) {
            ascObj[k] = obj[k];
        });
    }
    return ascObj;
}

export function getEOL(content) {
    if (!content) {
        return os.EOL;
    }
    const nIndex = content.lastIndexOf('\n');
    if (nIndex === -1) {
        return os.EOL;
    }
    if (content.substr(nIndex - 1, 1) === '\r') {
        return '\r\n';
    }
    return '\n';
}

export const generatePort = (startPort) => {
    return new Promise((resolve) => {
        const server = net.createServer().listen(startPort);
        server.on('listening', function() {
            server.close();
            resolve(startPort);
        });
        server.on('error', function(err) {
            if (err.code === 'EADDRINUSE') {
                generatePort(startPort + 1).then((port) => {
                    resolve(port);
                });
            } else {
                resolve(startPort);
            }
        });
    });
};

export const getInternalIp = () => {
    const n = os.networkInterfaces();
    // console.log(n);
    const list = [];
    for (const k in n) {
        const inter = n[k];
        for (const j in inter) {
            const item = inter[j];
            if (item.family === 'IPv4' && !item.internal) {
                const a = item.address;
                console.log(`Internal IP: ${a}`);
                if (a.startsWith('192.') || a.startsWith('10.')) {
                    list.push(a);
                }
            }
        }
    }
    return list.pop();
};

export const getPublicIp = async () => {
    const apis = [
        'https://icanhazip.com/',
        'https://api.ipify.org/',
        'http://ip.cip.cc/'
    ];
    let pip = '';
    for (const api of apis) {
        let ok = true;
        const res = await axios.get(api, {
            timeout: 2000
        }).catch(function(e) {
            ok = false;
        });
        if (ok && res.data) {
            pip = `${res.data}`.trim();
            break;
        }
    }
    return pip;
};
export function log() {
    const list = [];
    if (state.command) {
        list.push(EC.magenta(`[${state.command}]`));
    }

    const args = Array.from(arguments);
    const logs = list.concat(args);
    const msg = logs.join(' ');
    console.log(msg);
    return msg;
}

export function logLine(afterStr = '') {
    let msg = '================================================================================';
    if (afterStr) {
        msg += `\n${afterStr}`;
    }
    console.log(msg);
    return msg;
}

export function logRed(msg) {
    return EC.logRed(msg);
}

export function logGreen(msg) {
    return EC.logGreen(msg);
}

export function logYellow(msg) {
    return EC.logYellow(msg);
}

export function logCyan(msg) {
    return EC.logCyan(msg);
}

export function logOS(version) {

    const rows = [];

    rows.push({
        name: `${state.name}-cli`,
        value: `v${version}`
    });

    rows.push({
        name: 'Node.js',
        value: process.version
    });

    rows.push({
        name: 'Hostname',
        value: os.hostname()
    });

    rows.push({
        name: 'Platform',
        value: os.platform()
    });

    rows.push({
        name: 'CPUs',
        value: os.cpus().length
    });

    // https://juejin.im/post/5c71324b6fb9a049d37fbb7c
    const totalmem = os.totalmem();
    const totalmemStr = BF(totalmem);
    const freemem = os.freemem();
    const freememStr = BF(freemem);
    const sysUsageStr = PF(totalmem - freemem, totalmem);
    rows.push({
        name: 'Memory',
        value: `free: ${freememStr} / total: ${totalmemStr} = ${sysUsageStr}`
    });

    const memoryUsage = process.memoryUsage();
    const nodeUsageList = [];
    nodeUsageList.push(`rss: ${BF(memoryUsage.rss)}`);
    nodeUsageList.push(`ext: ${BF(memoryUsage.external)}`);
    nodeUsageList.push(`heap: ${PF(memoryUsage.heapUsed, memoryUsage.heapTotal)}`);
    const nodeUsageStr = nodeUsageList.join(' ');
    rows.push({
        name: 'Process',
        value: nodeUsageStr
    });

    CG({
        options: {
            headerVisible: false
        },
        columns: [{
            id: 'name'
        }, {
            id: 'value',
            maxWidth: 100
        }],
        rows: rows
    });
}

export function zero(s, l = 2) {
    s = `${s}`;
    return s.padStart(l, '0');
}

export function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

export function isNum(num) {
    if (typeof num !== 'number' || isNaN(num)) {
        return false;
    }
    const isInvalid = function(n) {
        if (n === Number.MAX_VALUE || n === Number.MIN_VALUE || n === Number.NEGATIVE_INFINITY || n === Number.POSITIVE_INFINITY) {
            return true;
        }
        return false;
    };
    if (isInvalid(num)) {
        return false;
    }
    return true;
}

export function toNum(num, toInt) {
    if (typeof num !== 'number') {
        num = parseFloat(num);
    }
    if (isNaN(num)) {
        num = 0;
    }
    if (toInt && !Number.isInteger(num)) {
        num = Math.round(num);
    }
    return num;
}

export function clamp(num, minValue, maxValue) {
    return Math.max(Math.min(num, maxValue), minValue);
}

export function isDate(date) {
    if (!date || !(date instanceof Date)) {
        return false;
    }
    // is Date Object but Date {Invalid Date}
    if (isNaN(date.getTime())) {
        return false;
    }
    return true;
}

export function toDate(input) {
    if (isDate(input)) {
        return input;
    }
    // fix time zone issue by use "/" replace "-"
    const inputHandler = function(it) {
        if (typeof it !== 'string') {
            return it;
        }
        // do NOT change ISO format: 2020-03-20T19:10:38.358Z
        if (it.indexOf('T') !== -1) {
            return it;
        }
        it = it.split('-').join('/');
        return it;
    };
    input = inputHandler(input);
    let date = new Date(input);
    if (isDate(date)) {
        return date;
    }
    date = new Date();
    return date;
}

export function dateFormat(date, format) {
    date = toDate(date);
    // default format
    format = format || 'yyyy-MM-dd';
    // year
    if ((/([Y|y]+)/).test(format)) {
        const yyyy = `${date.getFullYear()}`;
        format = format.replace(RegExp.$1, yyyy.substr(4 - RegExp.$1.length));
    }
    const o = {
        'M+': date.getMonth() + 1,
        '[D|d]+': date.getDate(),
        '[H|h]+': date.getHours(),
        'm+': date.getMinutes(),
        's+': date.getSeconds(),
        '[Q|q]+': Math.floor((date.getMonth() + 3) / 3),
        'S': date.getMilliseconds()
    };
    const doubleNumberHandler = function() {
        for (const k in o) {
            if (hasOwn(o, k)) {
                const reg = new RegExp(`(${k})`).test(format);
                if (!reg) {
                    continue;
                }
                const str = `${o[k]}`;
                format = format.replace(RegExp.$1, RegExp.$1.length === 1 ? str : `00${str}`.substr(str.length));
            }
        }
    };
    doubleNumberHandler();
    return format;
}

export function getTimestamp(date = new Date(), option = {}) {
    option = {
        weekday: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        timeZoneName: 'short',
        ... option
    };
    return new Intl.DateTimeFormat('en-US', option).format(date);
}
export function isList(data) {
    if (data && data instanceof Array && data.length > 0) {
        return true;
    }
    return false;
}

export function inList(item, list) {
    if (!isList(list)) {
        return false;
    }
    return list.includes(item);
}
export function toList(data, separator) {
    if (data instanceof Array) {
        return data;
    }
    if (typeof data === 'string' && (typeof separator === 'string' || separator instanceof RegExp)) {
        return data.split(separator);
    }
    if (typeof data === 'undefined' || data === null) {
        return [];
    }
    return [data];
}

export function getValue(data, dotPathStr, defaultValue) {
    if (!dotPathStr) {
        return defaultValue;
    }
    let current = data;
    const list = dotPathStr.split('.');
    const lastKey = list.pop();
    while (current && list.length) {
        const item = list.shift();
        current = current[item];
    }
    if (current && hasOwn(current, lastKey)) {
        const value = current[lastKey];
        if (typeof value !== 'undefined') {
            return value;
        }
    }
    return defaultValue;
}

export function replace(str, obj, defaultValue) {
    str = `${str}`;
    if (!obj) {
        return str;
    }
    str = str.replace(/\{([^}{]+)\}/g, function(match, key) {
        if (!hasOwn(obj, key)) {
            if (typeof defaultValue !== 'undefined') {
                return defaultValue;
            }
            return match;
        }
        let val = obj[key];
        if (typeof val === 'function') {
            val = val(obj, key);
        }
        if (typeof val === 'undefined') {
            val = '';
        }
        return val;
    });
    return str;
}

export function BF(v, places = 1, base = 1024) {
    v = toNum(v, true);
    if (v === 0) {
        return '0B';
    }
    let prefix = '';
    if (v < 0) {
        v = Math.abs(v);
        prefix = '-';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    for (let i = 0, l = units.length; i < l; i++) {
        const minValue = Math.pow(base, i);
        const maxValue = Math.pow(base, i + 1);
        if (v > minValue && v < maxValue) {
            const unit = units[i];
            v = prefix + (v / minValue).toFixed(places) + unit;
            break;
        }
    }
    return v;
}

export function PF(v, t = 1, digits = 1) {
    v = toNum(v);
    t = toNum(t);
    let per = 0;
    if (t) {
        per = v / t;
    }
    return `${(per * 100).toFixed(digits)}%`;
}

export function TF(v, unit, digits = 1) {
    v = toNum(v, true);
    if (unit) {
        if (unit === 's') {
            v = (v / 1000).toFixed(digits);
        } else if (unit === 'm') {
            v = (v / 1000 / 60).toFixed(digits);
        } else if (unit === 'h') {
            v = (v / 1000 / 60 / 60).toFixed(digits);
        }
        return NF(v) + unit;
    }
    const s = v / 1000;
    const hours = Math.floor(s / 60 / 60);
    const minutes = Math.floor((s - hours * 60 * 60) / 60);
    const seconds = Math.round(s - hours * 60 * 60 - minutes * 60);
    return `${hours}:${zero(minutes)}:${zero(seconds)}`;
}

export function DTF(v, maxV) {
    maxV = maxV || v;
    if (maxV > 60 * 1000) {
        return TF(v);
    }
    return TF(v, 'ms');
}

export function NF(v) {
    v = toNum(v);
    return v.toLocaleString();
}

export const request = async (options) => {
    let err;
    const res = await axios(options).catch((e) => {
        err = e;
    });
    return [err, res];
};
