import React from 'react';
import ReactDOMServer from 'react-dom/server';

import CardReact from './Card/Card.jsx';

import Data from '../data.js';

export function render() {
    return ReactDOMServer.renderToStaticMarkup(<CardReact {...Data}/>);
};
