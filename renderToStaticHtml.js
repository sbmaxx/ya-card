const fs = require('fs');
const template = fs.readFileSync('./dist/template.html', 'utf8');
const app = require('./dist/node.js');
fs.writeFileSync('./dist/index.html', template.replace('<div id="root"></div>', app.render()), 'utf8');
