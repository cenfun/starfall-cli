//const fs = require('fs');
const path = require('path');
const Util = require('../core/util.js');
const conf = require('./blame-conf.js');

const getCommitDays = function(commitDays) {
    const dates = Object.keys(commitDays);
    const min = dates.length;
    if (min < 2) {
        return 1;
    }
    dates.sort();
    const first = dates.shift();
    const last = dates.pop();
    const duration = Util.toDate(last).getTime() - Util.toDate(first).getTime();
    const days = Math.ceil(duration / (24 * 60 * 60 * 1000));
    return Math.max(days, min);
};

const setCommitTimeRange = function(target, commitDays) {
    const dates = Object.keys(commitDays);
    dates.sort();
    const first = Util.toDate(dates.shift());
    const last = Util.toDate(dates.pop());
    target.from = first.getTime();
    target.till = last.getTime();
};

const per = function(v, t) {
    let p = 0;
    if (t) {
        p = v / t;
    }
    return p;
};

const GID = function(id, name) {
    return [id, conf.columnIdMap[name]].join('_');
};

const getNameColumn = function() {
    return {
        id: 'name',
        name: 'Name',
        width: 200
    };
};

const initColumnGroup = function(g) {
    const id = g.id;
    return Object.assign({}, g, {
        subs: [{
            id: GID(id, 'lines'),
            name: 'Lines',
            align: 'right',
            dataType: 'number'
        }, {
            id: GID(id, 'ltp'),
            name: 'L/T%',
            title: 'Lines / Total',
            align: 'right',
            dataType: 'percent',
            cellClass: 'tg-cell-mask bg-gray',
            headerItemClass: 'bg-gray'
        }, {
            id: GID(id, 'comments'),
            name: 'Comments',
            width: 80,
            align: 'right',
            dataType: 'number'
        }, {
            id: GID(id, 'clp'),
            name: 'C/L%',
            title: 'Comments / Lines',
            align: 'right',
            dataType: 'percent',
            cellClass: 'tg-cell-mask bg-gray',
            headerItemClass: 'bg-gray'
        }, {
            id: GID(id, 'blanks'),
            name: 'Blanks',
            align: 'right',
            dataType: 'number'
        }, {
            id: GID(id, 'blp'),
            name: 'B/L%',
            title: 'Blanks / Lines',
            align: 'right',
            dataType: 'percent',
            cellClass: 'tg-cell-mask bg-gray',
            headerItemClass: 'bg-gray'
        }, {
            id: GID(id, 'json'),
            name: 'Json',
            align: 'right',
            dataType: 'number',
            cellClass: 'border-right',
            headerItemClass: 'border-right'
        }, {
            id: GID(id, 'days'),
            name: 'Days',
            align: 'right',
            dataType: 'number'
        }, {
            id: GID(id, 'actives'),
            name: 'Actives',
            align: 'right',
            dataType: 'number'
        }, {
            id: GID(id, 'adp'),
            name: 'A/D%',
            title: 'Actives / Days',
            align: 'right',
            dataType: 'percent',
            cellClass: 'tg-cell-mask bg-gray',
            headerItemClass: 'bg-gray'
        }, {
            id: GID(id, 'commits'),
            name: 'Commits',
            align: 'right',
            dataType: 'number'
        }, {
            id: GID(id, 'cd'),
            name: 'C/D',
            title: 'Commits / Days',
            align: 'right',
            cellClass: 'tg-cell-mask bg-gray',
            headerItemClass: 'bg-gray'
        }]
    });
};

const getColumnIdMap = function() {
    return {
        init: 0,

        lines: 1,
        ltp: 11,

        comments: 2,
        clp: 21,

        blanks: 3,
        blp: 31,

        json: 4,

        commitDays: 5,
        days: 51,

        actives: 6,
        adp: 61,

        commitHash: 7,
        commits: 71,
        cd: 72
    };
};

const initInfo = function(target, id) {
    if (target[GID(id, 'init')]) {
        return;
    }
    target[GID(id, 'init')] = 1;

    target[GID(id, 'lines')] = 0;
    target[GID(id, 'ltp')] = 0;

    target[GID(id, 'comments')] = 0;
    target[GID(id, 'clp')] = 0;

    target[GID(id, 'blanks')] = 0;
    target[GID(id, 'blp')] = 0;

    target[GID(id, 'json')] = 0;

    target[GID(id, 'commitDays')] = {};
    target[GID(id, 'days')] = 0;

    target[GID(id, 'actives')] = 0;
    target[GID(id, 'adp')] = 0;

    target[GID(id, 'commitHash')] = {};
    target[GID(id, 'commits')] = 0;
    target[GID(id, 'cd')] = 0;
};

