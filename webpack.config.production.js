const { merge } = require('webpack-merge');
const common = require('./webpack.common');

const client = merge(common, {
    mode: 'production',
    devtool: false,
    target: 'web',
    entry: {
        inline: './src/inline.js'
    }
});

const server = merge(common, {
    mode: 'production',
    devtool: false,
    optimization: {
        minimize: false,
        concatenateModules: false,
    },
    target: 'node',
    entry: {
        node: './src/node.js',
    },
    resolve: {
        modules: ['node_modules'],
        extensions: ['.js', '.jsx', '.json', '.ts', '.tsx', '.scss'],
    },
    externals: {
        'react': 'react',
        'react-dom/server': 'react-dom/server'
    }
});

module.exports = [server, client];
