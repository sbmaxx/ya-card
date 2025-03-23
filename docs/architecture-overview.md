# Architecture Overview of ya-card project

This document provides a high-level overview of the `ya-card` project architecture.

## Project Purpose

The `ya-card` project is a static business card component built using React, Webpack, and plain JavaScript. It is designed to be a lightweight, performant, and easily deployable digital business card with features like:

*   Multiple language support
*   Dark theme
*   SEO optimization (using JSON-LD)
*   Inline assets for performance

## Technology Stack

*   **Frontend Framework:** React
*   **Bundler:** Webpack
*   **Transpiler:** Babel
*   **CSS Processing:** PostCSS
*   **Styling:** CSS variables, BEM (implied), inline styles
*   **JavaScript:** Plain JavaScript (ES6+)
*   **Server-Side Rendering:** Node.js (for static HTML generation)

## High-Level Architecture Diagram

```mermaid
graph LR
    Data[data.js] --> Card(Card Component)
    Card --> CardSide
    Card --> CardLink
    Card --> CardSwitch
    Card --> CardJSONLD
    Card -- renders in --> WebBrowser[Web Browser (src/web.js)]
    Card -- server-side render --> NodeRenderer[Node.js (src/node.js)]
    NodeRenderer -- generates HTML --> renderToStaticHtml.js
    renderToStaticHtml.js -- injects HTML into --> Template[src/template.html]
    Template -- Webpack + HtmlWebpackPlugin --> index.html & template.html
    style.css --> Card
    style.css --> Page
    CardInlineJS[Card.inline.js] --> Card
    PageInlineJS[Page.inline.js] --> Page
```

## Main Components

1.  **`src/Card/Card.jsx` (Card Component):** The core React component responsible for rendering the business card UI. It manages language switching and integrates other sub-components.
2.  **`src/Page/Page.css` & `src/Card/Card.css` (Styling):** CSS files using CSS variables for theming and layout.
3.  **`src/Card/Card.inline.js` (Client-Side Logic):** Plain JavaScript module for handling client-side interactions like language switching and animations.
4.  **`src/node.js` (Server-Side Rendering):** Node.js script for rendering the `Card` component to static HTML.
5.  **`renderToStaticHtml.js` (HTML Generation):** Node.js script that combines the server-rendered HTML with the HTML template to generate the final `index.html` file.
6.  **`src/template.html` (HTML Template):**  HTML template file used by Webpack and `renderToStaticHtml.js` to create the final HTML output.
7.  **`webpack.config.js` (Webpack Configuration):** Webpack configuration files for bundling and building the project in development and production environments.
8.  **`data.js` (Data Source):**  JavaScript file containing the data for the business card, such as personal information, company details, and contact information.

This overview provides a starting point for understanding the project's architecture. The following documents in this memory-bank will delve into each of these components in more detail.