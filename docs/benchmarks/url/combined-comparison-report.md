# Combined URL Provider Comparison Report

This report is generated exclusively from the committed `manifest.json` and `provider-comparison-report.json` artifacts. It does not rerun URL extraction providers or regenerate consensus extractions.

## Source Inventory

- Root directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/url`
- Runs: 7
- Distinct providers: 6 (1 local, 5 service)
- Provider result rows: 37
- Automated quality score rows: 37
- Human quality score rows: 0

| Run | Article | Source URL | Providers | Best local quality | Best service quality | Cheapest service | Fastest service |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| `2026-05-21_09-38-31-367_anthony-campolos-home-page` | [Anthony Campolo's Home Page](<https://ajcwebdev.com/>) | <https://ajcwebdev.com/> | 1 local / 5 service | `defuddle` (97.17) | `firecrawl` (97.35) | `firecrawl` ($0.0008) | `firecrawl` (0.95s) |
| `2026-05-21_09-38-58-898_autogenerate-show-notes-with-whisper-cpp-llama-cpp-and-node-js` | [Autogenerate Show Notes with Whisper-cpp, Llama-cpp, and Node-js](<https://ajcwebdev.com/autogen-shownotes/>) | <https://ajcwebdev.com/autogen-shownotes/> | 1 local / 5 service | `defuddle` (99.40) | `spider` (93.09) | `firecrawl` ($0.0008) | `firecrawl` (1.81s) |
| `2026-07-18_01-28-32-062_promise-javascript-mdn` | [Promise - JavaScript &#124; MDN](<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise>) | <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise> | 0 local / 5 service | n/a | `spider` (98.30) | `firecrawl` ($0.0008) | `firecrawl` (0.93s) |
| `2026-07-18_01-28-41-200_apollo-11-wikipedia` | [Apollo 11 - Wikipedia](<https://en.wikipedia.org/wiki/Apollo_11>) | <https://en.wikipedia.org/wiki/Apollo_11> | 0 local / 5 service | n/a | `spider` (69.40) | `firecrawl` ($0.0008) | `firecrawl` (0.92s) |
| `2026-07-18_01-28-50-262_rfc-9110-http-semantics` | [RFC 9110: HTTP Semantics](<https://www.rfc-editor.org/rfc/rfc9110.html>) | <https://www.rfc-editor.org/rfc/rfc9110.html> | 0 local / 5 service | n/a | `firecrawl` (99.83) | `firecrawl` ($0.0008) | `firecrawl` (1.05s) |
| `2026-07-18_01-28-55-132_pride-and-prejudice-project-gutenberg` | [Pride and prejudice &#124; Project Gutenberg](<https://www.gutenberg.org/files/1342/1342-h/1342-h.htm>) | <https://www.gutenberg.org/files/1342/1342-h/1342-h.htm> | 0 local / 5 service | n/a | `zyte` (99.78) | `firecrawl` ($0.0008) | `spider` (2.65s) |
| `2026-07-18_01-29-01-024_thinking-in-react-react` | [Thinking in React – React](<https://react.dev/learn/thinking-in-react>) | <https://react.dev/learn/thinking-in-react> | 0 local / 5 service | n/a | `spider` (93.61) | `firecrawl` ($0.0008) | `firecrawl` (0.54s) |

## Method

- Providers are matched by `providerKey` within `local` or `service`; groups are collected and ranked independently.
- Automated quality is the unweighted mean of present source `rankingSurfaces.*.automatedQuality.value` values. It is not recomputed from WER, CER, or coverage.
- WER, CER, content coverage, processing time, and cost are supporting unweighted means over present provider-row values. Source cents are converted to USD for price display and ranking; local monetary cost is always zero.
- Automated quality ranks descending, then speed ascending, then provider key. Speed ranks ascending, then quality descending, then provider key. Price ranks ascending, then quality descending, speed ascending, then provider key. Missing values sort last.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Coverage | Avg automated quality | Avg WER | Avg CER | Avg content coverage | Avg speed | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>defuddle</code> | $0.0000 | 2/7 | 98.28 | 1.72% | 1.54% | 98.11% | 0.71s | $0.0000 |

#### Speed

| Rank | Provider | Value | Coverage | Avg automated quality | Avg WER | Avg CER | Avg content coverage | Avg speed | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>defuddle</code> | 0.71s | 2/7 | 98.28 | 1.72% | 1.54% | 98.11% | 0.71s | $0.0000 |

#### Automated Quality

| Rank | Provider | Value | Coverage | Avg automated quality | Avg WER | Avg CER | Avg content coverage | Avg speed | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>defuddle</code> | 98.28 automated quality | 2/7 | 98.28 | 1.72% | 1.54% | 98.11% | 0.71s | $0.0000 |

### Service

#### Price

| Rank | Provider | Value | Coverage | Avg automated quality | Avg WER | Avg CER | Avg content coverage | Avg speed | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>firecrawl</code> | $0.0008 | 7/7 | 80.45 | 25.68% | 26.47% | 99.65% | 1.73s | $0.0008 |
| 2 | <code>spider</code> | $0.0012 | 7/7 | 92.42 | 9.89% | 9.78% | 99.27% | 1.79s | $0.0012 |
| 3 | <code>zyte</code> | $0.0016 | 7/7 | 52.99 | 52.00% | 53.47% | 69.40% | 10.48s | $0.0016 |
| 4 | <code>supadata</code> | $0.0100 | 7/7 | 75.39 | 29.22% | 39.14% | 99.11% | 5.52s | $0.0100 |
| 5 | <code>glm-reader</code> | $0.0100 | 7/7 | 68.77 | 35.59% | 33.95% | 80.21% | 4.04s | $0.0100 |

#### Speed

| Rank | Provider | Value | Coverage | Avg automated quality | Avg WER | Avg CER | Avg content coverage | Avg speed | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>firecrawl</code> | 1.73s | 7/7 | 80.45 | 25.68% | 26.47% | 99.65% | 1.73s | $0.0008 |
| 2 | <code>spider</code> | 1.79s | 7/7 | 92.42 | 9.89% | 9.78% | 99.27% | 1.79s | $0.0012 |
| 3 | <code>glm-reader</code> | 4.04s | 7/7 | 68.77 | 35.59% | 33.95% | 80.21% | 4.04s | $0.0100 |
| 4 | <code>supadata</code> | 5.52s | 7/7 | 75.39 | 29.22% | 39.14% | 99.11% | 5.52s | $0.0100 |
| 5 | <code>zyte</code> | 10.48s | 7/7 | 52.99 | 52.00% | 53.47% | 69.40% | 10.48s | $0.0016 |

#### Automated Quality

| Rank | Provider | Value | Coverage | Avg automated quality | Avg WER | Avg CER | Avg content coverage | Avg speed | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>spider</code> | 92.42 automated quality | 7/7 | 92.42 | 9.89% | 9.78% | 99.27% | 1.79s | $0.0012 |
| 2 | <code>firecrawl</code> | 80.45 automated quality | 7/7 | 80.45 | 25.68% | 26.47% | 99.65% | 1.73s | $0.0008 |
| 3 | <code>supadata</code> | 75.39 automated quality | 7/7 | 75.39 | 29.22% | 39.14% | 99.11% | 5.52s | $0.0100 |
| 4 | <code>glm-reader</code> | 68.77 automated quality | 7/7 | 68.77 | 35.59% | 33.95% | 80.21% | 4.04s | $0.0100 |
| 5 | <code>zyte</code> | 52.99 automated quality | 7/7 | 52.99 | 52.00% | 53.47% | 69.40% | 10.48s | $0.0016 |

## Per-Run Automated Quality

Source automated-quality value per provider in each run, sorted by aggregate mean.

### Local

| Provider | Mean | 2026-05-21_09-38-31-367_anthony-campolos-home-page | 2026-05-21_09-38-58-898_autogenerate-show-notes-with-whisper-cpp-llama-cpp-and-node-js | 2026-07-18_01-28-32-062_promise-javascript-mdn | 2026-07-18_01-28-41-200_apollo-11-wikipedia | 2026-07-18_01-28-50-262_rfc-9110-http-semantics | 2026-07-18_01-28-55-132_pride-and-prejudice-project-gutenberg | 2026-07-18_01-29-01-024_thinking-in-react-react |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>defuddle</code> | 98.28 | 97.17 | 99.40 | — | — | — | — | — |

### Service

| Provider | Mean | 2026-05-21_09-38-31-367_anthony-campolos-home-page | 2026-05-21_09-38-58-898_autogenerate-show-notes-with-whisper-cpp-llama-cpp-and-node-js | 2026-07-18_01-28-32-062_promise-javascript-mdn | 2026-07-18_01-28-41-200_apollo-11-wikipedia | 2026-07-18_01-28-50-262_rfc-9110-http-semantics | 2026-07-18_01-28-55-132_pride-and-prejudice-project-gutenberg | 2026-07-18_01-29-01-024_thinking-in-react-react |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>spider</code> | 92.42 | 94.70 | 93.09 | 98.30 | 69.40 | 98.31 | 99.56 | 93.61 |
| <code>firecrawl</code> | 80.45 | 97.35 | 92.35 | 53.15 | 60.70 | 99.83 | 99.26 | 60.52 |
| <code>supadata</code> | 75.39 | 94.75 | 13.58 | 96.76 | 51.02 | 96.28 | 99.25 | 76.05 |
| <code>glm-reader</code> | 68.77 | 41.09 | 83.73 | 6.58 | 69.03 | 96.76 | 99.48 | 84.76 |
| <code>zyte</code> | 52.99 | 53.66 | 62.84 | 67.15 | 61.50 | 6.80 | 99.78 | 19.16 |

## Human Quality Note

No explicit `humanQualityScore` was available in any of the 7 source reports. Generic quality scores, cost, speed, file size, token estimates, content coverage, WER, CER, and artifact metadata are not human-quality proxies, so no human-quality ranking is produced.

## Long-Distance Note

5 of 7 source reports declare deterministic long-sequence distance handling beyond 10,000 normalized elements. This combined report averages the source values as recorded and does not recompute or mix distance methods at the combined-report level.

## Notes

- Each provider is aggregated by providerKey within its source group; present-value means do not impute missing rows or metrics.
- Local and service providers are never ranked together; local monetary cost remains zero.
- No human-quality ranking is emitted because explicit human-quality rows are absent from the current source reports.
- Each group ranks price, speed, and automated quality independently. No weighted composite or model-tier ranking is emitted.
