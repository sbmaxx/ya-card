# Plan: Migrating from Webpack to Vite

This plan outlines the steps to migrate the `ya-card` project from Webpack to Vite. The goal is to achieve a smooth transition while maintaining all existing features and functionality.

**Phase 1: Project Setup and Vite Integration**

1.  **Install Vite and Dependencies:**
    *   Remove Webpack and related dependencies: `@babel/core`, `@babel/preset-env`, `@babel/preset-react`, `babel-loader`, `css-loader`, `css-minimizer-webpack-plugin`, `extract-css-chunks-webpack-plugin`, `file-loader`, `html-webpack-plugin`, `postcss`, `postcss-loader`, `postcss-preset-env`, `postcss-url`, `style-loader`, `stylelint`, `stylelint-config-standard`, `webpack`, `webpack-cli`, `webpack-dev-server`, `webpack-merge`, `terser-webpack-plugin`.
    *   Install Vite and essential plugins: `vite`, `@vitejs/plugin-react`, `vite-plugin-html`.  We'll need `@vitejs/plugin-react` for React support and `vite-plugin-html` to handle HTML template transformations similar to `HtmlWebpackPlugin`.
    *   Install Rollup as Vite's bundler: `rollup`. (Vite uses Rollup under the hood, but it's good to have it explicitly in `devDependencies`).
    ```bash
    npm uninstall @babel/core @babel/preset-env @babel/preset-react babel-loader css-loader css-minimizer-webpack-plugin extract-css-chunks-webpack-plugin file-loader html-webpack-plugin postcss postcss-loader postcss-preset-env postcss-url style-loader stylelint stylelint-config-standard webpack webpack-cli webpack-dev-server webpack-merge terser-webpack-plugin
    npm install vite @vitejs/plugin-react vite-plugin-html rollup -D
    ```

2.  **Create `vite.config.js`:**
    *   Create a `vite.config.js` file in the project root.
    *   Configure basic settings:
        *   Use `@vitejs/plugin-react` to enable React support.
        *   Use `vite-plugin-html` to handle HTML template. Configure it to process `src/template.html` and inject data similar to how `HtmlWebpackPlugin` was used. We'll need to figure out how to pass the `data.js` content to `vite-plugin-html`.
        *   Configure `build` options to match the output directory (`dist`) and asset handling.
        *   Set up `resolve` options for module extensions (`.js`, `.jsx`, `.json`, `.ts`, `.tsx`, `.scss`).
    ```javascript
    // vite.config.js
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'
    import html from 'vite-plugin-html'
    import data from './data.js' // Import data.js

    export default defineConfig({
      plugins: [
        react(),
        html({
          template: 'src/template.html',
          inject: {
            data: data, // Pass data to the template
          },
          // transformIndexHtml: (html) => { // Example of custom transformation if needed
          //   return html.replace('<!-- custom-placeholder -->', '<h1>Hello from Vite!</h1>');
          // }
        }),
      ],
      build: {
        outDir: 'dist', // Output directory
        rollupOptions: {
          output: {
            assetFileNames: (assetInfo) => { // Handle asset filenames similar to webpack config
              if (assetInfo.name.includes('inline')) {
                const inject = assetInfo.name.includes('head') ? 'head' : 'body';
                return `inline/[name].${inject}[extname]`;
              }
              return '[name].[extname]';
            },
          },
        },
      },
      resolve: {
        extensions: ['.js', '.jsx', '.json', '.ts', '.tsx', '.scss'],
      },
    })
    ```

3.  **Update `package.json` Scripts:**
    *   Update the `scripts` in `package.json` to use Vite commands:
        *   `start`: Change `webpack serve --config webpack.config.development.js` to `vite`.
        *   `build`: Change `NODE_ENV=production webpack --config webpack.config.production.js && node renderToStaticHtml.js` to `vite build`. We will likely need to remove `renderToStaticHtml.js` and adjust the build process as Vite handles static HTML generation differently.
        *   `test`: Keep stylelint and eslint scripts as they are.
        *   `cleanup`: Keep the cleanup script.
        *   `postinstall`, `prepare`: Keep these scripts.
    ```json
    "scripts": {
      "test": "stylelint src/**/*.css && eslint --ext .jsx,.js src/",
      "build": "vite build",
      "cleanup": "find dist -mindepth 1 -not -name 'index.html' -delete",
      "start": "vite",
      "postinstall": "cp example.js data.js",
      "prepare": "husky install"
    },
    ```

**Phase 2: Template and Inline Asset Handling**

