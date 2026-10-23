# Five-prompt LLM speed and cost benchmark

The current comparison has 39 valid structured outputs across 40 prompt/model pairs, 8 model/provider routes, and five prompts. Recorded history contains 42 attempts: 40 first-pass requests (38 valid) and 2 reruns (1 valid). Cumulative usage-based catalog costs total $1.374966.

Among routes with all five valid outputs, the lowest mean request cost is **openai/gpt-6-luna** ($0.000748) and the lowest mean request latency is **openai/gpt-6-luna** (4.975s).

## Method and spending

The retained batch is one pass of five fixed input/preset pairs across the 8 routes captured in [benchmark-plan.json](benchmark-plan.json). The registry preflight estimated $0.770702 before additional reasoning usage or unreported failure charges. Each provider can run 2 targets concurrently. The pruned plan carries no inherited execution approval. The original batch used the CLI/model reasoning defaults available at execution time; current support comes from the live CLI catalog.

Each slot makes one inference attempt. The benchmark blocks schema-validation repurchases and adapter fallback requests; explicitly rejected admission requests may retry. Dispatch-started receipts are saved before network access, and existing receipts prevent repurchasing successful, invalid, failed, or ambiguous slots on replay. Raw responses and provider usage remain available beside each manifest.

Targeted reruns are pinned in [rerun-plan.json](rerun-plan.json) and saved separately beneath each affected case’s `reruns/` directory. The current comparison selects the latest completed attempt per prompt/model pair, including a latest failure. Earlier attempts and their costs remain preserved in request evidence. Rerunning selected failures does not establish repeated-run latency statistics.

Latency is observed wall-clock seconds per request, including provider latency and generation. The aggregate gives each prompt equal weight and includes only routes with valid outputs for all five cases. It is not time to first token or decode throughput. One observation does not establish stable median performance.

Cost multiplies recorded provider usage by the saved uncached catalog tariffs; cache discounts and Gemini Argon introductory pricing are excluded. Local token estimates remain labeled where provider usage is missing. Cumulative totals include every original and rerun attempt, including failed or invalid outputs; comparison ranks use only selected valid requests. Missing billing remains unavailable rather than zero, even after a later rerun succeeds. These are usage-based cost calculations, not provider invoices or confirmed amounts charged.

At the user’s request, the temporary quality proxy is the listed USD price per million output tokens, with higher prices treated as the proxy for higher quality. This rate is separate from measured dollars per request, which also depends on input, output, reasoning, and caching. No text judge, human quality score, or instruction-compliance score was purchased or inferred.

## Selected workloads

| Preset         | Input                                                                                                        | Current valid / routes | Cumulative usage-based cost |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------- | --------------------------- |
| shortSummary   | `docs/benchmarks/text/write/2026-09-16_06-51-18-238_1-audio/transcription.txt`                               | 7/8                    | $0.026389                   |
| longSummary    | `docs/benchmarks/stt/with-speakers/2022-09-30-widgets-fsjam-40-minutes/consensus-transcription.txt`          | 8/8                    | $0.226798                   |
| mediumChapters | `docs/benchmarks/stt/with-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes/consensus-transcription.txt` | 8/8                    | $0.109924                   |
| blog           | `docs/benchmarks/stt/with-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes/consensus-transcription.txt` | 8/8                    | $0.270936                   |
| rapSongChapter | `input/examples/document/harborlight-field-notes.md`                                                         | 8/8                    | $0.740919                   |

The short summary produces at most 180 characters from the original 216-word input. The long summary compresses the saved 7,919-word transcript into roughly 100–200 words. Medium chapters extract timestamps and descriptions from the 1,637-word transcript. The blog uses that same transcript for an outline and a draft of at least 750 words. The chapter-song case adapts the original 838-word Harborlight field notes under extensive lyric constraints. Schema checks establish structured artifact validity; these requested prose lengths and creative constraints are not independently scored.

## All-five comparison

