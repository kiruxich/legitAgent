const cheerio = require('cheerio');
const Promise = require('bluebird');

const CookieConsent = () => {
    const route = hexo.route;
    const routeList = route.list();
    const routes = routeList.filter(hpath => hpath.endsWith('.html'));