const appendInfo = function(target, id, line) {

    initInfo(target, id);

    target[GID(id, 'commitHash')][line.commitId] = 1;
    target[GID(id, 'commitDays')][line.dayId] = 1;
    const type = line.type;
    //most of cases
    if (type === 'line') {
        target[GID(id, 'lines')] += 1;
        return;
    }
    if (type === 'comment') {
        target[GID(id, 'comments')] += 1;
        return;
    }
    if (type === 'blank') {
        target[GID(id, 'blanks')] += 1;
        return;
    }
    if (type === 'json') {
        target[GID(id, 'json')] += 1;
        return;
    }
    target[GID(id, 'lines')] += 1;
};

const initAuthorInfo = function(name) {
    if (!conf.authorInfo) {
        conf.authorInfo = {
            length: 0,
            map: {}
        };
    }
    const authorInfo = conf.authorInfo;
    //id
    let id = authorInfo.map[name];
    if (!id) {
        authorInfo.length += 1;
        id = authorInfo.length;
        authorInfo.map[name] = id;
    }
    return id;
};

//===========================================================================================================================

const showConsoleReport = (info) => {
    console.log('Git Blame Overview:');
    const totalRange = info.dateRangeList.find(item => {
        if (item.id === 'total') {
            return true;
        }
    });

    const totalGroup = totalRange.authorData.columns.find(item => {
        if (!item.path && item.name === conf.totalName) {
            return true;
        }
    });
    let columns = JSON.parse(JSON.stringify(totalGroup.subs));
    columns = columns.filter(c => {
        if (!c.id === 'name' || c.dataType === 'number') {
            return true;
        }
    });
    columns.unshift({
        id: 'name',
        name: 'Name'
    });
    const rows = JSON.parse(JSON.stringify(totalRange.authorData.rows));
    //add border
    rows.splice(1, 0, {
        innerBorder: true
    });

    Util.consoleGrid.render({
        option: {
            defaultFormatter: function(v, row, column) {
                if (column.dataType === 'number') {
                    return Util.NF(v);
                }
                if (column.dataType === 'percent' && typeof(v) === 'number') {
                    return Util.PF(v);
                }
                return v;
            }
        },
        columns: columns,
        rows: rows
    });
};

//===========================================================================================================================

const dateRangeTotalAuthorDataHandler = function(authorData, g, line) {
    const cid = g.id;
    const tid = initAuthorInfo(conf.totalName);
    let totalAuthor = authorData.rowMap[tid];
    if (!totalAuthor) {
        totalAuthor = {
            id: tid,
            name: conf.totalName
        };
        authorData.rowMap[tid] = totalAuthor;
    }
    appendInfo(totalAuthor, cid, line);
};

const dateRangeAuthorGroupDataHandler = function(authorData, g, line) {
    //column is group
    const cid = g.id;
    let group = authorData.columnMap[cid];
    if (!group) {
        group = initColumnGroup(g);
        authorData.columnMap[cid] = group;
    }
    //row is author
    const rid = line.id;
    let author = authorData.rowMap[rid];
    if (!author) {
        author = {
            id: rid,
            name: line.name
        };
        authorData.rowMap[rid] = author;
    }
    appendInfo(author, cid, line);
};

const dateRangeGroupAuthorDataHandler = function(groupData, g, line) {
    //total column author
    const tid = initAuthorInfo(conf.totalName);
    let totalAuthor = groupData.columnMap[tid];
    if (!totalAuthor) {
        totalAuthor = initColumnGroup({
            id: tid,
            name: conf.totalName
        });
        groupData.columnMap[tid] = totalAuthor;
    }
    //column is author
    const cid = line.id;
    let author = groupData.columnMap[cid];
    if (!author) {
        author = initColumnGroup({
            id: cid,
            name: line.name
        });
        groupData.columnMap[cid] = author;
    }
    //row is group
    const rid = g.id;
    let group = groupData.rowMap[rid];
    if (!group) {
        group = Object.assign({}, g);
        groupData.rowMap[rid] = group;
    }
    appendInfo(group, cid, line);
    //total group row
    appendInfo(group, tid, line);
};

