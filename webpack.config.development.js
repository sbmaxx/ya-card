const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'eval',
    target: 'web',
    entry: {
        web: './src/web.js',
    },
    devServer: {
        contentBase: './dist',
        host: 'sbmaxx-dev.sas.yp-c.yandex.net'
    }
});