| Model / provider            | Valid cases | Mean seconds / request | Mean USD / request | Price proxy USD / 1M output |
| --------------------------- | ----------- | ---------------------- | ------------------ | --------------------------- |
| anthropic/claude-haiku-5-5  | 5/5         | 9.285s                 | $0.001485          | $0.50                       |
| anthropic/claude-opus-5-5   | 5/5         | 15.794s                | $0.049433          | $20.00                      |
| anthropic/claude-sonnet-5-5 | 4/5         | n/a                    | n/a                | n/a                         |
| gemini/gemini-3.8-flash     | 5/5         | 15.837s                | $0.021681          | $7.50                       |
| gemini/gemini-4-argon       | 5/5         | 11.679s                | $0.030078          | $20.00                      |
| grok/grok-4.7               | 5/5         | 163.861s               | $0.081526          | $6.00                       |
| openai/gpt-6-luna           | 5/5         | 4.975s                 | $0.000748          | $0.50                       |
| openai/gpt-6.1-sol          | 5/5         | 12.211s                | $0.015260          | $10.00                      |

The [checksummed response evidence](2026-10-18-write.evidence.zip) preserves original saved bytes, including each case’s decoded `raw-response-*.json`, failure evidence, durable `slot-*.json` receipts, source and prompt snapshots, canonical manifests, and pinned plans. Nested rerun evidence is included when present. `SHA256SUMS` identifies every archived file. Standalone request artifacts remain inputs to hash-checked cache reuse.

The directory relocation under `docs/benchmarks/text/write` updated standalone path references, prompt source paths, dependent checksums, and plan fingerprints. Routes later removed from the CLI were pruned from the plan, receipts, manifests and this evidence ZIP, and the remaining receipts were re-pinned to the pruned plan fingerprint. The relocated rerun plan has no execution authorization; moving these records does not approve another paid request.

## Short summary

[First-pass manifest](2026-10-18_01-short-summary/manifest.json) · [First-pass provider report](2026-10-18_01-short-summary/provider-comparison-report.md)

| Model / provider            | Attempt | Status        | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                                        |
| --------------------------- | ------- | ------------- | ------- | --------- | ------------ | -------------------- | -------------- | --------------------------------------------------------------- |
| anthropic/claude-haiku-5-5  | 01      | succeeded     | 1.027   | $0.000107 | 817          | 51                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| openai/gpt-6-luna           | 01      | succeeded     | 2.796   | $0.000088 | 438          | 88                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| openai/gpt-6.1-sol          | 01      | succeeded     | 2.882   | $0.001296 | 438          | 42                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| anthropic/claude-opus-5-5   | 01      | succeeded     | 2.899   | $0.004628 | 817          | 68                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| gemini/gemini-3.8-flash     | 01      | succeeded     | 3.783   | $0.003972 | 468          | 436                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| gemini/gemini-4-argon       | 01      | succeeded     | 5.559   | $0.003804 | 666          | 57                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| grok/grok-4.7               | 01      | succeeded     | 6.673   | $0.007886 | 1714         | 743                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| anthropic/claude-sonnet-5-5 | 02      | schema failed | 1.586   | $0.002294 | 817          | 66                   | provider_usage | [Manifest](2026-10-18_01-short-summary/reruns/02/manifest.json) |

## Long summary

[First-pass manifest](2026-10-18_02-long-summary/manifest.json) · [First-pass provider report](2026-10-18_02-long-summary/provider-comparison-report.md)

| Model / provider            | Attempt | Status    | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                             |
| --------------------------- | ------- | --------- | ------- | --------- | ------------ | -------------------- | -------------- | ---------------------------------------------------- |
| openai/gpt-6-luna           | 01      | succeeded | 2.292   | $0.001145 | 10205        | 249                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| anthropic/claude-haiku-5-5  | 01      | succeeded | 3.554   | $0.001645 | 14152        | 459                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| openai/gpt-6.1-sol          | 01      | succeeded | 3.964   | $0.022410 | 10205        | 200                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| anthropic/claude-sonnet-5-5 | 01      | succeeded | 4.570   | $0.031754 | 14152        | 345                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| gemini/gemini-4-argon       | 01      | succeeded | 5.440   | $0.049484 | 11336        | 207                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| anthropic/claude-opus-5-5   | 01      | succeeded | 6.471   | $0.066428 | 14152        | 491                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| gemini/gemini-3.8-flash     | 01      | succeeded | 9.153   | $0.025804 | 11103        | 1220                 | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| grok/grok-4.7               | 01      | succeeded | 11.355  | $0.028128 | 11502        | 854                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |

