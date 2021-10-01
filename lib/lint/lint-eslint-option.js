module.exports = {
    vue: {
        plugin: "vue",
        extend: "plugin:vue/essential"
    },

    ie11: {
        plugin: "es",
        rules: {
            "es/no-for-of-loops": "error",
            "es/no-set": "error",
            "es/no-map": "error"
        }
    },

    es2019: {
        plugin: "es",
        extend: "plugin:es/no-2019"
    },

    es2018: {
        plugin: "es",
        extend: "plugin:es/no-2018"
    },

    es2017: {
        plugin: "es",
        extend: "plugin:es/no-2017"
    },

    es2016: {
        plugin: "es",
        extend: "plugin:es/no-2016"
    },

    es2015: {
        plugin: "es",
        extend: "plugin:es/no-2015"
    },

    es5: {
        plugin: "es",
        extend: "plugin:es/no-5"
    }

};
