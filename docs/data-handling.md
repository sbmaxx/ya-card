# Data Handling Architecture

This document describes how data is handled in the `ya-card` project.

## Data Source: `data.js`

The primary source of data for the business card is the `data.js` file located in the project root directory.

*   **JavaScript File:** `data.js` is a JavaScript file that exports a data object.
*   **Card Data:**  This data object contains information for the business card, such as:
    *   Personal details (name, position)
    *   Company information (name, site)
    *   Contact details (phone numbers, email, website, social media)
    *   Address
    *   Language-specific content
    *   Favicons

## Data Structure

The `data.js` file exports an object that is structured to be passed as props to the `Card` component.

*   **`cards` Array:** The main data structure is an array named `cards`.
*   **Language-Specific Objects:** Each element in the `cards` array is an object representing a language version of the business card.
*   **Data Properties:** Each card object typically contains properties like:
    *   `lang`: Language code (e.g., 'ru', 'en').
    *   `name`: Person's name.
    *   `position`: Person's job title/position.
    *   `company`: An object containing company name and website.
    *   `address`: An object containing address details (street, city, zip, country).
    *   `contact`: An object containing contact information (work phone, cell phone, email, website, social media links).
    *   `favicon`: URL for the favicon.

### Example Data Structure (Conceptual):

```javascript
export default {
  cards: [
    {
      lang: 'en',
      name: 'John Doe',
      position: 'Software Engineer',
      company: {
        name: 'Example Corp',
        site: 'https://example.com'
      },
      address: {
        'street-address': '123 Main St',
        city: 'Anytown',
        zip: '12345',
        country: 'USA'
      },
      contact: {
        work: '+1-555-123-4567',
        cell: '+1-555-987-6543',
        email: 'john.doe@example.com',
        site: 'https://johndoe.com',
        telegram: 'johndoe_telegram',
        github: 'johndoe_github'
      },
      favicon: '/favicon-en.ico'
    },
    {
      lang: 'ru',
      name: 'Иван Петров',
      position: 'Инженер-программист',
      company: {
        name: 'Пример ООО',
        site: 'https://example.ru'
      },
      address: {
        'street-address': 'ул. Главная, д. 1',
        city: 'Москва',
        zip: '101000',
        country: 'Россия'
      },
      contact: {
        work: '+7-495-123-4567',
        cell: '+7-916-987-6543',
        email: 'ivan.petrov@example.ru',
        site: 'https://ivanpetrov.ru',
        telegram: 'ivanpetrov_telegram',
        github: 'ivanpetrov_github'
      },
      favicon: '/favicon-ru.ico'
    }
  ]
};
```

## Data Flow

1.  **`data.js`**:  Exports the data object.
2.  **Webpack Build**: The `data.js` file is required in `webpack.common.js` and its data is passed to `HtmlWebpackPlugin`.
3.  **HTML Template (`src/template.html`)**: The data is accessible in `src/template.html` via `htmlWebpackPlugin.options`. It's used to dynamically set meta tags (title, description).
4.  **`src/web.js` & `src/node.js`**:  `data.js` is imported in these entry points.
5.  **`Card` Component**: The data object (from `data.js`) is passed as props to the `Card` component in `src/web.js` and `src/node.js`.
6.  **Component Rendering**: The `Card` component and its sub-components use the data from props to render the business card content.

## `postinstall` Script

The `package.json` includes a `postinstall` script: `"postinstall": "cp example.js data.js"`.

*   **Purpose**:  This script copies `example.js` to `data.js` after `npm install`.
*   **Initialization**:  It provides a default `data.js` file with example data when the project is initially set up.
*   **User Customization**: Users are expected to modify `data.js` to replace the example data with their own information.

This document describes the data handling architecture in the `ya-card` project, focusing on the `data.js` file structure, data flow, and the `postinstall` script for data initialization.