4.  **Adapt `src/template.html`:**
    *   Review `src/template.html` and adjust it for Vite.
    *   Remove Webpack-specific syntax (`<%= htmlWebpackPlugin.options... %>`, `<% if (htmlWebpackPlugin.options.inject === false) { %> ... <% } %>`).
    *   For dynamic meta tags, explore Vite's HTML transformation capabilities or consider using a plugin if `vite-plugin-html` doesn't fully cover the needs. We might need to access the `data` object passed via `vite-plugin-html` differently.  We can try accessing it directly in the template if `vite-plugin-html` makes it available globally, or use template literals within `<script>` tags to inject data.
    *   For inline scripts and styles (`.inline.js`, `.inline.css`), Vite might handle them differently. We might need to adjust how these are included in the build and injected into the HTML.  Vite might automatically handle CSS imports in JS as inline styles during build, but we need to verify this. For JS, we might need to adjust the entry points or use Vite's plugin API to handle inline scripts.

    *Example adjustment for meta tags in `src/template.html` (assuming `data` is available in the template scope via `vite-plugin-html`):*
    ```html
    <title><%= data.cards[0].name %></title>
    <meta name="description" content="<%= data.cards[0].position %>, <%= data.cards[0].company.name %>">
    <meta property="og:title" content="<%= data.cards[0].name %>">
    <meta property="og:description" content="<%= data.cards[0].position %>, <%= data.cards[0].company.name %>">
    ```

5.  **Handle Inline Assets (`.inline.js`, `.inline.css`):**
    *   Vite's approach to inline assets might be different from Webpack's. We need to investigate how Vite handles CSS and JS files imported in JavaScript and how it can generate inline assets.
    *   If Vite doesn't directly support the same inline asset injection mechanism as Webpack, we might need to:
        *   Adjust the entry points (`src/inline.js`) and how these files are imported.
        *   Use Vite's plugin API to create a custom plugin to handle inline asset generation and injection if necessary.
        *   Alternatively, we might need to rethink the inline asset strategy and potentially move some inline styles/scripts to regular CSS/JS files if Vite's default behavior is sufficient.

**Phase 3: Testing and Verification**

6.  **Test Development Server:**
    *   Run `npm start` (or `vite dev`) and verify that the development server starts correctly.
    *   Check if hot module replacement (HMR) is working for CSS and JavaScript changes.
    *   Ensure the card is rendering correctly in the browser.

7.  **Test Production Build:**
    *   Run `npm run build` (or `vite build`) and verify that the production build completes without errors.
    *   Check the output in the `dist` directory.
    *   Open `dist/index.html` in a browser and verify that the card is rendered correctly and all functionality is working as expected:
        *   Language switching (via URL hash).
        *   Dark/light theme.
        *   Responsiveness.
        *   Links and interactions.
        *   Check for any console errors or unexpected behavior.

8.  **Functional and Regression Testing:**
    *   Thoroughly test all features and functionality of the business card to ensure nothing is broken during the migration.
    *   Compare the behavior and performance of the Vite build with the previous Webpack build.
    *   Pay special attention to aspects like:
        *   SEO (check if JSON-LD is still correctly generated - might need to adjust `CardJSONLD` component if SSR changes).
        *   Accessibility.
        *   Performance (compare initial load time, bundle sizes).

**Phase 4: Optimization and Refinement (Optional)**

9.  **Optimize Vite Configuration:**
    *   Fine-tune `vite.config.js` for optimal performance and build output.
    *   Explore Vite's features and plugins for further optimization.
    *   Consider code splitting and other Rollup optimizations if needed.

10. **Code Cleanup:**
    *   Remove any Webpack-specific code or configurations that are no longer needed.
    *   Refactor code if necessary to better align with Vite's conventions and best practices.

**Potential Challenges and Considerations:**

*   **HTML Template Handling:**  Migrating from `HtmlWebpackPlugin` to `vite-plugin-html` might require adjustments in how data is injected and how template transformations are handled.
*   **Inline Asset Handling:**  Vite's approach to inline assets might be different, requiring adjustments to the build process or code structure.
*   **Server-Side Rendering (Static HTML Generation):**  Vite is primarily designed for client-side applications. We need to ensure that the static HTML generation process (currently using `renderToStaticHtml.js`) is still achievable with Vite or find an alternative approach if Vite's default build output is sufficient for our needs.  Vite might directly output a static `index.html` that we can use, potentially simplifying the build process. We should investigate if we still need `renderToStaticHtml.js` after Vite migration.
*   **Plugin Compatibility:**  Ensure that any PostCSS plugins or other build-related tools are compatible with Vite and Rollup.
*   **Testing Effort:**  Thorough testing is crucial to ensure a successful migration and maintain all existing functionality.

**Rollback Plan:**

*   If the migration to Vite encounters significant issues or breaks functionality, we can easily rollback to the previous Webpack setup by:
    *   Reinstalling Webpack dependencies.
    *   Reverting changes to `package.json` scripts.
    *   Deleting `vite.config.js`.
    *   Restoring the original Webpack configuration files.
    *   Cleaning up `node_modules` and reinstalling dependencies.