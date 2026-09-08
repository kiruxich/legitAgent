            this.saveConsent(consent, 'accept_all');
        },
        
        rejectAll: function() {
            var consent = { necessary: true };
            
            this.announce('All optional cookies rejected. Only necessary cookies will be used.');
