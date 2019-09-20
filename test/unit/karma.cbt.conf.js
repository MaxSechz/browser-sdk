const karmaBaseConf = require('./karma.base.conf')
const browsers = require('./browsers.conf')

// force entry resolution to ensure sinon code is in ES5
// https://github.com/webpack/webpack/issues/5756
// https://github.com/sinonjs/sinon/blob/894951c/package.json#L113
karmaBaseConf.webpack.resolve.mainFields = ['cdn', 'main']

module.exports = function(config) {
  config.set({
    ...karmaBaseConf,
    plugins: ['karma-*', 'karma-cbt-launcher'],
    reporters: [...karmaBaseConf.reporters, 'CrossBrowserTesting'],
    browsers: Object.keys(browsers),
    concurrency: 1,
    captureTimeout: 60000,
    browserDisconnectTimeout: 60000,
    browserDisconnectTolerance: 3,
    browserNoActivityTimeout: 60000,
    cbtConfig: {
      username: process.env.CBT_USERNAME,
      authkey: process.env.CBT_AUTHKEY,
    },
    customLaunchers: browsers,
  })
}