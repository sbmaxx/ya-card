# Build Process Architecture (Webpack)

This document describes the Webpack build process used in the `ya-card` project.

## Webpack Configuration Files

The project uses three main Webpack configuration files:

1.  **`webpack.common.js`**:  Contains configuration common to both development and production builds.
2.  **`webpack.config.development.js`**:  Configuration specific to development builds, extending `webpack.common.js`.
3.  **`webpack.config.production.js`**:  Configuration for production builds, also extending `webpack.common.js`, and defining both client and server builds.

## `webpack.common.js` - Common Configuration

This file defines the base Webpack configuration, including:

*   **Output:**  Defines output paths and filenames for JavaScript and CSS bundles.
*   **Plugins:**
    *   `HtmlWebpackPlugin`: Generates the HTML file from `src/template.html`, injects data, and handles conditional asset injection.
    *   `ExtractCssChunks`: Extracts CSS into separate files.
*   **Resolve:**  Configures module resolution (e.g., extensions, module directories).
*   **Module Rules:**
    *   Rules for handling JavaScript/JSX files (using Babel loader).
    *   Rules for handling CSS files (using `css-loader`, `postcss-loader`, `ExtractCssChunks.loader`).
    *   Rule for handling inline assets (with `?inject=head|body` query parameters).

## `webpack.config.development.js` - Development Build

This configuration extends `webpack.common.js` and sets up the development build:

*   **Mode:**  Sets Webpack mode to `development`.
*   **Devtool:**  Enables inline source maps for debugging.
*   **Target:**  Targets the `web` environment.
*   **Entry Point:**  Defines `src/web.js` as the entry point for the `web` bundle.
*   **Dev Server:**  Configures `webpack-dev-server` for local development.

## `webpack.config.production.js` - Production Build

This configuration is more complex and defines both client and server builds for production:

*   **Client Build (`client` configuration):**
    *   **Mode:**  Sets Webpack mode to `production`.
    *   **Devtool:**  Disables source maps.
    *   **Target:**  Targets `web`.
    *   **Entry Point:**  `src/inline.js` for the `inline` bundle (containing inline CSS and JS).
    *   **Output:**  Custom `assetModuleFilename` function to handle output paths for inline assets.
    *   **Optimization:**  Enables CSS and JavaScript minimization using `CssMinimizerPlugin` and `TerserPlugin`.
*   **Server Build (`server` configuration):**
    *   **Mode:**  `production`.
    *   **Devtool:**  Disabled.
    *   **Optimization:**  Minimization and module concatenation are disabled for the server build.
    *   **Output:**  `libraryTarget: 'commonjs2'` to output a CommonJS module for Node.js.
    *   **Target:**  `node`.
    *   **Entry Point:**  `src/node.js` for the `node` bundle (server-side rendering logic).
    *   **Externals:**  Excludes `react` and `react-dom/server` from the server bundle.

## Build Scripts (`package.json`)

The `package.json` file defines the following build-related scripts:

*   **`build`**:  `NODE_ENV=production webpack --config webpack.config.production.js && node renderToStaticHtml.js` - Runs the production Webpack build and then executes `renderToStaticHtml.js` to generate the final `index.html`.
*   **`start`**:  `NODE_ENV=development webpack serve --config webpack.config.development.js` - Starts the development server using `webpack-dev-server` and the development configuration.

## Build Output

The Webpack build process outputs files to the `dist` directory, including:

*   `index.html`: The main HTML file for the business card.
*   `template.html`: A copy of the HTML template (in production).
*   JavaScript bundles (`.js` files).
*   CSS bundles (`.css` files).
*   Inline assets (in `inline` subdirectory).

This document provides a detailed overview of the Webpack build process architecture in the `ya-card` project.