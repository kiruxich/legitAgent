# supabase-consent-categories

Adapted from **supabase/supabase** and its contributors at commit `45199443c8e927f623f758399bdf52796adc6615`.

Upstream terms: [Apache-2.0](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

ConsentToast exposes an Opt out control, wired to denyAll in consent.tsx; the state adapter delegates to denyAllServices. Preferences/state sources are retained as context. SDK execution, category persistence and production/local environment behavior are not scored by this static case.

## Source and modifications

- [ConsentToast.tsx](ConsentToast.tsx) ← [upstream file](https://github.com/supabase/supabase/blob/45199443c8e927f623f758399bdf52796adc6615/packages/ui-patterns/src/ConsentToast/index.tsx). Replaced operational URLs, placeholder email and analytics identifiers; known tracker-provider hostname retained for provider classification. Exact original values remain only in upstream source.
- [consent.tsx](consent.tsx) ← [upstream file](https://github.com/supabase/supabase/blob/45199443c8e927f623f758399bdf52796adc6615/packages/ui-patterns/src/consent.tsx). Replaced operational URLs, placeholder email and analytics identifiers; known tracker-provider hostname retained for provider classification. Exact original values remain only in upstream source.
- [PrivacySettings.tsx](PrivacySettings.tsx) ← [upstream file](https://github.com/supabase/supabase/blob/45199443c8e927f623f758399bdf52796adc6615/packages/ui-patterns/src/PrivacySettings/index.tsx). Replaced operational URLs, placeholder email and analytics identifiers; known tracker-provider hostname retained for provider classification. Exact original values remain only in upstream source.
- [consent-state.ts](consent-state.ts) ← [upstream file](https://github.com/supabase/supabase/blob/45199443c8e927f623f758399bdf52796adc6615/packages/common/consent-state.ts). Source retained without content changes apart from the terminal newline.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
