  const privacyPolicyLabel = L.DomUtil.create("label", "", privacyPolicyContainer);
  privacyPolicyLabel.innerText = "Legal";
  privacyPolicyLabel.style.color = "var(--text-color)";
  const privacyPolicyLink = L.DomUtil.create("a", "", privacyPolicyContainer);
  privacyPolicyLink.href = "/privacy.html";
  privacyPolicyLink.target = "_blank";
  privacyPolicyLink.innerText = "View Privacy Policy";
