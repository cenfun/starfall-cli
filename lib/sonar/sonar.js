const fs = require('fs');
const Util = require('../core/util.js');

const sonarModule = (p) => {

    console.log('Start to update sonar properties');

    const projectConf = Util.getProjectConf(true);
    const EOL = Util.getEOL();

    const lines = [];

    lines.push(`sonar.projectKey=${Util.getValue(projectConf, 'sonar.projectKey', projectConf.name)}`);
    lines.push(`sonar.projectName=${Util.getValue(projectConf, 'sonar.projectName', projectConf.name)}`);
    lines.push(`sonar.projectVersion=${projectConf.version}`);

    const exclusions = Util.getValue(projectConf, 'sonar.exclusions');
    if (exclusions) {
        lines.push(`sonar.exclusions=${exclusions}`);
    }

    lines.push(EOL);

    lines.push('sonar.language=js');
    lines.push('sonar.sourceEncoding=UTF-8');

    lines.push(EOL);

    const tempPath = Util.getConfig('tempPath');

    if (Util.componentsRoot) {

        const components = Util.getComponentList(true);
        const list = [];

        //filter no specs
        components.forEach(function(name) {
            const specsPath = `${Util.root}/packages/${name}/test/specs`;
            if (!fs.existsSync(specsPath)) {
                return;
            }
            const jss = fs.readdirSync(specsPath);
            if (!jss.length) {
                return;
            }
            list.push(name);
        });

        const modules = list.join(',');
        lines.push(`sonar.modules=${modules}`);
        lines.push(EOL);

        list.forEach(function(name) {

            lines.push(`${name}.sonar.projectBaseDir=.`);
            lines.push(`${name}.sonar.sources=packages/${name}/src`);
            lines.push(`${name}.sonar.tests=packages/${name}/test/specs`);
            lines.push(`${name}.sonar.javascript.lcov.reportPaths=${tempPath}/coverage/${name}/lcov.info`);
            lines.push(EOL);

        });

    } else {

        lines.push('sonar.sources=src');
        lines.push('sonar.tests=test/specs');
        lines.push(`sonar.javascript.lcov.reportPaths=${tempPath}/coverage/${projectConf.name}/lcov.info`);
    }

    let content = lines.join(EOL);
    content += EOL;

    Util.editFile(`${Util.root}/sonar-project.properties`, function() {
        return content;
    });

    Util.logGreen('sonar-project.properties updated');

};

module.exports = sonarModule;
