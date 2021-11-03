const Util = {

    defaultSuggestion: {
        cmd: [
            'n dir',
            'git reset --hard',
            'git clean -df',
            'git pull --tags'
        ]
    },

    //whether data is array with length
    isList: function(data) {
        if (data && data instanceof Array && data.length > 0) {
            return true;
        }
        return false;
    },
    //whether item in list
    inList: function(item, list) {
        if (!Util.isList(list)) {
            return false;
        }

        for (let i = 0, l = list.length; i < l; i++) {
            if (list[i] === item) {
                return true;
            }
        }

        return false;
    },

    // format to a valid number
    toNum: function(num, toInt) {
        if (typeof (num) !== 'number') {
            num = parseFloat(num);
        }
        if (isNaN(num)) {
            num = 0;
        }
        if (toInt) {
            num = Math.round(num);
        }
        return num;
    },

    createWorker: function(url) {
        if (typeof (url) === 'function') {
            const str = url.toString();
            const blob = new Blob([`'use strict';\nself.onmessage =${str}`], {
                type: 'text/javascript'
            });
            url = window.URL.createObjectURL(blob);
        } else {
            url += '';
        }
        return new Worker(url);
    }

};

export default Util;
