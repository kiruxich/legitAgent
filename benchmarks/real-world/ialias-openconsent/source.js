   * @param {string} version - Policy version
   * @returns {void}
   */
  rejectAll(version) {
    this.setConsent(
      {
        necessary: true,
