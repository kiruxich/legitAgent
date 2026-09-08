# vas3k-join

Adapted from **vas3k/vas3k.club** and its contributors at commit `86126cdc4db7566bf0f9bab44e3657c34ddaed93`.

Upstream terms: [MIT](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

The extracted form has an email control, an unchecked required consent checkbox and a Django URL tag explicitly naming privacy_policy. Only these form rules are scored; includes and URL resolution are not executed.

## Source and modifications

- [join.html](join.html) ← [upstream file](https://github.com/vas3k/vas3k.club/blob/86126cdc4db7566bf0f9bab44e3657c34ddaed93/frontend/html/auth/join.html). Extracted original lines 15-33; unrelated page sections omitted. Replaced operational URLs, placeholder email and analytics identifiers; known tracker-provider hostname retained for provider classification. Exact original values remain only in upstream source.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
