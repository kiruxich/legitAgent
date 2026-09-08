    VisitTracker.init();
  },

  reject() {
    this.setCookie('cookieConsent', 'rejected', 365);
    this.hideBanner();
    localStorage.clear();
