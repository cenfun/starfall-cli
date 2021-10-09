const inquirer = require('inquirer');
const Util = require('../core/util.js');
const EC = Util.EC;

const seed = Number(Math.random().toString().substr(2, 8));

const passwordEncode = (str) => {
    str += '';
    const list = [];
    for (let i = 0, l = str.length; i < l; i++) {
        const code = str.charCodeAt(i) ^ seed;
        list.push(String.fromCharCode(code));
    }
    str = list.join('');
    return Buffer.from(str).toString('base64');
};

const passwordDecode = (str) => {
    str += '';
    str = Buffer.from(str, 'base64').toString();
    const list = [];
    for (let i = 0, l = str.length; i < l; i++) {
        const code = str.charCodeAt(i) ^ seed;
        list.push(String.fromCharCode(code));
    }
    str = list.join('');
    return str;
};

const loginModule = () => {
    console.log('It requires access to server with your account:');
    const promptList = [{
        name: 'username',
        type: 'string',
        message: EC.cyan('Please enter the username:'),
        validate: (v) => {
            return !!v;
        }
    }, {
        name: 'password',
        type: 'password',
        mask: '*',
        message: EC.cyan('Please enter the password:'),
        validate: (v) => {
            return !!v;
        },
        filter: (v) => {
            return passwordEncode(v);
        }
    }];
    return inquirer.prompt(promptList);
};

loginModule.passwordEncode = passwordEncode;
loginModule.passwordDecode = passwordDecode;

module.exports = loginModule;
