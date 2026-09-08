# hoppscotch-email-login

Adapted from **hoppscotch/hoppscotch** and its contributors at commit `ac145e7f758151b41fd46d3e5f513886ce9068ba`.

Upstream terms: [MIT](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

The email-mode form uses HoppSmartInput type=email and has no checkbox. The policy link is conditional in a different sign-in-mode footer, so it is not labeled as present inside the email form. No legal label is assigned to login.

## Source and modifications

- [Login.vue](Login.vue) ← [upstream file](https://github.com/hoppscotch/hoppscotch/blob/ac145e7f758151b41fd46d3e5f513886ce9068ba/packages/hoppscotch-common/src/components/firebase/Login.vue). Replaced operational URLs, placeholder email and analytics identifiers; known tracker-provider hostname retained for provider classification. Exact original values remain only in upstream source.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
