
const privacyPolicyLink = 'https://example.invalid';
const termsOfUseLink = 'https://example.invalid';
  const openPrivacyPolicy = () => {
    const localExtract = isLocalUrl(privacyPolicyLink);
    if (localExtract) {
