 * @property {string}        [config.sscDomain]                              - Domain against which the Server Side Cookie is set. Default: `window.location.hostname`
 * @property {string}        [config.sscServer]                              - hostname to request server side cookie from. Default: `ssc.${sscDomain}`
 * @property {string}        [config.cdpHost]                                - The host to use for the Personalization API. Default: 'cdp.in.treasuredata.com'
  ServerSideCookie: require('./plugins/servercookie'),
  ConsentManager: require('./plugins/consent-manager'),
  ConversionAPI: require('./plugins/conversion_api_support'),
