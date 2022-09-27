const context = require.context('{placeholder-specs-path}', true, /\.js$/);
const specList = [];
context.keys().forEach((p) => {
    const spec = '{placeholder-spec}';
    if (spec) {
        const str = p.toLowerCase();
        if (str.indexOf(spec) === -1) {
            return;
        }
    }
    specList.push(p);
    context(p);
});
console.log('specs: ', specList);
