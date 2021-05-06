/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 223:
/***/ ((module) => {

module.exports = {
  metrikaId: 0,
  cards: [{
    lang: 'ru',
    name: 'Иван Иванов',
    position: 'Разработчик интерфейсов',
    address: {
      country: 'Россия',
      city: 'Москва',
      zip: '119021',
      'street-address': 'ул. Льва Толстого, д. 16'
    },
    company: {
      name: 'Яндекс',
      site: 'https://yandex.ru'
    },
    contact: {
      work: '+7 495 739-70-00',
      workExt: '0000',
      cell: '+7 555 123-45-66',
      email: 'ivanivanovich@yandex-team.ru',
      site: 'https://ivanivanovich.ru',
      github: 'ivanivanovich',
      twitter: 'ivanivanovich',
      skype: 'ivanivanovich',
      telegram: 'ivanivanovich'
    },
    favicon: 'https://yastatic.net/s3/home-static/_/f0/f0597b6727cc67dceebc4e3a87caf571.png'
  }, {
    lang: 'en',
    name: 'Ivan Ivanov',
    position: 'UI Developer',
    address: {
      country: 'Russia',
      city: 'Moscow',
      zip: '119021',
      'street-address': '16, Leo Tolstoy St.'
    },
    company: {
      name: 'Yandex',
      site: 'https://yandex.com'
    },
    contact: {
      work: '+7 495 739-70-00',
      workExt: '000',
      cell: '+7 555 123-45-67',
      email: 'ivanivanovich@yandex-team.ru',
      site: 'https://ivanivanovich.ru/#en',
      skype: 'ivanivanovich',
      github: 'ivanivanovich',
      twitter: 'ivanivanovich',
      telegram: 'ivanivanovich'
    },
    favicon: 'https://yastatic.net/s3/home-static/_/7c/7ccfee6f1e81b14c5bef535d1ad7b7e0.png'
  }]
};

/***/ }),

/***/ 441:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(297);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }


var I18N = {
  ru: {
    tel: "тел.: ",
    telExt: ", доб. ",
    cell: "моб.: "
  },
  en: {
    tel: "tel. ",
    telExt: " ext. ",
    cell: "cell. "
  }
};

function CardLink(_ref) {
  var href = _ref.href,
      children = _ref.children,
      itemProp = _ref.itemProp;
  return /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("a", {
    href: href,
    itemProp: itemProp,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "card__link"
  }, children);
}

function CardSwitch(_ref2) {
  var langs = _ref2.langs;
  return /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
    className: "card__switch"
  }, langs.map(function (lang, i) {
    return /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("a", {
      className: "card__link ".concat(i === 0 ? 'card__link_disabled_yes' : ''),
      href: "#".concat(lang),
      "data-lang": lang,
      key: lang
    }, lang);
  }));
}

function rawNumber(strNumber) {
  return strNumber.replace(/\(|\)|\s|-/g, '');
}

