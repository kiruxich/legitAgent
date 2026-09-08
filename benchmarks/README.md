# Benchmark corpus

`corpus.json` contains 140 seeds: 40 synthetic regressions and 100 imported real-world source cases. The runner applies five formatting variants (including the original), reports TP/FP/FN/TN plus precision/recall by rule and framework, and enforces the thresholds stored in the manifest. `seedRules` and `seedFrameworks` count each original case once; `rules` and `frameworks` include the 700 expanded cases. Positive and negative seed coverage is checked before mutations, so repeating formats cannot substitute for a missing kind of example.

Mutations test parser stability but are not independent examples. Before the v1 release, add reviewed real-world seeds until every release-critical rule has enough genuinely independent positive and negative labels. Remove personal data, credentials, operational site URLs, contact addresses, analytics IDs and free-form user content from fixtures. Preserve upstream copyright/license notices and public source attribution separately. Known tracker-provider hostnames are retained where provider classification is the feature under test.

`pnpm release:check` refuses any `1.x` release while fewer than `v1MinimumIndependentCases` reviewed source groups have `"provenance": "independent-real-world"`. Use that marker only for separately sourced, anonymized cases with reviewed source-based labels; generated mutations do not count.

The release check enforces the 100-source-group count mechanically and verifies fixture/license hashes and reviewed labels. Rule-level positive/negative coverage and the benchmark thresholds still require maintainer review; a case count alone is not evidence that every rule generalizes.

Each case points to a directory and labels only the rules listed in `rules`; omitted rules are not scored for that case. A positive label means that at least one finding with that rule id is expected. New real-world cases use `strict: true`: any labeled mismatch fails the run regardless of aggregate thresholds. `checks` assert exact form/tracker counts, selected evidence properties and optional file-scoped rule labels. These prevent an empty parser result from passing all negative labels.

The real-world labels are technical source annotations, not independent legal audits. Login, registration and checkout cases score field/control recognition without assuming a missing checkbox is unlawful. The source fixtures are parsed as data; their original applications and dependencies are not executed. `pnpm test` also runs semantic regression variants and tests the provenance/counting checks.

## Choosing new examples

The [real-world source shortlist](real-world-cases.md) and [pinned candidate registry](real-world-candidates.json) document 100 imported cases, their licenses, scoped technical observations and remaining runtime limits. Files live in `benchmarks/real-world/<id>` with upstream license, attribution, source/fixture hashes and review rationale. Twelve cases preserve richer component/runtime context; 88 additions are pinned source-excerpt controls with exact markers and structural checks. They contribute 100 source groups to the release gate; multiple views and mutations of a group count once.

Prioritize new behavior over more formatting variants:

- Add an ordinary search/filter form alongside each personal-data form, to measure false positives as well as missed findings.
- Exercise granted, denied and unknown consent states, both branches, and calls before/after a guard across HTML, Vue, Svelte, Astro and JS/TS.
- Include Cyrillic labels/requisites, first-party paths with tracker-like names, and lookalike domain names.
- Keep loader errors, CLI output size, browser interactions and PDF rendering in integration tests: this source benchmark cannot validate them.

The 20 cases under `benchmarks/fixtures` are synthetic regressions derived from code review. They are not independent real-world observations and remain labeled `synthetic-regression`.

For real-world additions, record the framework, rule labels, anonymized provenance and manual review rationale. Use cases from independently sourced implementations, include both positive and negative examples per rule, and reserve a separate held-out set that is not used to tune detectors. Review whether each mutation preserves the label; whitespace inside a string or template can change behavior. Increase the mutation count only when adding a distinct parser condition, not to increase the apparent sample size.
