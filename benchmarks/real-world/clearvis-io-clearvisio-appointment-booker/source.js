export function privacy (store) {
  store.on('@init', () => ({ privacyPolicy: null, privacyPolicyLink: null, medicalConsent: 'explicit' }));

  store.on('privacyPolicy/set', (previousValue, privacyPolicy) => ({privacyPolicy}));
  store.on('privacyPolicyLink/set', (previousValue, privacyPolicyLink) => ({privacyPolicyLink}));
  store.on('medicalConsent/set', (previousValue, medicalConsent) => ({ medicalConsent }));
