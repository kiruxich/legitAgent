# memos-search

Adapted from **usememos/memos** and its contributors at commit `d3d0b35231d557feac5d32a018f153405e496564`.

Upstream terms: [MIT](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

The form updates a note-search query, not named contact data. Its Input implementation and field props are preserved. No project-wide policy label is assigned.

## Source and modifications

- [QuickFindDialog.tsx](QuickFindDialog.tsx) ← [upstream file](https://github.com/usememos/memos/blob/d3d0b35231d557feac5d32a018f153405e496564/web/src/components/AppSidebar/QuickFindDialog.tsx). Replaced operational URLs, placeholder email and analytics identifiers; known tracker-provider hostname retained for provider classification. Exact original values remain only in upstream source.
- [input.tsx](input.tsx) ← [upstream file](https://github.com/usememos/memos/blob/d3d0b35231d557feac5d32a018f153405e496564/web/src/components/ui/input.tsx). Source retained without content changes apart from the terminal newline.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
