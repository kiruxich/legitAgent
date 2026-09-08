     */
    this.setSessionAttribute = function(key, value) {
        const skipQueue =
            self._CookieConsentManager?.getNoFunctional() &&
            !hasExplicitIdentifier(self._Store);

        if (!skipQueue) {
