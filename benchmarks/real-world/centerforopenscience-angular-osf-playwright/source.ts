    return this.identity.getByRole('link', { name: 'Terms of Use', exact: true });
  }

  get privacyPolicyLink(): Locator {
    return this.identity.getByRole('link', { name: 'Privacy Policy', exact: true });
  }
