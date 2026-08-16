# ADR-012: Govern Benchmark Evidence and Generated-Report Architecture

## Status

- **Decision Status:** Superseded
- **Date Created:** 2026-07-16
- **Date Updated:** 2026-08-15
- **Verification Status:** Passed
- **Supersession:** The CLI `benchmark` command was removed. This record remains historical for committed `docs/benchmarks/` run data, consensus-skill combined reports, the quality-cost tier contract, paid-approval gates, calibration evidence, and artifact repair/compaction rules. Durable registry/lifecycle/capability policy belongs to [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); dated model changes belong to [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md).

## Context

Hosted-model refreshes need an evidence lifecycle distinct from model policy and provider chronology. Primary documentation establishes identity, availability, capabilities, pricing, and limits. Local contracts establish selector, request, response, resume, pricing, and artifact behavior without credentials. `--price` establishes a no-provider execution plan and estimate. A live benchmark or calibration then requires immediate command-specific approval, and its output is trustworthy only after identity, completeness, duration/page/source, usage, artifact, and report checks pass.

The consensus skill builds combined cross-run benchmark reports for STT, OCR, and URL with `bun scripts/run.ts <stt|ocr|url> build-combined-report <root_dir>`. Each builder emits a machine-readable JSON contract and a Markdown report under `docs/benchmarks/stt/`, `docs/benchmarks/ocr/`, or `docs/benchmarks/url/`.

Presentation is constrained by how those artifacts are produced and read. Each group carries eleven ranking surfaces — three pure and eight weighted — so a Markdown-only report repeats the same providers across eleven tables and forces readers to scroll between hundreds of rows to relate one provider's quality, speed, cost, composite, and tier. Combined reports are regenerated whenever a benchmark run is added, so any hand-authored dashboard goes stale. The artifacts are committed and commonly opened from a checkout, so the readable form must work offline from `file://` without a server, build step, network request, or third-party dependency.

Tiering is constrained by the same regeneration requirement. Tier membership must be reproducible identically in the HTML, Markdown, and JSON forms from data the builders already compute, must give readers one stable ordering to follow, and must not imply a cross-group leaderboard.

Why now: STT, OCR, and URL combined reports share an expanded ranking contract, so their generated JSON, Markdown, and offline HTML need one deterministic presentation and tiering structure before further benchmark runs are added.

## Options Considered

### Evidence governance

| Option                                                                                                  | Pros                                                                                                                                              | Cons                                                                                                        | Quantitative Notes                                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **One benchmark-evidence authority with command-specific paid approval and generated-report ownership** | Keeps source evidence, local proof, price preflight, paid execution, artifact validation, compaction, and regeneration in one auditable lifecycle | Requires modality refreshes to link here rather than embedding their own benchmark process                  | Covers write/OCR, STT, TTS, music, image, video, and the STT/OCR/URL combined reports |
| Keep benchmark evidence inside each refresh ADR                                                         | Keeps chronology beside model changes                                                                                                             | Repeats approval and regeneration rules and makes cross-modality evidence hard to compare                   | Previously split across 4 refresh records plus this report record                     |
| Treat a successful provider response as sufficient evidence                                             | Minimizes validation work                                                                                                                         | Can retain collisions, duplicated remote jobs, wrong identity, incomplete outputs, or stale derived reports | The 2026 STT and music runs each exposed exactly such post-response failures          |
| Skip live evidence entirely                                                                             | Avoids cost and quota risk                                                                                                                        | Leaves some compatibility, timing, usage, and artifact claims unverified                                    | Appropriate when local contracts are sufficient, not a universal rule                 |

### Report presentation

