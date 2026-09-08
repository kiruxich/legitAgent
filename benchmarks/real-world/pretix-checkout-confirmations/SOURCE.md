# pretix-checkout-confirmations

Adapted from **pretix/pretix** and its contributors at commit `edb4069e18d34eb80f290c00cd6eb74bbd499728`.

Upstream terms: [AGPL-3.0 with additional terms; mixed-license repository](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

The checked disabled checkbox displays a previously submitted boolean answer. New confirmations are required but unchecked; contact details are rendered as text, not editable contact fields. The full checkout form is kept. This is a pinned development-source regression, not a claim about a deployed release or jurisdiction.

## Source and modifications

- [checkout_confirm.html](checkout_confirm.html) ← [upstream file](https://github.com/pretix/pretix/blob/edb4069e18d34eb80f290c00cd6eb74bbd499728/src/pretix/presale/templates/pretixpresale/event/checkout_confirm.html). Source retained without content changes apart from the terminal newline.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
