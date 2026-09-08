# payload-consent-actions

Adapted from **payloadcms/website** and its contributors at commit `b1aaaaf76e7ec52984ef39a6075771c9067d866f`.

Upstream terms: [MIT](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

The banner has a Dismiss control explicitly calling updateCookieConsent(false), and a separate Accept control passing true. The provider and analytics components are included for source context. This is a static rejection-control label, not a test of region lookup, timers, persistence or analytics lifecycle.

## Source and modifications

- [PrivacyBanner.tsx](PrivacyBanner.tsx) ← [upstream file](https://github.com/payloadcms/website/blob/b1aaaaf76e7ec52984ef39a6075771c9067d866f/src/components/PrivacyBanner/index.tsx). Source retained without content changes apart from the terminal newline.
- [PrivacyProvider.tsx](PrivacyProvider.tsx) ← [upstream file](https://github.com/payloadcms/website/blob/b1aaaaf76e7ec52984ef39a6075771c9067d866f/src/providers/Privacy/index.tsx). Source retained without content changes apart from the terminal newline.
- [GoogleAnalytics.tsx](GoogleAnalytics.tsx) ← [upstream file](https://github.com/payloadcms/website/blob/b1aaaaf76e7ec52984ef39a6075771c9067d866f/src/components/Analytics/GoogleAnalytics/index.tsx). Source retained without content changes apart from the terminal newline.
- [GoogleTagManager.tsx](GoogleTagManager.tsx) ← [upstream file](https://github.com/payloadcms/website/blob/b1aaaaf76e7ec52984ef39a6075771c9067d866f/src/components/Analytics/GoogleTagManager/index.tsx). Source retained without content changes apart from the terminal newline.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
