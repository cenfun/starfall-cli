const fs = require('fs');

const esprima = require('esprima');
//const espree = require("espree");
//const esquery = require("esquery");
const estraverse = require('estraverse');
const escodegen = require('escodegen');
//const esutils = require("esutils");

const beautify = require('js-beautify');

const Util = require('../core/util.js');

//====================================================================================
// const forEachComponent = function(callback) {
//     const names = fs.readdirSync(`${Util.root}/components`);
//     names.forEach(function(name) {
//         callback(name);
//     });
// };

const replaceM = function(content, s1, s2, r1, r2) {

    const list = content.split(s1);
    if (list.length <= 1) {
        return content;
    }

    for (let i = 1; i < list.length; i++) {
        const item = list[i];
        if (!item) {
            list[i] = s1 + item;
            continue;
        }
        //must match s2
        const s2Index = item.indexOf(s2);
        if (s2Index === -1) {
            list[i] = s1 + item;
            continue;
        }

        //has s2, only handle first s2
        const item1 = item.substring(0, s2Index);
        const item2 = item.substr(s2Index + s2.length);
        const itemNew = item1 + r2 + item2;

        list[i] = r1 + itemNew;

    }

    return list.join('');

};

//====================================================================================

const handler = function() {

    console.log('Start to update Jasmine to Mocha ...');

    const name = 'widget';

    const specsPath = `${Util.root}/packages/${name}/test/specs/`;

    if (!fs.existsSync(specsPath)) {
        console.log(`Not found test/specs, ignore component: ${name}`);
        return;
    }

    console.log(`update test specs for component ${name} ...`);

    Util.forEachFile(specsPath, ['.js'], function(fileName, filePath) {
        const specPath = `${filePath}/${fileName}`;
            

        console.log(` |- update spec file: ${specPath}`);

        Util.editFile(specPath, function(content) {

            if (!content) {
                console.log(`No content: ${specPath}`);
                return content;
            }

            let tree = esprima.parseScript(content, {
                comment: true,
                range: true,
                tokens: true
            });

            // let tree = espree.parse(content, {
            //     comment: true,
            //     range: true,
            //     tokens: true,
            //     ecmaVersion: espree.latestEcmaVersion
            // });

            tree = escodegen.attachComments(tree, tree.comments, tree.tokens);
                

            const funNames = [];

            tree = estraverse.replace(tree, {
                enter(node, parent) {
                    if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression') {
                        const body = node.body.body;
                        if (!body) {
                            const str = escodegen.generate(node);
                            console.log(str);
                            return;
                        }
                        const matches = body.filter(item => {
                            return item.type === 'ExpressionStatement' && item.expression.type === 'AwaitExpression';
                        });
                        if (matches.length) {
                            const funName = node.id && node.id.name;
                            console.log(funName, matches.length);
                            if (funName) {
                                funNames.push(funName);
                            }
                            node.async = true;
                        }
                    }
                }
            });


            tree = estraverse.replace(tree, {
                enter(node, parent) {
                    if (node.type === 'CallExpression' && funNames.includes(node.callee.name)) {
                        node.callee.name = `await ${node.callee.name}`;
                    }
                }
            });

            tree = estraverse.replace(tree, {
                enter(node, parent) {
                    if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression') {
                        const body = node.body.body;
                        if (!body) {
                            const str = escodegen.generate(node);
                            console.log(str);
                            return;
                        }
                        const matches = body.filter(item => {
                            return item.type === 'ExpressionStatement' && item.expression.callee && item.expression.callee.name && item.expression.callee.name.startsWith('await ');
                        });
                        if (matches.length) {
                            node.async = true;
                        }
                    }
                }
            });

            let source = escodegen.generate(tree, {
                format: {
                    quotes: 'double'
                },
                comment: true
            });

            source = beautify.js(source, Util.getBeautifyOption());

              
            //Util.writeJSONSync(`${specPath}on`, tree, true);
    

            source = source.replace('beforeAll', 'before');
            source = source.replace('afterAll', 'after');

            source = source.replace(/expect\((.*)\)\.toBeTruthy\(\)/ig, 'assert.ok($1)');
            source = source.replace(/expect\((.*)\)\.toBeTruthy/ig, 'assert.ok($1)');

            source = source.replace(/expect\((.*)\)\.not\.toBeTruthy\(\)/ig, 'assert.ok(!$1)');
            source = source.replace(/expect\((.*)\)\.not\.toBeTruthy/ig, 'assert.ok(!$1)');

            source = source.replace(/expect\((.*)\)\.toBeFalsy\(\)/ig, 'assert.equal($1, false)');
            source = source.replace(/expect\((.*)\)\.toBeFalsy/ig, 'assert.equal($1, false)');

            source = source.replace(/expect\((.*)\)\.toBeNull\(\)/ig, 'assert.equal($1, null)');
            source = source.replace(/expect\((.*)\)\.toBeNull/ig, 'assert.equal($1, null)');

            source = source.replace(/expect\((.*)\)\.toBeUndefined\(\)/ig, 'assert.equal($1, undefined)');
            source = source.replace(/expect\((.*)\)\.toBeUndefined/ig, 'assert.equal($1, undefined)');

            source = source.replace(/expect\((.*)\)\.toBe\((.*)\)/ig, 'assert.equal($1, $2)');
            source = source.replace(/expect\((.*)\)\.toEqual\((.*)\)/ig, 'assert.equal($1, $2)');

            source = source.replace(/expect\((.*)\)\.not\.toBe\((.*)\)/ig, 'assert.notEqual($1, $2)');
            source = source.replace(/expect\((.*)\)\.not\.toEqual\((.*)\)/ig, 'assert.notEqual($1, $2)');

            source = source.replace(/expect\((.*)\)\.toContain\((.*)\)/ig, 'assert.ok($1.indexOf($2) !== -1)');
            source = source.replace(/expect\((.*)\)\.toMatch\((.*)\)/ig, 'assert.ok($1.indexOf($2) !== -1)');

            source = source.replace(/spyOn\((.*)\)/ig, 'spyCall($1)');
            source = source.replace(/expect\((.*)\)\.toHaveBeenCalled\(\)/ig, 'assert.ok($1.called)');

            // //multiple line 
            source = replaceM(source, 'expect(', ').toBe(', 'assert.equal(', ', ');
            source = replaceM(source, 'expect(', ').toEqual(', 'assert.equal(', ', ');

            source = replaceM(source, 'expect(', ').toBeTruthy()', 'assert.ok(', ')');
            source = replaceM(source, 'expect(', ').toBeFalsy()', 'assert.ok(!', ')');

            source = replaceM(source, 'expect(', ').toBeLessThan(', 'assert.ok(', ' < ');
            source = replaceM(source, 'expect(', ').toBeGreaterThan(', 'assert.ok(', ' > ');

            source = replaceM(source, 'expect(', ', ', 'assert.equal(', ', ');


            // source = source.replace("delay(1000)", "delay(200)");
            // source = source.replace("delay(500)", "delay(100)");

            // //async
            // source = source.replace(/beforeEach\(\s?function\s?\(\)/g, "beforeEach(async () => ");
            // source = source.replace(/afterEach\(\s?function\s?\(\)/g, "afterEach(async () => ");

            // source = replaceM(source, "it(", ", function() {", "it(", ", async () => {");
            // source = replaceM(source, "it(", ", function(done) {", "it(", ", async (done) => {");
            // source = replaceM(source, "it(", ",function() {", "it(", ", async () => {");
            // source = replaceM(source, "it(", ", function(){", "it(", ", async () => {");
            // source = replaceM(source, "it(", ",function(){", "it(", ", async () => {");
            // source = replaceM(source, "it(", ", function () {", "it(", ", async () => {");


            // //source = source.replace(/=\s?function\s?\((.*)\)\s?{/g, "= async function($1) {");

            // source = functionReplace(source);
                
            return source;

        });

    });


};

module.exports = handler;
