# ya-card

![ya-card example](https://raw.githubusercontent.com/sbmaxx/ya-card/main/vcard-horizontal.png)
![ya-card example](https://raw.githubusercontent.com/sbmaxx/ya-card/main/vcard-vertical.png)

Визитная карточка <s>по БЭМ</s> как продолжение проекта [bem-vcard-enb](https://github.com/bem-vcard-enb)
* react
* webpack
* магия
* заинлайненные SVG-логотипы для поддержки Retina;
* заинлайненная статика (JS, CSS);
* plain javascript на клиенте;
* нет внешних запросов;
* корректная поддержка различных разрешений на мобильных устройствах;
* поддержка [Person microdata](http://www.data-vocabulary.org/Person).

## Development
```bash
git clone https://github.com/sbmaxx/ya-card.git
cd ya-card
npm install
npm start
```
Свои данные изменять в `data.js` в корне проекта.

## Production
```bash
npm run build && npm run cleanup
```

После этого положить `dist/index.html` на любой сервер.
