import isPlainObject from 'lodash/isPlainObject'
import CookieConsent from 'react-cookie-consent'
import CustomChartLoader from './components/CustomChartLoader'
    fetch(projectUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(r)))
      .then(