const dateRangeHandler = function(dateRanges, groups, line) {
    dateRanges.forEach(d => {
        //row is author
        d.authorData = d.authorData || {
            columnMap: {},
            rowMap: {}
        };
        //row is group
        d.groupData = d.groupData || {
            columnMap: {},
            rowMap: {}
        };

        const authorData = d.authorData;
        const groupData = d.groupData;

        //total only be appended once if multiple groups
        let totalAuthorAppended = false;
        //init group
        groups.forEach(g => {
            //total author handler, there is total in group list, so only be appended once
            if (g.name === conf.totalName && !totalAuthorAppended) {
                dateRangeTotalAuthorDataHandler(authorData, g, line);
                totalAuthorAppended = true;
            } else {
                dateRangeTotalAuthorDataHandler(authorData, g, line);
            }
            //row author - column group
            dateRangeAuthorGroupDataHandler(authorData, g, line);

            //total group handler, there is NO total in author list
            //row group - column author
            dateRangeGroupAuthorDataHandler(groupData, g, line);
        });

    });
};

//===========================================================================================================================

const getGroupList = function() {
    //always has total group
    const groupList = [{
        id: 1,
        name: conf.totalName
    }];
    //has components root
    let componentRoot = Util.getComponentRoot();
    if (componentRoot) {
        componentRoot = Util.relativePath(componentRoot);
        Util.getComponentList().forEach(componentName => {
            groupList.push({
                id: groupList.length + 1,
                name: componentName,
                path: `${componentRoot}/${componentName}`
            });
        });
        //other not a component
        groupList.push({
            id: groupList.length + 1,
            name: 'Other'
        });
    }
    return groupList;
};

const getGroups = function(filePath, groupList) {
    let hasMatched = false;
    return groupList.filter(item => {
        if (!item.path && item.name === conf.totalName) {
            return true;
        }
        if (item.path && filePath.indexOf(item.path) === 0) {
            hasMatched = true;
            return true;
        }
        if (!item.path && item.name === 'Other' && !hasMatched) {
            return true;
        }
    });
};

const getDateRanges = function(timestamp) {
    return conf.dateRangeList.filter(item => {
        if (item.id === 'total') {
            return true;
        }
        if (!item.till) {
            item.till = Date.now();
        }
        if (timestamp >= item.from && timestamp <= item.till) {
            return true;
        }
        return false;
    });
};

const createBlameInfo = function(report) {
    conf.name = report.name;
    //init column map
    conf.columnIdMap = getColumnIdMap();
    //refresh author alias 
    const authorAlias = conf.authorAlias;
    conf.authorAlias = {};
    conf.totalName = 'Total';
    initAuthorInfo(conf.totalName);
    const groupList = getGroupList();
    report.jobList.forEach(job => {
        if (!Array.isArray(job.report)) {
            return;
        }
        const groups = getGroups(job.filePath, groupList);
        //console.log(groups, job.filePath);
        job.report.forEach(line => {
            // "commitId": "42b53843be5f100c69b3119c1fbed86618811c8f",
            // "author": "xxx", => name/id
            // "timestamp": 1574725225000, => dayId
            // "type": "line"

            //author name/id handler
            let name = line.author;
            if (authorAlias[name]) {
                name = authorAlias[name];
                conf.authorAlias[line.author] = name;
            }
            line.name = name;
            line.id = initAuthorInfo(name);
            line.dayId = Util.DF(line.timestamp);
            const dateRanges = getDateRanges(line.timestamp);
            dateRangeHandler(dateRanges, groups, line);
        });
    });
};

