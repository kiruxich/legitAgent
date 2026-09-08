        /**
         * Reject all non-necessary cookies
         */
        rejectAll: function() {
            this.saveConsent({
                necessary: true,
                preferences: false,
