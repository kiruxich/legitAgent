# opentdf-consent-config

Adapted from **opentdf/docs** and its contributors at commit `af7de4e687326328330935470932d05074778e38`.

Upstream terms: [CC-BY-4.0](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

The head configuration contains a Google Tag Manager provider URL. The separately extracted literal consent-default script contains consent and set commands, not page-view/event calls. Its negative label does not claim that the GTM loader or full website makes no requests.

## Source and modifications

- [consent-default.js](consent-default.js) ← [upstream file](https://github.com/opentdf/docs/blob/af7de4e687326328330935470932d05074778e38/docusaurus.config.ts). Extracted original lines 52-65; unrelated page sections omitted.
- [head-config.ts](head-config.ts) ← [upstream file](https://github.com/opentdf/docs/blob/af7de4e687326328330935470932d05074778e38/docusaurus.config.ts). Extracted original lines 47-72; unrelated page sections omitted. Wrapped the two original headTags entries in a minimal config; supplied an inert test GTM identifier.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