| Option                                                              | Pros                                                                                                                                        | Cons                                                                                                 | Quantitative Notes                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Generator-emitted, self-contained HTML beside JSON and Markdown** | Regenerates with the source data; works offline; can consolidate ranks, values, and visual encodings; remains deterministic and versionable | Requires a custom HTML/CSS/JavaScript renderer and adds a committed artifact                         | 3 sibling artifacts per combined report; 0 runtime dependencies |
| Markdown only                                                       | Needs no additional output format and remains easy to diff                                                                                  | Eleven ranking tables per group still repeat the same providers and make cross-referencing difficult | 1 presentation artifact; 11 ranking surfaces per group          |
| Hand-authored dashboard                                             | Allows unconstrained design for the current data                                                                                            | Goes stale after regeneration                                                                        | 1 manually maintained dashboard                                 |
| Served dashboard that reads JSON at runtime                         | Supports richer interaction and runtime data loading                                                                                        | Requires a server and breaks the offline, self-contained artifact contract                           | At least 1 runtime service and 1 data request                   |

### Model tiering

| Option                                                           | Pros                                                                                                                          | Cons                                                                                                                                                               | Quantitative Notes                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **Three contiguous terciles of the `qualityCost` ranking**       | Gives every provider one visible order; produces stable, near-equal tier sizes; is simple to reproduce in every output format | Measures position on one chosen composite rather than breadth across ranking surfaces                                                                              | 3 tiers; tier sizes differ by at most 1 provider |
| Placement breadth across all eleven pure and weighted surfaces   | Rewards providers that place well under several priorities                                                                    | Tier sizes depend on placement thresholds; specialized surfaces can change membership; the result has no single rank to explain it                                 | 11 ranking surfaces per group                    |
| Threshold-based quality-cost tiers                               | Can attach fixed semantic labels to composite ranges                                                                          | Per-run min-max subscores are cohort-relative, so fixed thresholds would imply more absolute meaning than the scores support and could leave tiers sparse or empty | Uses cohort-relative 0–100 subscores             |
| Terciles from another composite, such as balanced or `costSpeed` | Retains deterministic, near-equal groups while emphasizing another objective                                                  | Does not express the intended joint emphasis on quality and cost; selecting another objective merely moves the policy choice                                       | 8 available weighted rankings                    |

## Decision

Govern benchmark evidence through a strict lifecycle requiring no-cost preflight, explicit command-specific paid approval, artifact validation, and post-validation compaction, while generating self-contained offline HTML dashboards beside JSON and Markdown reports with deterministic quality-cost tercile tiering.

This applies to:

- Benchmark evidence lifecycle, paid-approval requirements, and artifact validation across all hosted modalities.
- STT, OCR, and URL combined cross-run report builders and their generated JSON, Markdown, and self-contained HTML artifacts.
- The shared eight-set weighted ranking registry and deterministic quality-cost tercile tiering contract (`quality-cost-terciles-v1`).
- Post-validation artifact compaction, historical result envelope preservation, and report regeneration rules.

It does not apply to:

