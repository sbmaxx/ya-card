# Client-Side Logic Architecture (`src/Card/Card.inline.js`)

This document describes the client-side JavaScript logic implemented in `src/Card/Card.inline.js` for the `ya-card` project.

## File: `src/Card/Card.inline.js`

This file contains plain JavaScript code (not React JSX) that is responsible for adding interactivity to the business card in the browser. It is bundled as an inline script for performance optimization.

## Module Pattern

The code is structured using a module pattern (IIFE - Immediately Invoked Function Expression) to encapsulate the logic and avoid polluting the global scope.

## `Card` Module Object

The main module object is named `Card` and it exposes methods and properties for controlling the card's behavior.

### Key Methods and Functionality

1.  **`Card.init()`**: Initialization method that is called when the DOM is ready (`DOMContentLoaded` event).
    *   Finds and stores references to DOM elements (`.card`, `.card__side`, `.card__link`).
    *   Parses BEM parameters from the `data-bem` attribute of the `.card` element.
    *   Sets up event listeners (e.g., `hashchange` for language switching).
    *   Applies initial CSS classes for animation and visibility.
    *   Removes `href` attributes from phone links on desktop (conditional logic based on user agent).

2.  **`Card.changeLang(lang)`**:  Method to change the displayed language of the card.
    *   Orchestrates a series of actions to update the page for the new language:
        *   `_changeTitle(lang)`: Updates `document.title`.
        *   `_changeFavicon(lang)`: Updates the favicon.
        *   `_changeHtmlLang(lang)`: Updates the `lang` attribute of the `<html>` element.
        *   `_switchSide(lang)`:  Handles the visual card side transition/animation.
        *   `_changeUrl(lang)`: Updates the language switch links (disables the current language link).

3.  **`_onHashChange()`**:  Event handler for the `hashchange` event.
    *   Called when the URL hash changes (e.g., when the user clicks a language switch link).
    *   Extracts the language code from the hash and calls `Card.changeLang()` to update the card.

4.  **`_switchSide(lang)`**:  Handles the animation/transition when switching card languages.
    *   Determines the "from" and "to" card sides based on the target language.
    *   Adds and removes CSS classes to trigger CSS transitions for the card sides.

5.  **Utility Functions**:  The module includes helper functions for DOM manipulation:
    *   `addClass(elem, className)`
    *   `removeClass(elem, className)`
    *   `hasClass(elem, className)`

## Event Handling

*   **`hashchange` event**:  Used for language switching based on URL hash changes.
*   **`DOMContentLoaded` event**:  Used to initialize the `Card` module when the DOM is ready.

## Viewport Scaling (Commented Out)

The file contains a commented-out section related to viewport scaling for mobile devices. This logic is currently disabled but suggests that there was an attempt to dynamically adjust the viewport `initial-scale` to fit the card on different screen sizes and orientations.

This document provides an overview of the client-side JavaScript logic in `src/Card/Card.inline.js`, detailing its module structure, key methods, event handling, and functionality for adding interactivity to the `ya-card` component.