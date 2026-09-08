# gta-inert-analytics

Adapted from **smtchahal/gta-snap-to-jpg** and its contributors at commit `585d9642d851bebbb2026cb398308f0adb5c2365`.

Upstream terms: [MIT](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

Both analytics blocks are text/plain, so their inline commands are not executable in initial HTML. The included CMP configuration offers Reject all. Labels apply to static initial markup and available controls only, not subsequent CMP activation or revocation.

## Source and modifications

- [analytics.html](analytics.html) ← [upstream file](https://github.com/smtchahal/gta-snap-to-jpg/blob/585d9642d851bebbb2026cb398308f0adb5c2365/index.html). Extracted original lines 11-17; unrelated page sections omitted. Replaced operational URLs, placeholder email and analytics identifiers; known tracker-provider hostname retained for provider classification. Exact original values remain only in upstream source.
- [CookieConsent.tsx](CookieConsent.tsx) ← [upstream file](https://github.com/smtchahal/gta-snap-to-jpg/blob/585d9642d851bebbb2026cb398308f0adb5c2365/src/components/CookieConsent.tsx). Source retained without content changes apart from the terminal newline.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
