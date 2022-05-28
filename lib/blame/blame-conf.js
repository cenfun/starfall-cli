module.exports = {

    extList: [
        '.js',
        '.vue',
        '.ts',
        '.css',
        '.scss',
        '.sass',
        '.html',
        '.htm',
        '.json',
        '.md',
        '.txt',
        '.java',
        '.jsp',
        '.conf',
        '.properties',
        '.xml',
        '.py',
        '.php',
        '.go',
        '.rs',
        '.sh',
        '.asp',
        '.aspx',
        '.h',
        '.c',
        '.cpp',
        '.cs'
    ],

    dateRangeList: [{
        id: 'total',
        name: 'Total'
    }, {
        id: '1y',
        name: '1Y',
        from: new Date().setMonth(new Date().getMonth() - 12)
    }, {
        id: '6m',
        name: '6M',
        from: new Date().setMonth(new Date().getMonth() - 6)
    }, {
        id: '3m',
        name: '3M',
        from: new Date().setMonth(new Date().getMonth() - 3)
    }, {
        id: '1m',
        name: '1M',
        from: new Date().setMonth(new Date().getMonth() - 1)
    }, {
        id: 'ytd',
        name: 'YTD',
        from: new Date(new Date().getFullYear().toString()).getTime()
    }, {
        id: 'last_year',
        name: 'Last Year',
        from: new Date((new Date().getFullYear() - 1).toString()).getTime(),
        till: new Date(new Date().getFullYear().toString()).getTime()
    }],

    authorAlias: {

    }

};