const calculateItem = function(dd) {
    dd.columns = Object.values(dd.columnMap);
    delete dd.columnMap;
    dd.rows = Object.values(dd.rowMap);
    delete dd.rowMap;
    //total row handler
    const totalRow = dd.rows.find(item => {
        if (item.name === conf.totalName) {
            return true;
        }
    });
    //header title from - till
    dd.columns.forEach(column => {
        const id = column.id;
        //generate column time from and till
        const columnCommitDays = {};
        dd.rows.forEach(row => {
            initInfo(row, id);

            //calculate lines/total - ltp
            const linesKey = GID(id, 'lines');
            const ltpKey = GID(id, 'ltp');
            if (row.name === conf.totalName) {
                row[ltpKey] = '';
            } else {
                row[ltpKey] = per(row[linesKey], totalRow[linesKey]);
            }

            //calculate comments/lines - clp
            row[GID(id, 'clp')] = per(row[GID(id, 'comments')], row[linesKey]);

            //calculate blanks/lines - blp
            row[GID(id, 'blp')] = per(row[GID(id, 'blanks')], row[linesKey]);

            //calculate days
            const commitDaysKey = GID(id, 'commitDays');
            const commitDays = row[commitDaysKey];
            delete row[commitDaysKey];
            Object.assign(columnCommitDays, commitDays);
            const daysKey = GID(id, 'days');
            row[daysKey] = getCommitDays(commitDays);

            //calculate actives/days - adp
            const activesKey = GID(id, 'actives');
            row[activesKey] = Object.keys(commitDays).length;
            row[GID(id, 'adp')] = per(row[activesKey], row[daysKey]);

            //calculate commits
            const commitHashKey = GID(id, 'commitHash');
            const commitHash = row[commitHashKey];
            delete row[commitHashKey];
            const commitsKey = GID(id, 'commits');
            row[commitsKey] = Object.keys(commitHash).length;

            //calculate cd
            row[GID(id, 'cd')] = (row[commitsKey] / row[daysKey]).toFixed(2);

        });
        setCommitTimeRange(column, columnCommitDays);
    });

    //sort row by lines
    const totalColumn = dd.columns.find(item => {
        if (item.name === conf.totalName) {
            return true;
        }
        return false;
    });
    const sortField = GID(totalColumn.id, 'lines');
    dd.rows.sort(function(a, b) {
        return b[sortField] - a[sortField];
    });
    dd.option = {
        sortField: sortField
    };
    const sortMap = {};
    dd.rows.forEach(row => {
        sortMap[row.id] = row[sortField];
    });
    dd.sortMap = sortMap;
    //add name to columns last
    dd.columns.unshift(getNameColumn());

};

const calculateBlameInfo = function() {

    //update info
    conf.dateRangeList.forEach(d => {
        if (!d.authorData || !d.groupData) {
            return;
        }
        [d.authorData, d.groupData].forEach(dd => {
            calculateItem(dd);
        });

        //sort columns by sortMap from another rows
        const groupSortMap = d.groupData.sortMap;
        d.authorData.columns.sort(function(a, b) {
            if (!a.subs || !b.subs) {
                return 1;
            }
            return groupSortMap[b.id] - groupSortMap[a.id];
        });
        const authorSortMap = d.authorData.sortMap;
        d.groupData.columns.sort(function(a, b) {
            if (!a.subs || !b.subs) {
                return 1;
            }
            return authorSortMap[b.id] - authorSortMap[a.id];
        });

        delete d.groupData.sortMap;
        delete d.authorData.sortMap;
    });
};

const generateBlameInfo = function(report) {
    createBlameInfo(report);
    calculateBlameInfo();
    return conf;
};

//===========================================================================================================================

const reportHandler = async (report) => {

    console.log('generate git blame report ...');

    const info = generateBlameInfo(report);
    showConsoleReport(info);

    //for test checking
    //const jsonPath = Util.getTempRoot() + "/git-blame-" + report.name + ".json";
    //Util.writeJSONSync(jsonPath, info, true);

    const tempPath = path.resolve(__dirname, './blame-template.html');
    const template = Util.readFileContentSync(tempPath);
    let html = Util.replace(template, {
        title: `Git Blame Report: ${report.name} (${Util.DF()})`,
        about: Util.getAbout('blame', 'Blame')
    });

    let content = Util.getGridContent();
    content += `\nwindow.gitBlameData = ${JSON.stringify(info)};`;

    /*inject:start*/
    /*inject:end*/
    const scriptBlock = /(([ \t]*)\/\*\s*inject:start\s*\*\/)(\r|\n|.)*?(\/\*\s*inject:end\s*\*\/)/gi;
    const hasScriptBlock = scriptBlock.test(html);
    if (hasScriptBlock) {
        const EOL = Util.getEOL();
        html = html.replace(scriptBlock, function(match) {
            const list = [arguments[1]].concat(content).concat(arguments[4]);
            return list.join(EOL + arguments[2]);
        });
    }

    const htmlPath = `${Util.getTempRoot()}/git-blame-${report.name}.html`;
    Util.writeFileContentSync(htmlPath, html, true);

    Util.logCyan(`generated git blame report: ${Util.relativePath(htmlPath)}`);

    if (Util.option.open) {
        await Util.open(htmlPath);
    }

};

module.exports = reportHandler;
