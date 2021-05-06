const { merge } = require('webpack-merge');
const common = require('./webpack.common');

const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");

const client = merge(common, {
    mode: 'production',
    devtool: false,
    target: 'web',
    entry: {
        inline: './src/inline.js'
    },
    output: {
        assetModuleFilename: (pathData) => {
            const inject = pathData.filename.includes('inject=head') ? 'head' : 'body';
            return `inline/[name].${inject}[ext]`;
        }
    },
    optimization: {
        minimize: true,
        minimizer: [new CssMinimizerPlugin, new TerserPlugin()]
    }
});

const server = merge(common, {
    mode: 'production',
    devtool: false,
    optimization: {
        minimize: false,
        concatenateModules: false,
    },
    output: {
        libraryTarget: 'commonjs2'
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