var CardSide = /*#__PURE__*/function (_React$Component) {
  _inherits(CardSide, _React$Component);

  var _super = _createSuper(CardSide);

  function CardSide() {
    _classCallCheck(this, CardSide);

    return _super.apply(this, arguments);
  }

  _createClass(CardSide, [{
    key: "render",
    value: function render() {
      var _this$props = this.props,
          address = _this$props.address,
          company = _this$props.company,
          contact = _this$props.contact,
          lang = _this$props.lang,
          name = _this$props.name,
          position = _this$props.position,
          index = _this$props.index;
      return /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__side card__side_lang_".concat(lang, " card__side_state_").concat(index === 0 ? 'opened' : 'closed', " card__layout"),
        "data-lang": lang,
        itemScope: true,
        itemType: "http://data-vocabulary.org/Person"
      }, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__content card__rectangle"
      }, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("a", {
        className: "card__logo",
        target: "_blank",
        rel: "noopener noreferrer",
        href: company.site
      }, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        itemProp: "affiliation"
      }, company.name)), /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__text"
      }, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__title"
      }, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("h1", {
        className: "card__name",
        itemProp: "name"
      }, name), /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__position",
        itemProp: "title"
      }, position)), /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__address",
        itemProp: "address",
        itemScope: true,
        itemType: "http://data-vocabulary.org/Address"
      }, lang === 'ru' && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement((react__WEBPACK_IMPORTED_MODULE_0___default().Fragment), null, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        className: "card__country",
        itemProp: "country-name"
      }, address.country), ",", ' ', /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        className: "card__city",
        itemProp: "locality"
      }, address.city), ",", ' ', /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        className: "card__zip",
        itemProp: "postal-code"
      }, address.zip), /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("br", null), /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        className: "card__street-address",
        itemProp: "street-address"
      }, address['street-address'])), lang === 'en' && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement((react__WEBPACK_IMPORTED_MODULE_0___default().Fragment), null, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        className: "card__street-address",
        itemProp: "street-address"
      }, address['street-address']), /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("br", null), /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        className: "card__city",
        itemProp: "locality"
      }, address.city), ",", ' ', /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        className: "card__zip",
        itemProp: "postal-code"
      }, address.zip), ",", ' ', /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        className: "card__country",
        itemProp: "country-name"
      }, address.country))), /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__contact"
      }, contact.work && !contact.workExt && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__tel card__tel_type_work"
      }, I18N[lang].tel, " ", /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("a", {
        className: "card__phone-link",
        href: "tel:".concat(rawNumber(contact.work))
      }, contact.work)), contact.work && contact.workExt && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__tel card__tel_type_work"
      }, I18N[lang].tel, " ", /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("a", {
        className: "card__phone-link",
        href: "tel:".concat(rawNumber(contact.work), ",").concat(contact.workExt)
      }, contact.work), ", ", I18N[lang].ext, " ", contact.workExt), contact.cell && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__tel card__tel_type_cell"
      }, I18N[lang].cell, " ", /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("a", {
        className: "card__phone-link",
        href: "tel:".concat(rawNumber(contact.cell))
      }, contact.cell)), (contact.work || contact.cell) && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__gap"
      }), contact.email && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__email"
      }, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement(CardLink, {
        href: "mailto:".concat(contact.email)
      }, contact.email)), contact.site && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__site"
      }, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement(CardLink, {
        href: contact.site,
        itemProp: "url"
      }, contact.site)), (contact.email || contact.site) && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__gap"
      }), contact.telegram && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__telegram"
      }, "telegram: ", /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement(CardLink, {
        href: "https://t.me/".concat(contact.telegram)
      }, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("span", {
        itemProp: "nickname"
      }, contact.telegram))), contact.github && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card__github"
      }, /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement(CardLink, {
        href: "https://github.com/".concat(contact.github)
      }, "github.com/", contact.github))))));
    }
  }]);

  return CardSide;
}((react__WEBPACK_IMPORTED_MODULE_0___default().Component));

var Card = /*#__PURE__*/function (_React$Component2) {
  _inherits(Card, _React$Component2);

  var _super2 = _createSuper(Card);

  function Card() {
    _classCallCheck(this, Card);

    return _super2.apply(this, arguments);
  }

  _createClass(Card, [{
    key: "render",
    value: function render() {
      // TODO: change data format
      var data = {
        card: {
          titles: {},
          favicons: {}
        }
      };
      this.props.cards.forEach(function (card) {
        data.card.titles[card.lang] = card.name;
        data.card.favicons[card.lang] = card.favicon;
      });
      return /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement("div", {
        className: "card",
        "data-bem": JSON.stringify(data)
      }, this.props.cards.map(function (card, i) {
        return /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement(CardSide, _extends({
          key: card.lang
        }, card, {
          index: i
        }));
      }), this.props.cards.length > 1 && /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement(CardSwitch, {
        langs: this.props.cards.map(function (c) {
          return c.lang;
        })
      }));
    }
  }]);

  return Card;
}((react__WEBPACK_IMPORTED_MODULE_0___default().Component));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Card);

/***/ }),

/***/ 297:
/***/ ((module) => {

"use strict";
module.exports = require("react");;

/***/ }),

/***/ 747:
/***/ ((module) => {

"use strict";
module.exports = require("react-dom/server");;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "render": () => (/* binding */ render)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(297);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_dom_server__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(747);
/* harmony import */ var react_dom_server__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react_dom_server__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _Card_Card_jsx__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(441);
/* harmony import */ var _data_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(223);
/* harmony import */ var _data_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_data_js__WEBPACK_IMPORTED_MODULE_3__);




function render() {
  return react_dom_server__WEBPACK_IMPORTED_MODULE_1___default().renderToStaticMarkup( /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().createElement(_Card_Card_jsx__WEBPACK_IMPORTED_MODULE_2__/* .default */ .Z, (_data_js__WEBPACK_IMPORTED_MODULE_3___default())));
}
})();

module.exports = __webpack_exports__;
/******/ })()
;