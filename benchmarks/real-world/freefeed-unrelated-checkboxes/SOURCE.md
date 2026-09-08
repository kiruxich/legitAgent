# freefeed-unrelated-checkboxes

Adapted from **FreeFeed/freefeed-react-client** and its contributors at commit `ce74224c64c20eb90be3685d6344758b7e54e8c3`.

Upstream terms: [MIT](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

The checked default subscribes to recommended users/groups, not data-processing consent. The cookie warning describes disabled browser cookies, not a consent banner. The signup/invitation context is kept; no legal basis for registration is inferred.

## Source and modifications

- [signup-form.jsx](signup-form.jsx) ← [upstream file](https://github.com/FreeFeed/freefeed-react-client/blob/ce74224c64c20eb90be3685d6344758b7e54e8c3/src/components/signup-form.jsx). Source retained without content changes apart from the terminal newline.
- [signup-by-invitation.jsx](signup-by-invitation.jsx) ← [upstream file](https://github.com/FreeFeed/freefeed-react-client/blob/ce74224c64c20eb90be3685d6344758b7e54e8c3/src/components/signup-by-invitation.jsx). Replaced operational URLs, placeholder email and analytics identifiers; known tracker-provider hostname retained for provider classification. Exact original values remain only in upstream source.
- [cookies-warning.jsx](cookies-warning.jsx) ← [upstream file](https://github.com/FreeFeed/freefeed-react-client/blob/ce74224c64c20eb90be3685d6344758b7e54e8c3/src/components/cookies-warning.jsx). Source retained without content changes apart from the terminal newline.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
