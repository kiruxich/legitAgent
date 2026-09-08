
class CookieConsentManager {
    constructor() {
        if (cookieConsentManager) {
            cookieConsentManager.revokeConsent();
        }