## Medium chapters

[First-pass manifest](2026-10-18_03-medium-chapters/manifest.json) · [First-pass provider report](2026-10-18_03-medium-chapters/provider-comparison-report.md)

| Model / provider            | Attempt | Status    | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                                |
| --------------------------- | ------- | --------- | ------- | --------- | ------------ | -------------------- | -------------- | ------------------------------------------------------- |
| openai/gpt-6-luna           | 01      | succeeded | 2.813   | $0.000438 | 2540         | 368                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json) |
| anthropic/claude-opus-5-5   | 01      | succeeded | 6.116   | $0.024928 | 3932         | 460                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json) |
| openai/gpt-6.1-sol          | 01      | succeeded | 6.263   | $0.008990 | 2540         | 391                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json) |
| gemini/gemini-4-argon       | 01      | succeeded | 6.451   | $0.019028 | 3067         | 338                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json) |
| anthropic/claude-sonnet-5-5 | 01      | succeeded | 6.974   | $0.015564 | 3932         | 770                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json) |
| anthropic/claude-haiku-5-5  | 01      | succeeded | 7.853   | $0.001157 | 3932         | 1528                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json) |
| gemini/gemini-3.8-flash     | 01      | succeeded | 13.433  | $0.018431 | 2747         | 1908                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json) |
| grok/grok-4.7               | 01      | succeeded | 26.184  | $0.021388 | 3875         | 2273                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json) |

## Blog

[First-pass manifest](2026-10-18_04-blog/manifest.json) · [First-pass provider report](2026-10-18_04-blog/provider-comparison-report.md)

| Model / provider            | Attempt | Status    | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                     |
| --------------------------- | ------- | --------- | ------- | --------- | ------------ | -------------------- | -------------- | -------------------------------------------- |
| openai/gpt-6-luna           | 01      | succeeded | 9.130   | $0.001043 | 2409         | 1605                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| anthropic/claude-haiku-5-5  | 01      | succeeded | 15.150  | $0.001701 | 3660         | 2670                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| gemini/gemini-4-argon       | 01      | succeeded | 18.846  | $0.035656 | 2879         | 1207                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| openai/gpt-6.1-sol          | 01      | succeeded | 25.054  | $0.022278 | 2409         | 1746                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| anthropic/claude-opus-5-5   | 01      | succeeded | 25.736  | $0.061740 | 3660         | 2355                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| anthropic/claude-sonnet-5-5 | 01      | succeeded | 25.924  | $0.033590 | 3660         | 2627                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| gemini/gemini-3.8-flash     | 01      | succeeded | 27.687  | $0.030480 | 2620         | 3540                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| grok/grok-4.7               | 01      | succeeded | 132.759 | $0.084448 | 3713         | 12837                | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |

## Rap song chapter

[First-pass manifest](2026-10-18_05-rap-song-chapter/manifest.json) · [First-pass provider report](2026-10-18_05-rap-song-chapter/provider-comparison-report.md)

| Model / provider            | Attempt | Status    | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                                           |
| --------------------------- | ------- | --------- | ------- | --------- | ------------ | -------------------- | -------------- | ------------------------------------------------------------------ |
| openai/gpt-6-luna           | 01      | succeeded | 7.844   | $0.001026 | 3518         | 1348                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| anthropic/claude-haiku-5-5  | 01      | succeeded | 18.843  | $0.002816 | 6350         | 4361                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| gemini/gemini-4-argon       | 01      | succeeded | 22.100  | $0.042420 | 4155         | 1290                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| openai/gpt-6.1-sol          | 01      | succeeded | 22.894  | $0.021326 | 3518         | 1429                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| gemini/gemini-3.8-flash     | 01      | succeeded | 25.127  | $0.029719 | 3523         | 3258                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| anthropic/claude-opus-5-5   | 01      | succeeded | 37.746  | $0.089440 | 6350         | 3202                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| anthropic/claude-sonnet-5-5 | 01      | succeeded | 39.058  | $0.063530 | 6350         | 5083                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| grok/grok-4.7               | 02      | succeeded | 642.334 | $0.265778 | 4939         | 42650                | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/reruns/02/manifest.json) |

