import React from 'react';
import ReactDom from 'react-dom';

import CardReact from './Card/Card.jsx';
import './Card/Card.css';

import Data from '../data.js';

import './inline.js';

ReactDom.render(<CardReact {...Data}/>, document.getElementById('root'));
