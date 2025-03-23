# Component Architecture: Card Component

This document details the architecture of the `Card` component (`src/Card/Card.jsx`), which is the core React component in the `ya-card` project.

## Card Component (`src/Card/Card.jsx`)

The `Card` component is responsible for rendering the business card UI. It is a class component that orchestrates the rendering of sub-components and manages the overall card structure.

### Sub-components

The `Card` component is composed of the following sub-components:

1.  **`CardSide`**: Renders a single language version of the card.
2.  **`CardLink`**:  A wrapper around the `<a>` tag for consistent styling and microdata attributes.
3.  **`CardSwitch`**:  Renders language switch links when multiple languages are available.
4.  **`CardJSONLD`**:  Generates JSON-LD structured data for SEO.

### Props

The `Card` component receives the following props:

*   **`cards`**: An array of card data objects. Each object represents a language version of the card and contains data for `name`, `position`, `company`, `address`, `contact`, `favicon`, and `lang`.

### State

The `Card` component does not have its own state. It relies on props and DOM manipulation for interactivity.

### Functionality

*   **Data Rendering:**  The `Card` component iterates over the `cards` prop and renders a `CardSide` component for each language.
*   **Language Switching:**  It renders the `CardSwitch` component if there are multiple languages, enabling users to switch between language versions.
*   **JSON-LD Generation:**  It renders `CardJSONLD` components for each language to include structured data in the HTML.
*   **BEM Structure:**  The component uses a BEM-like structure for CSS class names (e.g., `card`, `card__side`, `card_modifier`).
*   **TODO:**  The component has a `// TODO: change data format` comment, indicating potential future refactoring of the data structure.

### Code Snippets

#### `Card` component render method:

```jsx
render() {
    const data = {
        card: {
            titles: {},
            favicons: {}
        }
    };

    this.props.cards.forEach(card => {
        data.card.titles[card.lang] = card.name;
        data.card.favicons[card.lang] = card.favicon;
    });

    return (
        <>
            <div
                className="card"
                data-bem={JSON.stringify(data)}
            >
                {this.props.cards.map((card, i) => <CardSide key={card.lang} {...card} index={i} />)}
            </div>
            {this.props.cards.map((card, i) => <CardJSONLD key={card.lang} {...card} index={i} />)}
            {this.props.cards.length > 1 && <CardSwitch langs={this.props.cards.map(c => c.lang)} />}
        </>
    );
}
```

#### `CardSide` component render method (simplified):

```jsx
render() {
    const { address, company, contact, lang, name, position, index } = this.props;
    return (
        <div className="card__side">
            <div className="card__content">
                <a className="card__logo" href={company.site}>{company.name}</a>
                <div className="card__text">
                    <h1 className="card__name">{name}</h1>
                    <div className="card__position">{position}</div>
                    <div className="card__address">...</div>
                    <div className="card__contact">...</div>
                </div>
            </div>
        </div>
    );
}
```

This document provides a detailed overview of the `Card` component's architecture and its role in the `ya-card` project.