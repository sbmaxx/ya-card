(function (e, c) {
    e[c] = e[c].replace(/(ua_js_)no/g, '$1yes');
    /Android|iPhone/i.test(navigator.userAgent) && (e[c] += ' mobile');
})(document.documentElement, 'className');
