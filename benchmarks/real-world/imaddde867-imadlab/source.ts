  setConsent({ analytics: true, marketing: true, functional: true });
}

export function rejectAll() {
  // Only keep functional cookies, reject analytics and marketing
  setConsent({ analytics: false, marketing: false, functional: true });
}
