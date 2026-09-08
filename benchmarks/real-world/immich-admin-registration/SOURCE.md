# immich-admin-registration

Adapted from **immich-app/immich** and its contributors at commit `4f503c4b6b7d35ad8c620c6a5ee734eeed357732`.

Upstream terms: [AGPL-3.0](LICENSE.upstream). These third-party fixture files retain their upstream license; they are not relicensed under the scanner's license. Changes to the fixture are provided under those same terms.

## Reviewed expectation

The admin registration form exposes email/name inputs and no consent control. This checks field recognition and absence of prechecked consent only; no legal conclusion about the basis for account creation.

## Source and modifications

- [Register.svelte](Register.svelte) ← [upstream file](https://github.com/immich-app/immich/blob/4f503c4b6b7d35ad8c620c6a5ee734eeed357732/web/src/routes/auth/register/+page.svelte). Source retained without content changes apart from the terminal newline.

Source and fixture hashes, line selections and license provenance are in [provenance.json](provenance.json). Imported on 2026-09-08.

These files are parsed as test data; the original application, its external dependencies, live URLs and consent lifecycle are not executed. Source-derived views and mutations belong to one independence group.
