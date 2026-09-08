# keto-regional-consent

Adapted from **martinus/keto-calculator** and its contributors at commit `fa035a5778744f226b96f770cd383703aef02ef2`.

Upstream terms: [CC-BY-SA-3.0](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

The extracted initialization loads a Google provider and contains one config call after consent/default, set and js setup commands. Only provider presence and call classification are labeled; regional consent compliance and network behavior remain unassessed.

## Source and modifications

- [analytics.html](analytics.html) ← [upstream file](https://github.com/martinus/keto-calculator/blob/fa035a5778744f226b96f770cd383703aef02ef2/index.html). Extracted original lines 13-42; unrelated page sections omitted. Replaced operational URLs, placeholder email and analytics identifiers; known tracker-provider hostname retained for provider classification. Exact original values remain only in upstream source.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