- Production CLI flags, runtime commands, or public execution APIs (the CLI `benchmark` command was removed).
- Durable hosted-model registry, lifecycle, and capability policy (governed by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- Dated hosted-model refresh chronology and selector changes (governed by [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md)).
- Single-run execution manifests, runtime data fetching, or cross-group overall leaderboards.

### Benchmark evidence lifecycle and paid approval

Every provider/model refresh follows this evidence order:

1. Refresh dated primary-source documentation through explicit curated selections. Preserve source URLs, refresh metadata, content hashes, token counts, and failed-fetch behavior under [ADR-011](ADR-011-add-refresh-metadata-to-links.md). Do not infer a current model from a moving alias or secondary catalog when primary request/pricing/capability documentation is available.
2. Update the complete local contract under [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) and [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md). Run static checks plus targeted no-network selector, ordering, pricing, provenance, request-builder, response-parser, resume, historical-normalization, CLI help, usage, and option-resolution tests.
3. Run the exact no-cost `--price` or `resume --price` command for the intended targets. Price mode must invoke no provider and mutate no manifest or raw artifact under [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).
4. If live evidence is materially necessary, obtain immediate explicit approval naming the exact provider command and the reported cost or quota risk. Approval for implementation, another provider, an earlier phase, a failed attempt, or a preflight never authorizes the paid command. A correction or rerun requires fresh approval.
5. Validate returned identity, provider/model state, source coverage, page/duration counts, attempt/retry data, usage and actual cost, output integrity, and artifact uniqueness. A provider-reported success is not trustworthy when checkpoints, paths, checksums, or normalized outputs prove collision or reuse.
6. Compact only after trustworthy provider results exist. Preserve canonical result envelopes and historical identity, remove regenerable checkpoints/splits/derived files only after validation, rebuild per-run reports from the compacted artifacts, then regenerate combined JSON/Markdown/HTML and repository summaries from those same reports.

Published provider billing remains authoritative over an estimate. Recorded provider cost takes precedence over reconstructed historical rates. Benchmark estimates and actuals must name retries, reruns, billing variance, quota effects, and any excluded or invalid outputs.

Paid calibration is not a prerequisite for a compatibility or lifecycle transition when primary documentation and local mocked contracts prove request support. Provisional same-family heuristics remain labeled until qualified evidence exists. One quality/timing sample never changes published rates, and OCR calibration does not automatically become write calibration.

### Self-contained combined-report dashboards

All three combined report builders emit three sibling artifacts:

- `combined-comparison-report.json`, the data contract;
- `combined-comparison-report.md`, the diffable text report; and
- `combined-comparison-report.html`, the primary visual dashboard.

The HTML is generated, not hand-authored. A shared, category-agnostic renderer receives a view model assembled by each builder. Category differences such as group names, column labels, evidence fields, display names, and value formats are data in that model rather than separate dashboard implementations.

The resulting HTML is one file with all report data embedded at generation time, all CSS and JavaScript inline, and no network or third-party runtime dependencies. The browser script only switches among rankings that TypeScript has already computed and embedded; it does not recompute ranks or composites. The report remains readable when JavaScript is disabled and opens directly from `file://`. This keeps JSON, Markdown, and HTML on the same generated data while allowing the dashboard to consolidate the repeated ranking tables into one provider view, a weighted-ranking matrix, tier cards, and a per-run quality heatmap.

URL combined schema v1 uses the source reports' `rankingSurfaces.*.automatedQuality` values as quality evidence, averages present supporting WER, CER, content coverage, processing-time, and cost values, and keeps `local` and `service` aggregation independent. Optional canonical `manifest.json` item metadata supplies article titles and safe HTTP(S) inventory links.

### Weighted rankings and quality-cost terciles

Weighted composites use per-run, per-group min-max quality, speed, and cost subscores on a 0-100 scale. Quality is higher-is-better; speed and cost are lower-is-better. Provider subscores are averaged across the runs for which a value is present, and each composite is `w_q*Q + w_s*S + w_c*C`.

The exact weighted-ranking registry is:

| Key               | Quality | Speed | Cost |
| ----------------- | ------: | ----: | ---: |
| `strongQuality`   |    0.80 |  0.10 | 0.10 |
| `moderateQuality` |    0.60 |  0.20 | 0.20 |
| `strongSpeed`     |    0.10 |  0.80 | 0.10 |
| `moderateSpeed`   |    0.20 |  0.60 | 0.20 |
| `strongCost`      |    0.10 |  0.10 | 0.80 |
| `moderateCost`    |    0.20 |  0.20 | 0.60 |
| `qualityCost`     |    0.45 |  0.10 | 0.45 |
| `costSpeed`       |    0.10 |  0.45 | 0.45 |

All rankings and tiers are computed separately within each provider group. Local, non-diarization, diarization, and other category groups are never combined into a cross-group overall leaderboard.

The tier contract is:

- `method` is `"quality-cost-terciles-v1"`.
- `ranking` is `"qualityCost"`.
- The underlying ranking orders composite descending, then quality subscore descending, then provider key ascending. The JSON `tieBreak` value is `"composite-desc, quality-subscore-desc, providerKey-asc"`.
- For a group of `n` providers, start each tier with `floor(n / 3)` providers. Assign the first remainder provider to Tier 1 and the second to Tier 2. The resulting sizes differ by at most one: for example, eight providers split 3/3/2 and ten split 4/3/3.
- Tiers are contiguous slices of the ordered `qualityCost` ranking. Every provider appears exactly once; three tier rows are still emitted for an empty or small group.
- Each provider row inside JSON `tiering[*].tiers[*].providers` exposes `qualityCostRank` and `qualityCostComposite` alongside its identity fields.
- Markdown tier tables and HTML tier cards display matching quality-cost ranks and composites from that same tier data.

The combined JSON report schema versions are OCR v2, STT v3, and URL v1. These versions apply only to the generated benchmark-report contracts, not the unversioned pipeline manifest.

## Rationale

- Mechanical generation is the only way to keep the visual report current with the JSON and Markdown artifacts after every benchmark update.
- A shared renderer keeps category differences explicit while preventing separate STT, OCR, and URL dashboards from drifting.
- Embedded data, inline assets, and zero dependencies preserve deterministic, offline use from a repository checkout.
- Precomputing ranks and composites in TypeScript gives all three formats one source of truth; the browser is a presentation layer only.
- Quality-cost terciles give readers a direct ordering and near-equal bands while respecting the existing rule that provider groups are evaluated independently.

## Consequences

Positive outcomes:

- Each combined report has a compact offline dashboard without sacrificing a machine-readable JSON contract or diffable Markdown report.
- The eight named weighted rankings cover strong and moderate single-dimension preferences plus quality-cost and cost-speed trade-offs.
- Tier membership is deterministic, exhaustive, contiguous, and easy to verify from the `qualityCost` ranking.
- Markdown tables and HTML cards communicate the same tier ranks and composites.

Negative outcomes:

- The project maintains a custom renderer and larger generated report artifacts.
- Terciles are cohort-relative categories, not absolute quality labels; adding or removing a provider can move a tier boundary.
- Tiering does not measure breadth across the three pure rankings and the other weighted rankings. Those surfaces remain available for analysis, but they do not influence tier membership.
- Choosing `qualityCost` makes the 45/10/45 policy explicit; consumers that prefer another objective must use the corresponding ranking rather than reinterpret the tiers.

## Trade-offs

| Gains                                                                      | Sacrifices                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Generated, always-current HTML from the same builders as JSON and Markdown | Custom renderer maintenance and committed HTML diffs                           |
| Offline single-file dashboard with no dependencies                         | No runtime data loading or external charting library                           |
| Stable, near-equal, explainable quality-cost tiers                         | No tier-level measure of breadth across pure and alternative weighted rankings |
| One per-group tier order shared by JSON, Markdown, and HTML                | No cross-group leaderboard and no absolute-score tier thresholds               |

## Implementation Note

The report architecture is implemented in:

- `.codex/skills/consensus/scripts/shared/combined_report_lib.ts` for the shared weight registry, composite ordering, tercile construction, and Markdown tier rendering;
- `.codex/skills/consensus/scripts/shared/combined_report_html.ts` for the pure self-contained dashboard renderer;
- `.codex/skills/consensus/scripts/stt/build_combined_report.ts` for STT schema v3 and category-specific aggregation/view-model assembly;
- `.codex/skills/consensus/scripts/ocr/build_combined_report.ts` for OCR schema v2 and category-specific aggregation/view-model assembly; and
- `.codex/skills/consensus/scripts/url/build_combined_report.ts` for URL schema v1, source inventory metadata, and source-ranking aggregation/view-model assembly.

The focused combined-report contract test checks the exact eight-set registry, weighted ordering and tie-breaks, tercile sizes, JSON fields, schema versions, and rank/composite parity in the committed Markdown and HTML artifacts.

### 2026 hosted-model evidence ledger

ADR-013 owns which selectors changed; this section records what was measured, approved, repaired, compacted, and regenerated.

#### Write and OCR

- Calibration across historical benchmark runs produced GPT-5.6 and Claude Fable 5 benchmark evidence, establishing token throughput and timing baselines with unified multipliers.
- A separately approved Kimi K3 short-summary write probe proved request and usage compatibility without requiring thinking-field overrides.

#### STT

- Benchmark evidence was verified across AssemblyAI Universal-3.5/2, Deepgram Nova-3, Gemini 3.6 Flash, Gladia Solaria 1/3, Soniox Async v5, Speechmatics Melia 1, and Together Parakeet across 5 source audio files (~4.5 audio hours per pass).
- Resolved provider-specific edge cases: Gladia checkpoint isolation for multi-segment runs, Speechmatics multi-language request format, and Together operational split caps.
- Compaction retained structured `result.json` provider output envelopes, removed intermediate checkpoint/split files, and regenerated per-run and combined reports covering 26 historical/current provider identities.

#### TTS and music

- Four retained June TTS benchmark cohorts (`tts-hard`, `tts-long`, `0-tts-short`, `1-tts`) were safely continued through exact no-cost `resume --price` preflights and approved paid passes.
- Provider rejections exposed obsolete Inworld 1.5 identifiers and DeepInfra per-model input/schema constraints; the registry updated to current Inworld TTS-2 Flash and model-specific serialization.
- DeepInfra Chatterbox Multilingual returned HTTP 500 on the hard input; the failed attempt was preserved with retained checkpoints without deleting cached artifacts. The cohort closed at 51 of 52 current-model outputs (12/13 on hard, 13/13 on remaining runs).
- Four TTS provider-comparison reports were regenerated from retained successful artifacts, exposing price, speed, and automated/human quality surfaces without unverified voice claims.
- Music preflight and execution validated ElevenLabs Music v2 and MiniMax Music 3.0 additions, resolving an additive-resume output collision by promoting outputs to provider/model-specific filenames.

## Follow-up Actions

| Action                                                                                                                            | Owner                           | Current State                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Keep the eight-ranking registry, ordering rules, and tercile construction shared across STT, OCR, and URL builders                | Report maintainers              | Implemented in `combined_report_lib.ts`                                                                                        |
| Generate JSON, Markdown, and self-contained HTML from the same category view models                                               | Report maintainers              | Implemented in the shared renderer and category builders                                                                       |
| Validate schema versions, tie-breaks, tier sizes, and rank/composite parity across committed artifacts                            | Test maintainers                | Implemented in `combined-report-weighted-ranking-contracts.test.ts`                                                            |
| Regenerate combined reports from committed local benchmark artifacts when source runs change                                      | Benchmark maintainers           | Ongoing                                                                                                                        |
| Preserve exact paid approval, invalid-output exclusion, repair, compaction, and regeneration evidence for every benchmark refresh | Benchmark maintainers           | Ongoing                                                                                                                        |
| Keep live calibration optional unless a compatibility claim cannot be proved from primary documentation and local contracts       | Model and benchmark maintainers | Implemented — protected by zero-cost plan helper (`audit:ocr-tokens --plan`) requiring explicit user approval before execution |

## Test Plan

1. Run `bun test test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts`.
2. Confirm every ADR-012 repository reference resolves to this file and the ADR index remains contiguous from ADR-001.
3. Run `bun run check`, `bun t --price`, and `git diff --check`.
4. Regenerate combined reports only from committed local artifacts; do not run the full test suite or invoke provider APIs as part of this verification.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — side-effect-free price and resume planning
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — OCR evidence qualification and diagnostics
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — durable model and calibration policy
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — primary-source refresh metadata
- Related ADR: [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md) — dated model changes associated with this evidence
- Related ADR: [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md) — provider-specific TTS implementation phases and remaining advanced-capability gates
- `.codex/skills/consensus/scripts/shared/combined_report_lib.ts`
- `.codex/skills/consensus/scripts/shared/combined_report_html.ts`
- `.codex/skills/consensus/scripts/stt/build_combined_report.ts`
- `.codex/skills/consensus/scripts/ocr/build_combined_report.ts`
- `.codex/skills/consensus/scripts/url/build_combined_report.ts`
- `test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts`
- `docs/benchmarks/stt/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/ocr/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/url/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/tts/2026-06-15_18-24-36-993_tts-hard/`, `docs/benchmarks/tts/2026-06-15_18-28-56-715_tts-long/`, `docs/benchmarks/tts/2026-06-15_18-51-16-094_0-tts-short/`, `docs/benchmarks/tts/2026-06-15_18-59-47-953_1-tts/`
