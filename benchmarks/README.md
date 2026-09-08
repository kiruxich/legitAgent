# Benchmark corpus

`corpus.json` currently contains synthetic regression seeds. The runner applies five semantics-preserving formatting mutations, reports TP/FP/FN/TN plus precision/recall by rule and framework, and enforces the thresholds stored in the manifest.

Mutations test parser stability but are not independent examples. Before the v1 release, add reviewed real-world seeds until every release-critical rule has enough genuinely independent positive and negative labels. Never commit personal data, credentials, proprietary source, domains, names, email addresses, analytics IDs, or free-form user content.

`pnpm release:check` refuses any `1.x` release while fewer than `v1MinimumIndependentCases` entries have `"provenance": "independent-real-world"`. Use that marker only for separately sourced, anonymized and manually reviewed cases; generated mutations do not count.

The release check enforces the 100-case count mechanically. Rule-level positive/negative coverage and the benchmark thresholds still require maintainer review; a case count alone is not evidence that every rule generalizes.

Each case points to a directory and labels only the rules listed in `rules`; omitted rules are not scored for that case. A positive label means that at least one finding with that rule id is expected.