## Failed or schema-invalid request history

| Preset         | Model / provider            | Attempt | Current result | Status        | Diagnostic                                                                            | Evidence                                                                               |
| -------------- | --------------------------- | ------- | -------------- | ------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| shortSummary   | anthropic/claude-sonnet-5-5 | 01      | schema failed  | schema failed | {"nested":{"episodeDescription":["Invalid length: Expected <=180 but received 181"]}} | [Receipt](2026-10-18_01-short-summary/slot-anthropic-claude-sonnet-5-5.json)           |
| shortSummary   | anthropic/claude-sonnet-5-5 | 02      | still selected | schema failed | {"nested":{"episodeDescription":["Invalid length: Expected <=180 but received 184"]}} | [Receipt](2026-10-18_01-short-summary/reruns/02/slot-anthropic-claude-sonnet-5-5.json) |
| rapSongChapter | grok/grok-4.7               | 01      | succeeded      | schema failed | {"nested":{"bridge":["Invalid length: Expected <=8 but received 9"]}}                 | [Receipt](2026-10-18_05-rap-song-chapter/slot-grok-grok-4.7.json)                      |

1 failed or invalid requests remain in the current comparison. Earlier failures remain in this history after a successful rerun. Missing usage remains unresolved and is excluded from the known catalog-cost total.

## Reproduce and verify

Inspect the current active inventory without provider calls: `bun src/tools/write-benchmark.ts --price`. Verify the pinned historical receipts with `bun src/tools/write-benchmark.ts --verify-cache`. The runner’s `--run` mode dispatches unattempted slots only when the exact plan still matches the live catalog and approval; reusing its existing receipts never repurchases an attempted slot. A fresh paid benchmark requires a new cost estimate and the repository’s spending authorization.

Regenerate each standard provider report with `bun .codex/skills/consensus/scripts/run.ts text build-report <run-directory>`. Those compatibility reports retain their established token-normalized speed rankings and enumerate raw accounting metadata, including invalid outputs when usage is available. Use this five-prompt report and the Write dashboard for valid-output comparisons and observed seconds per request.

Regenerate this report with `bun src/tools/write-benchmark-report.ts --write`; add `--archive` to rebuild its evidence ZIP after all slots have finished. Rebuild the dashboard with `bun .codex/skills/consensus/scripts/run.ts build-combined-dashboard docs/benchmarks`. Serve the repository benchmark directory over HTTP to use the dashboard.

<!-- verification:start -->
Verification recorded on 2026-10-23, after routes the CLI no longer implements were pruned from this benchmark:

- `bun run check`: passed structure, naming, types, and documentation checks.
- `bun t --price --no-cleanup`: 92/92 no-cost pricing commands passed.
- `bun src/tools/write-benchmark.ts --verify-cache`: 40 receipts verified, zero network requests.
- `bun src/tools/rerun-write-benchmark.ts --verify-cache`: both rerun receipts verified with network access blocked.
- The rerun plan was rebuilt locally with `--prepare` against the re-pinned plan; it selects the two remaining unsuccessful first-pass slots and carries no authorization.
- Targeted local contract tests for the runner, reruns, dashboard, reports, and pricing passed with mocked provider responses and no paid calls.

The remaining failure is Sonnet 5.5's 184-character short summary against a 180-character limit. Prompts, schemas, native request controls, and the retained attempt artifacts are unchanged.

```bash
bun --no-env-file test \
  test/test-cases/validation/reports-pricing/write-benchmark-contracts.test.ts \
  test/test-cases/validation/reports-pricing/write-benchmark-rerun-contracts.test.ts \
  test/test-cases/validation/reports-pricing/write-dashboard-contracts.test.ts \
  test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts \
  test/test-cases/validation/text/write/grok-47-contracts.test.ts
```
<!-- verification:end -->

Passing mocks verify dispatch and accounting behavior, not generated-text correctness or perceptual quality.
