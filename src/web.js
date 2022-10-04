import React from 'react';
import ReactDom from 'react-dom';

import CardReact from './Card/Card.jsx';

import './Page/Page.css';
import './Card/Card.css';
import './Card/Card.inline.js';
import './Page/Page.inline.js';

import Data from '../data.js';

ReactDom.render(<CardReact {...Data}/>, document.getElementById('root'));
