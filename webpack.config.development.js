const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
    target: 'web',
    entry: {
        web: './src/web.js',
    },
    devServer: {
        contentBase: './dist',
        host: process.env.DEV_HOST || '0.0.0.0'
    }
});
