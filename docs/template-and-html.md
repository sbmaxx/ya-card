# HTML Template Architecture (`src/template.html`)

This document describes the HTML template architecture in the `ya-card` project, focusing on the `src/template.html` file and its role in the build process.

## File: `src/template.html`

`src/template.html` is the HTML template file used by Webpack and `renderToStaticHtml.js` to generate the final HTML output (`index.html`).

## Key Features and Structure

1.  **Basic HTML Structure:**
    *   Standard HTML5 document structure: `<!DOCTYPE html>`, `<html lang="ru">`, `<head>`, `<body>`.
    *   `<html>` tag includes `ua_js_no` class, which is dynamically updated by inline JavaScript (`Page.inline.js`) to `ua_js_yes` when JavaScript is enabled.

2.  **Meta Tags:**
    *   Includes essential meta tags for character set, viewport, and disabling telephone number detection.
    *   **Dynamic Meta Tags:**  Title, description, and Open Graph meta tags are dynamically populated using data from `htmlWebpackPlugin.options.cards[0]`. This ensures that meta information is based on the card data (specifically, the first language version).
    *   **Default Favicon and OG Image:**  Default favicon and Open Graph image URLs are hardcoded to `yastatic.net` URLs.

3.  **Conditional Script and Style Injection:**
    *   **Webpack Integration:**  Uses HTMLWebpackPlugin syntax (`<% if (htmlWebpackPlugin.options.inject === false) { %> ... <% } %>`) to conditionally inject scripts and styles based on Webpack's build output.
    *   **Inline Asset Injection:**  It looks for specific file patterns in Webpack's compilation assets to inject:
        *   `.head.` files are injected into the `<head>` section within `<script>` tags.
        *   `.body.` files are injected into the `<body>` section within `<script>` tags.
        *   `inline` CSS files are injected into the `<head>` section within `<style>` tags.
    *   **`htmlWebpackPlugin.options.inject === false` Condition:**  This condition likely controls whether Webpack's default automatic injection is disabled. When `inject` is `false`, the template takes over manual injection using the conditional blocks.

4.  **`<div id="root"></div>` Placeholder:**
    *   **React Root:**  The `<div id="root"></div>` element acts as the root container for the React application.
    *   **Server-Side Rendering Injection:**  `renderToStaticHtml.js` script replaces this placeholder with the server-rendered HTML content of the `Card` component.

5.  **`page` Class on `<body>`:**
    *   **Global Page Styling:**  The `<body>` tag has a `page` class, which is likely used for applying global page-level styles defined in `Page.css`.

## Role in Build Process

1.  **Webpack Input:**  `src/template.html` is specified as the `template` option in `HtmlWebpackPlugin` in `webpack.common.js`.
2.  **HTML Generation:**  Webpack, with `HtmlWebpackPlugin`, processes `src/template.html`.
    *   It injects CSS and JavaScript bundles (unless `inject: false` is set).
    *   It makes data from `htmlWebpackPlugin.options` available in the template (e.g., `htmlWebpackPlugin.options.cards`).
    *   It outputs a processed HTML file to the `dist` directory (filename depends on production/development build).
3.  **Static HTML Generation:**  `renderToStaticHtml.js` reads the processed template from `dist`, injects the server-rendered HTML into the `<div id="root"></div>` placeholder, and creates the final `index.html`.

This document provides a comprehensive overview of the HTML template architecture in the `ya-card` project, detailing the structure, features, dynamic content injection, and its role in the Webpack build process and static HTML generation.