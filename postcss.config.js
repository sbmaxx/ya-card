module.exports = {
    plugins: [
        require('postcss-preset-env'),
        require('postcss-url')({ url: 'inline', optimizeSvgEncode: true })
    ],
};
