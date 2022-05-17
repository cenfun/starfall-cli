// https://mochajs.org/
// https://nodejs.org/api/assert.html
const assert = require('assert');
const Component = require('../../src');
describe('my suite name', function() {
    it('case name', function() {
        assert.ok(Component);
    });
});
