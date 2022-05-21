const path = require('path');
const Util = require('../core/util.js');

const isSingleLineComment = (codeStr) => {
    const singleCommentBlock = /^[ \f\t\v]*\/\/.*$/g;
    if (singleCommentBlock.test(codeStr)) {
        return true;
    }
    const multipleCommentBlock = /^[ \f\t\v]*\/\*.*\*\/.*$/g;
    if (multipleCommentBlock.test(codeStr)) {
        return true;
    }
    return false;
};

const isMultipleCommentStart = (codeStr) => {
    const multipleCommentStartBlock = /^[ \f\t\v]*\/\*.*$/g;
    if (multipleCommentStartBlock.test(codeStr)) {
        return true;
    }
    return false;
};

const isMultipleCommentEnd = (codeStr) => {
    const multipleCommentEndBlock = /^.*\*\/.*$/g;
    if (multipleCommentEndBlock.test(codeStr)) {
        return true;
    }
    return false;
};

const isBlank = (codeStr) => {
    const blankBlock = /^[ \f\t\v]*$/g;
    if (blankBlock.test(codeStr)) {
        return true;
    }
    return false;
};

const reportHandler = (job, stdout) => {
    if (!stdout) {
        return;
    }
    // line type
    const types = {
        line: 'line',
        comment: 'comment',
        blank: 'blank',
        json: 'json'
    };
    const ext = path.extname(job.filePath);
    const lineList = stdout.split(/[\r\n]+/g);
    let multipleCommentStart = false;
    // let totalLines = 0;
    return lineList.map(function(line) {

        const blameBlock = /^(\w{40})\s+\(([^)]*)\)(.*)$/g;
        const list = blameBlock.exec(line);
        if (!list) {
            // Util.logYellow(line);
            // EOL
            return;
        }

        // totalLines += 1;

        // parse line info
        const commitId = list[1];
        const infoStr = list[2];
        const codeStr = list[3];

        // blame info
        const blameList = infoStr.split(/\s+/g);
        // Author Name 1557844267 +0800  1

        // test
        // const lineNum = ~~blameList[len - 1];
        // if (totalLines !== lineNum) {
        //     Util.logYellow("Line number unmatched: " + lineNum + " => " + totalLines);
        // }

        // timestamp
        const timestamp = ~~blameList[blameList.length - 3] * 1000;
        // remain name
        const author = blameList.slice(0, blameList.length - 3).join(' ').trim();

        const info = {
            commitId: commitId,
            author: author,
            timestamp: timestamp,
            // default type line
            type: types.line
        };

        if (ext === '.json') {
            // json
            info.type = types.json;
        } else if (isBlank(codeStr)) {
            // blank
            info.type = types.blank;
        } else {
            // js comments
            if (multipleCommentStart) {
                // multi-comments mid
                info.type = types.comment;
                if (isMultipleCommentEnd(codeStr)) {
                    // multi-comments end
                    multipleCommentStart = false;
                }
            } else if (isSingleLineComment(codeStr)) {
                // single line comment
                info.type = types.comment;
            } else if (isMultipleCommentStart(codeStr)) {
                // multi-comments start
                info.type = types.comment;
                multipleCommentStart = true;
            }
        }

        return info;

    }).filter((item) => item);
};

const blameHandler = async (job) => {

    Util.jobId = job.jobId;
    Util.jobName = job.jobName;

    const cmd = `git blame -t -l -c ${job.filePath}`;
    const option = {
        silent: true
    };

    Util.log('[exec]', cmd);
    const exitCode = await Util.exec(cmd, option);
    if (exitCode) {
        return 0;
    }

    job.report = await reportHandler(job, option.stdout);

    return 0;
};

module.exports = blameHandler;
