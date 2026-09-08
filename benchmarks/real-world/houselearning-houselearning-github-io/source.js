            var c = { analytics: true, marketing: true, accepted: true, savedAt: new Date().toISOString() };
            saveConsent(c); hideBanner();
        },
        rejectAll: function () {
            var c = { analytics: false, marketing: false, accepted: false, savedAt: new Date().toISOString() };
            saveConsent(c); hideBanner();
        }
