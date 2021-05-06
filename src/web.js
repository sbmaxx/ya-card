import React from 'react';
import ReactDom from 'react-dom';

import CardReact from './Card/Card.jsx';

import './Card/Card.css';
import './Card/Card.inline.js';
import './Page/js_detection.inline.js';
import './Page/mobile_detection.inline.js';

import Data from '../data.js';

ReactDom.render(<CardReact {...Data}/>, document.getElementById('root'));
