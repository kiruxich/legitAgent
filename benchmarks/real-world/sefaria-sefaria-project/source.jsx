    if (!this.state.showNotification) { return null; }
    const privacyPolicyLink = Sefaria.util.fullURL("/privacy-policy", Sefaria.LIBRARY_MODULE);
    return (
            <span>אנחנו משתמשים ב"עוגיות" כדי לתת למשתמשים את חוויית השימוש הטובה ביותר.
              <a href={privacyPolicyLink} data-target-module={Sefaria.LIBRARY_MODULE}>קראו עוד בנושא</a>
            </span>
