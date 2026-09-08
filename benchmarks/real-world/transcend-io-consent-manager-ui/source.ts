          currentVariables,
        ),
      ),
    setPrivacyPolicy: (privacyPolicyLink) =>
      Promise.resolve(handleChangePrivacyPolicy(privacyPolicyLink)),
    setSecondaryPolicy: (privacyPolicyLink) =>
      Promise.resolve(handleChangeSecondaryPolicy(privacyPolicyLink)),
