// privacyBanner.js
async function handlePrivacyBanner(page) {
    const privacyButtonSelector = '#qc-cmp2-ui > div.qc-cmp2-footer.qc-cmp2-footer-overlay.qc-cmp2-footer-scrolled > div > button.css-47sehv';
  
    try {
      await page.waitForSelector(privacyButtonSelector, { timeout: 5000 });
      await page.click(privacyButtonSelector);
