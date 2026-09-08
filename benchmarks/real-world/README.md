# Imported real-world source fixtures

All 12 source groups are registered in [corpus.json](../corpus.json) and run by `pnpm benchmark`. They add 12 seeds (60 formatting scenarios) to the 40 synthetic seeds, for **52 seeds / 260 scenarios** in total.

Each directory contains static source fixtures, the upstream license in `LICENSE.upstream`, attribution and transformation notes in `SOURCE.md`, and pinned source/fixture hashes with scoped review rationale and labels in `provenance.json`. The fixture sources retain their upstream licenses, independently of the scanner's MIT license. They are test data and are not compiled into or distributed with the scanner packages.

Operational URLs, placeholder email and analytics identifiers have been replaced with reserved test values. Known tracker-provider hostnames remain when necessary to preserve provider classification. No original application or external dependency is executed by the source benchmark.

The benchmark and release checks verify provenance, labels and hashes. A modified fixture requires another source/label review and refreshed provenance. A repeated view or mutation cannot increase the source-group count. All imported cases are strict: aggregate accuracy thresholds cannot hide a failed labeled assertion.

The [coverage report](../real-world-cases.md) describes what each case tests. Static annotations do not establish legal compliance or verify CMP behavior in a running browser. These are development regressions; they are not an unseen evaluation set.
