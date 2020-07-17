const {getOptionsPermutations, test} = require('./helpers.js');

getOptionsPermutations().forEach(options => {
    if (options.dynamic && !['cache', 'declarative'].includes(options.mode)) {
        // dynamic only works with cache and declarative mode
        return;
    }

    describe(`[vvl] axis:${options.axis} mode:${options.mode} reverse:${options.reverse} dynamic:${options.dynamic}`, () => {
        test(options);
    });
});
