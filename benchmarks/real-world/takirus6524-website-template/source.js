        this.saveConsent(preferences);
    }

    rejectAll() {
        const preferences = {};
        Object.keys(this.categories).forEach(category => {
            preferences[category] = this.categories[category].required;
