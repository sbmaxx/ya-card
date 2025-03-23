# Styling and Theming Architecture

This document describes the styling and theming architecture of the `ya-card` project.

## CSS Files

The project uses two main CSS files:

*   **`src/Page/Page.css`**:  Provides global styles for the page, including body background and text colors, and basic layout.
*   **`src/Card/Card.css`**:  Styles the `Card` component and its sub-components, defining the visual appearance of the business card.

## Theming with CSS Variables

The project implements theming using CSS variables (custom properties).

*   **CSS Variables for Theming:**  Both `Page.css` and `Card.css` define CSS variables to control colors, fonts, and other visual aspects.
*   **Dark and Light Mode:**  The project supports both dark and light modes using `@media (prefers-color-scheme: dark)` and `@media (prefers-color-scheme: light)` media queries.
*   **Theme-Specific Variables:**  Within these media queries, different values are assigned to the CSS variables to switch between dark and light themes.

### Example: Dark Mode Variables in `src/Card/Card.css`

```css
@media (prefers-color-scheme: dark) {
    body {
        --card-color: rgba(255, 255, 255, 0.75);
        --card-bg-color: #18181a;
        --link-primary-color: rgba(255, 255, 255, 0.75);
        --link-secondary-color: rgba(255, 255, 255, 0.75);
        --link-hover-color: #fff;
        --separator-color: #30363d;
        --shadow: rgb(0 0 0 / 50%);
    }
}
```

## BEM (Implied)

While not strictly enforced, the project appears to follow the BEM (Block-Element-Modifier) naming convention for CSS classes.

*   **BEM-like Classes:**  Classes like `card`, `card__side`, `card__title`, `card_modifier` suggest the use of BEM methodology for CSS organization and specificity.
*   **Component-Based Styling:**  CSS styles are primarily scoped to components, with `Card.css` styling the `Card` component and `Page.css` styling the overall page.

## Inline Styles

The project utilizes inline styles for specific elements and behaviors.

*   **Inline CSS and JavaScript:**  `src/Card/Card.inline.js` and `src/Page/Page.inline.js` are used to include inline JavaScript and potentially inline CSS (though CSS in these files is less prominent).
*   **Performance Optimization:**  Inline styles and scripts can improve initial page load performance by reducing external requests.

## CSS Processing

*   **PostCSS:**  PostCSS is used in the build process (configured in `postcss.config.js`) to apply CSS transformations and optimizations.
*   **Webpack Loaders:**  `css-loader`, `style-loader`, and `postcss-loader` are used in the Webpack configuration to process CSS files.
*   **CSS Extraction:**  `extract-css-chunks-webpack-plugin` is used to extract CSS into separate files for production builds.

This document outlines the styling and theming architecture of the `ya-card` project, highlighting the use of CSS variables, theming, BEM (implied), inline styles, and CSS processing with PostCSS and Webpack.