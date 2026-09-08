    /** Accept all cookies */
    acceptAll: () => manager.acceptAll(),
    /** Reject all non-essential cookies */
    rejectAll: () => manager.rejectAll(),
    /** Save custom preferences */
    savePreferences: (categories: Parameters<typeof manager.savePreferences>[0]) =>
      manager.savePreferences(categories),
