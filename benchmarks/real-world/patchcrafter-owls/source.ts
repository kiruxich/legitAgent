    return By.css('a.firebaseui-pp-link')
  }

  get privacyPolicyLink() {
    return this._driver.findElement(this.byPrivacyPolicyLink)
  }
