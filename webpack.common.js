const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractCssChunks = require('extract-css-chunks-webpack-plugin');

const data = require('./data.js');
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
    output: {
        filename: '[name].js',
        chunkFilename: '[id].js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: isProduction ? 'template.html' : 'index.html',
            template: 'src/template.html',
            ...data,
            inject: !isProduction
        }),
        new ExtractCssChunks({
            filename: '[name].css',
            chunkFilename: '[id].css',
            ignoreOrder: false,
        }),
    ],
    resolve: {
        modules: ['node_modules'],
        extensions: ['.js', '.jsx', '.json', '.ts', '.tsx', '.scss'],
    },
    module: {
        rules: [
            {
                resourceQuery: /inject=(head|body)/,
                type: 'asset/resource',
            },
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
            {
                test: /\.css$/,
                use: [
                  {
                    loader: ExtractCssChunks.loader,
                    options: {
                      hmr: !isProduction,
                    },
                  },
                  'css-loader',
                  "postcss-loader"
                ],
            },
        ],
    },
};
