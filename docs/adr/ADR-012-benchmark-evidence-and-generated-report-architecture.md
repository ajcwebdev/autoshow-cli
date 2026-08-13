# ADR-012: Govern Benchmark Evidence and Generated-Report Architecture

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-16
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed
- **Supersession:** Retains the complete self-contained combined-report and quality-cost-tercile decision and absorbs the paid-approval gates, calibration evidence, provider-refresh benchmark chronology, artifact repair/compaction rules, and report-regeneration evidence formerly distributed across the hosted LLM/OCR, STT, TTS/music, and image/video refresh records. Durable registry/lifecycle/capability policy belongs to ADR-010; dated model changes belong to ADR-013.

## Context

Hosted-model refreshes need an evidence lifecycle distinct from model policy and provider chronology. Primary documentation establishes identity, availability, capabilities, pricing, and limits. Local contracts establish selector, request, response, resume, pricing, and artifact behavior without credentials. `--price` establishes a no-provider execution plan and estimate. A live benchmark or calibration then requires immediate command-specific approval, and its output is trustworthy only after identity, completeness, duration/page/source, usage, artifact, and report checks pass.

The consensus skill builds combined cross-run benchmark reports for STT, OCR, and URL with `bun scripts/run.ts <stt|ocr|url> build-combined-report <root_dir>`. Each builder emits a machine-readable JSON contract and a Markdown report under `docs/benchmarks/stt/`, `docs/benchmarks/ocr/`, or `docs/benchmarks/url/`.

The original 2026-07-16 decision addressed the presentation of those reports. Three pure rankings and six weighted rankings repeated the same providers across nine tables per group, followed by tier and per-run quality tables. The OCR service group made the limitation especially visible: readers had to scroll between hundreds of rows to relate a provider's quality, speed, cost, composite, and tier. Because combined reports are regenerated whenever a benchmark run is added, a hand-authored dashboard would become stale. Because the benchmark artifacts are committed and commonly opened from a checkout, the readable form also had to work offline from `file://`, without a server, build step, network request, or third-party dependency.

The 2026-07-18 revision changes the tier contract as well as documenting the expanded ranking contract. The reports now expose eight weighted rankings, so each group has eleven ranking surfaces when the three pure rankings are included. The former placement-breadth tier method classified providers by how often they appeared near the top of those surfaces. That measured versatility, but threshold counts could produce uneven tiers and did not give readers one stable quality-cost ordering to follow. The combined-report architecture needs the HTML, Markdown, and JSON forms to express the same deterministic tier membership, rank, and composite without implying a cross-group leaderboard.

Why now: STT, OCR, and URL combined reports now share an expanded ranking contract, so their generated JSON, Markdown, and offline HTML need one deterministic presentation and tiering structure before further benchmark runs are added.

## Options Considered

### Evidence governance

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **One benchmark-evidence authority with command-specific paid approval and generated-report ownership** | Keeps source evidence, local proof, price preflight, paid execution, artifact validation, compaction, and regeneration in one auditable lifecycle | Requires modality refreshes to link here rather than embedding their own benchmark process | Covers write/OCR, STT, TTS, music, image, video, and the STT/OCR/URL combined reports |
| Keep benchmark evidence inside each refresh ADR | Keeps chronology beside model changes | Repeats approval and regeneration rules and makes cross-modality evidence hard to compare | Previously split across 4 refresh records plus this report record |
| Treat a successful provider response as sufficient evidence | Minimizes validation work | Can retain collisions, duplicated remote jobs, wrong identity, incomplete outputs, or stale derived reports | The 2026 STT and music runs each exposed exactly such post-response failures |
| Skip live evidence entirely | Avoids cost and quota risk | Leaves some compatibility, timing, usage, and artifact claims unverified | Appropriate when local contracts are sufficient, not a universal rule |

### Report presentation

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Generator-emitted, self-contained HTML beside JSON and Markdown** | Regenerates with the source data; works offline; can consolidate ranks, values, and visual encodings; remains deterministic and versionable | Requires a custom HTML/CSS/JavaScript renderer and adds a committed artifact | 3 sibling artifacts per combined report; 0 runtime dependencies |
| Markdown only | Needs no additional output format and remains easy to diff | Eleven ranking tables per group still repeat the same providers and make cross-referencing difficult | 1 presentation artifact; 11 ranking surfaces per group |
| Hand-authored dashboard | Allows unconstrained design for the current data | Goes stale after regeneration and repeats the failure mode of the superseded hand-authored OCR combined report | 1 manually maintained dashboard |
| Served dashboard that reads JSON at runtime | Supports richer interaction and runtime data loading | Requires a server and breaks the offline, self-contained artifact contract | At least 1 runtime service and 1 data request |

### Model tiering

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Three contiguous terciles of the `qualityCost` ranking** | Gives every provider one visible order; produces stable, near-equal tier sizes; is simple to reproduce in every output format | Measures position on one chosen composite rather than breadth across ranking surfaces | 3 tiers; tier sizes differ by at most 1 provider |
| Placement breadth across all eleven pure and weighted surfaces | Rewards providers that place well under several priorities | Tier sizes depend on placement thresholds; specialized surfaces can change membership; the result has no single rank to explain it | 11 ranking surfaces per group |
| Threshold-based quality-cost tiers | Can attach fixed semantic labels to composite ranges | Per-run min-max subscores are cohort-relative, so fixed thresholds would imply more absolute meaning than the scores support and could leave tiers sparse or empty | Uses cohort-relative 0–100 subscores |
| Terciles from another composite, such as balanced or `costSpeed` | Retains deterministic, near-equal groups while emphasizing another objective | Does not express the intended joint emphasis on quality and cost; selecting another objective merely moves the policy choice | 8 available weighted rankings |

## Decision

### Benchmark evidence lifecycle and paid approval

Every provider/model refresh follows this evidence order:

1. Refresh dated primary-source documentation through explicit curated selections. Preserve source URLs, refresh metadata, content hashes, token counts, and failed-fetch behavior under ADR-011. Do not infer a current model from a moving alias or secondary catalog when primary request/pricing/capability documentation is available.
2. Update the complete local contract under ADR-010 and ADR-013. Run static checks plus targeted no-network selector, ordering, pricing, provenance, request-builder, response-parser, resume, historical-normalization, CLI help, usage, and option-resolution tests.
3. Run the exact no-cost `--price` or `resume --price` command for the intended targets. Price mode must invoke no provider and mutate no manifest or raw artifact under ADR-002.
4. If live evidence is materially necessary, obtain immediate explicit approval naming the exact provider command and the reported cost or quota risk. Approval for implementation, another provider, an earlier phase, a failed attempt, or a preflight never authorizes the paid command. A correction or rerun requires fresh approval.
5. Validate returned identity, provider/model state, source coverage, page/duration counts, attempt/retry data, usage and actual cost, output integrity, and artifact uniqueness. A provider-reported success is not trustworthy when checkpoints, paths, checksums, or normalized outputs prove collision or reuse.
6. Compact only after trustworthy provider results exist. Preserve canonical result envelopes and historical identity, remove regenerable checkpoints/splits/derived files only after validation, rebuild per-run reports from the compacted artifacts, then regenerate combined JSON/Markdown/HTML and repository summaries from those same reports.

Published provider billing remains authoritative over an estimate. Recorded provider cost takes precedence over reconstructed historical rates. Benchmark estimates and actuals must name retries, reruns, billing variance, quota effects, and any excluded or invalid outputs.

Paid calibration is not a prerequisite for a compatibility or lifecycle transition when primary documentation and local mocked contracts prove request support. Provisional same-family heuristics remain labeled until qualified evidence exists. One quality/timing sample never changes published rates, and OCR calibration does not automatically become write calibration.

### Original decision: self-contained combined-report dashboards

All three combined report builders emit three sibling artifacts:

- `combined-comparison-report.json`, the data contract;
- `combined-comparison-report.md`, the diffable text report; and
- `combined-comparison-report.html`, the primary visual dashboard.

The HTML is generated, not hand-authored. A shared, category-agnostic renderer receives a view model assembled by each builder. Category differences such as group names, column labels, evidence fields, display names, and value formats are data in that model rather than separate dashboard implementations.

The resulting HTML is one file with all report data embedded at generation time, all CSS and JavaScript inline, and no network or third-party runtime dependencies. The browser script only switches among rankings that TypeScript has already computed and embedded; it does not recompute ranks or composites. The report remains readable when JavaScript is disabled and opens directly from `file://`. This keeps JSON, Markdown, and HTML on the same generated data while allowing the dashboard to consolidate the repeated ranking tables into one provider view, a weighted-ranking matrix, tier cards, and a per-run quality heatmap.

This applies to:

- STT, OCR, and URL combined cross-run report builders and their generated JSON, Markdown, and self-contained HTML artifacts.
- No production CLI flags, public APIs, single-run reports, provider execution, runtime data fetching, or cross-group leaderboards.

URL combined schema v1 uses the source reports' `rankingSurfaces.*.automatedQuality` values as quality evidence, averages present supporting WER, CER, content coverage, processing-time, and cost values, and keeps `local` and `service` aggregation independent. Optional canonical `manifest.json` item metadata supplies article titles and safe HTTP(S) inventory links. No provider execution or runtime dashboard fetching is involved.

### 2026-07-18 revision: eight rankings and quality-cost terciles

Weighted composites continue to use per-run, per-group min-max quality, speed, and cost subscores on a 0-100 scale. Quality is higher-is-better; speed and cost are lower-is-better. Provider subscores are averaged across the runs for which a value is present, and each composite is `w_q*Q + w_s*S + w_c*C`.

The exact weighted-ranking registry is:

| Key | Quality | Speed | Cost |
|---|---:|---:|---:|
| `strongQuality` | 0.80 | 0.10 | 0.10 |
| `moderateQuality` | 0.60 | 0.20 | 0.20 |
| `strongSpeed` | 0.10 | 0.80 | 0.10 |
| `moderateSpeed` | 0.20 | 0.60 | 0.20 |
| `strongCost` | 0.10 | 0.10 | 0.80 |
| `moderateCost` | 0.20 | 0.20 | 0.60 |
| `qualityCost` | 0.45 | 0.10 | 0.45 |
| `costSpeed` | 0.10 | 0.45 | 0.45 |

All rankings and tiers are computed separately within each provider group. Local, non-diarization, diarization, and other category groups are never combined into a cross-group overall leaderboard.

The current tier contract is:

- `method` is `"quality-cost-terciles-v1"`.
- `ranking` is `"qualityCost"`.
- The underlying ranking orders composite descending, then quality subscore descending, then provider key ascending. The JSON `tieBreak` value is `"composite-desc, quality-subscore-desc, providerKey-asc"`.
- For a group of `n` providers, start each tier with `floor(n / 3)` providers. Assign the first remainder provider to Tier 1 and the second to Tier 2. The resulting sizes differ by at most one: for example, eight providers split 3/3/2 and ten split 4/3/3.
- Tiers are contiguous slices of the ordered `qualityCost` ranking. Every provider appears exactly once; three tier rows are still emitted for an empty or small group.
- Each provider row inside JSON `tiering[*].tiers[*].providers` exposes `qualityCostRank` and `qualityCostComposite` alongside its identity fields.
- Markdown tier tables and HTML tier cards display matching quality-cost ranks and composites from that same tier data.

The current combined JSON report schema versions are OCR v2, STT v3, and URL v1. These versions apply only to the generated benchmark-report contracts, not the unversioned pipeline manifest. They include the eight `weightedRankings` per group and the quality-cost tier contract; they do not expose the former placement-surface counts, thresholds, or placement lists.

## Implementation Note

The architecture is implemented in:

- `.codex/skills/consensus/scripts/shared/combined_report_lib.ts` for the shared weight registry, composite ordering, tercile construction, and Markdown tier rendering;
- `.codex/skills/consensus/scripts/shared/combined_report_html.ts` for the pure self-contained dashboard renderer;
- `.codex/skills/consensus/scripts/stt/build_combined_report.ts` for STT schema v3 and category-specific aggregation/view-model assembly;
- `.codex/skills/consensus/scripts/ocr/build_combined_report.ts` for OCR schema v2 and category-specific aggregation/view-model assembly; and
- `.codex/skills/consensus/scripts/url/build_combined_report.ts` for URL schema v1, source inventory metadata, and source-ranking aggregation/view-model assembly.

The focused combined-report contract test checks the exact eight-set registry, weighted ordering and tie-breaks, tercile sizes, JSON fields, schema versions, and rank/composite parity in the committed Markdown and HTML artifacts.

### 2026 hosted-model evidence ledger

The six-to-three reorganization preserves the following completed evidence from the 2026 refreshes. ADR-013 owns which selectors changed; this section owns what was measured, approved, repaired, compacted, and regenerated.

#### Write and OCR

- A 2026-07-13 OCR resume across 14 historical benchmark directories provided 39 pages of GPT-5.6 and Claude Fable 5 evidence. Selected-provider actual cost was about `$4.76` versus an earlier estimate of about `$2.81`; copied OpenAI multipliers near `0.27–0.29` were the main error. The resulting GPT-5.6 OCR shapes are Sol 1,625 input/940 output tokens and 9,497 ms/page; Terra 1,625/743 and 5,349 ms/page; Luna 1,625/858 and 3,919 ms/page, all with multiplier `1`. Claude Fable 5 uses 2,024/869, 11,827 ms/page, multiplier `1`.
- One separately approved `kimi-k3` short-summary write probe completed on 2026-08-03 without the rejected K2.x `thinking` field. Kimi reported 661 input and 159 output tokens; actual usage cost was `0.437¢` against a `0.540¢` estimate. This proved request/usage compatibility, not general timing or OCR calibration.
- No paid Gemini 3.6/3.5, Claude Opus 5, Grok 4.5, or Kimi K3 calibration was authorized. Their same-family timing/token heuristics remain provisional. The local Kimi/Gemini token audit and promotion gate remain governed by ADR-009.
- Gemini 3.1 Flash-Lite retirement verification used primary deprecation/replacement evidence, mocked write/OCR compatibility, selector/default/expansion/resume contracts, historical-rate checks, and price preflight. No provider request was needed to move the deterministic default or retire the active selector.

#### STT

The five committed benchmark sources represented approximately 4.49 provider-audio hours per one-model pass. The seven-phase refresh planned at most 40 outputs and approximately 35.93 provider-audio hours before retries.

| Phase | Preflight and paid boundary | Outcome |
|---|---|---|
| AssemblyAI Universal-3.5 Pro + Universal-2 | Approximately `$1.80` for 10 targets; per-directory totals `0.662¢`, `6.667¢`, `26.923¢`, `45.382¢`, and `100.000¢` | All 10 outputs completed under explicit approval |
| Deepgram Nova-3 audit | Five empty estimates; suite total `free (0.000¢)` | No missing work, provider call, or regeneration required |
| Gemini 3.6 Flash | `77.60¢` for 5 targets | All 5 outputs completed; the 40-minute source recovered after transient 503 responses |
| Gladia Solaria 1 + 3 | `$5.48` for 10 targets | Eight initial outputs were trustworthy; the split 150-minute source reused one remote checkpoint across segments for both models, so two marked-success results were invalid and required a separately approved clean rerun after checkpoint isolation |
| Soniox Async v5 | `44.91¢` for 5 targets | All 5 outputs completed |
| Speechmatics Melia 1 | `57.93¢` for 5 targets | First create attempts failed before job creation because Melia requires `language: "multi"`; the corrected retry required new approval and completed all 5 outputs |
| Together Parakeet | `40.42¢` for 5 targets | All 5 completed; the 150-minute source recovered through adaptive splitting after a 103 MB multipart request failed, establishing a conservative 20 MiB operational split cap |

The first approved `$3.63` corrected rerun stopped locally before dispatch because resume reconstructed compacted successes only from removed `transcription.txt` files. Resume was corrected to prefer structured `result.json` with the legacy file as fallback. A renewed explicit approval completed the seven remaining targets: five corrected Melia outputs plus clean five-segment Solaria 1 and 3 outputs. Each Gladia segment had a distinct remote job, and each model's normalized segment hashes were distinct.

The final five manifests contain 40 trustworthy current outputs with no failed requested provider. Compaction promoted exactly 40 `providers/*/result.json` files and removed 42 derived transcript, checkpoint, and split-audio files totaling 217,251,567 bytes. The five per-run `reference-comparison-report.{json,md}` pairs, `combined-comparison-report.{json,md,html}`, and `docs/benchmarks/summary.md` were regenerated from the compacted artifacts. The combined report contains 26 historical/current provider identities across five runs, retains grouped rankings only, and has no cross-group leaderboard.

#### TTS and music

- The TTS selector and provider-catalog refresh used local/no-network evidence only. All 117 global TTS links succeeded; focused contracts proved the 26 xAI, 91 Deepgram Aura-2, and 30 Gemini voice catalogs, disjoint Groq English/Arabic voices, 109 active hosted TTS selectors, OpenAI model-specific voice rules, typed custom-voice serialization, and final Arabic request construction. No hosted synthesis call was made.
- The music refresh preflight estimated duration-matched ElevenLabs Music v2 additions at `15.00¢`, `30.00¢`, `7.50¢`, and `45.00¢` for 60, 120, 30, and 180 seconds, totaling `97.50¢`. Four MiniMax Music 3.0 additions with generated lyrics were `16.00¢` each, totaling `64.00¢`.
- The first approved eight-request pass completed provider work but exposed an additive-resume collision: a shared `generated-music.mp3` let later MiniMax outputs overwrite four ElevenLabs files while both entries pointed at the same path. Resume now promotes additive outputs to provider/model-specific names before metadata merge. The four MiniMax artifacts were repaired and validated with `ffprobe`.
- A separately approved `97.50¢` ElevenLabs rerun completed without retries in 11.685, 19.982, 8.300, and 22.055 seconds. The preserved Music v2 files record 48 kHz, 192 kbps `mp3_48000_192` output and requested durations 30/60/120/180 seconds; playable durations were 30.024/60.024/120.024/180.024 seconds. Estimated cumulative provider work across the original pass and rerun was `$2.59` before billing adjustments.

#### Image and video

- All 35 global video links succeeded. The image refresh fetched 36 of 39 global links and recovered all three Reve failures through the permitted provider-scoped retry. Evidence and `.refresh.json` metadata remained under gitignored `project/links/`.
- Image/fal.ai implementation verification used mocked queue submission, polling, cancellation/result download, metadata, selection, links, price, and resume contracts for five image and two video selectors. No fal.ai generation ran.
- Existing-provider video verification passed 68 targeted request, selection, option-resolution, pricing, provenance, and budget-registry contracts with no hosted generation.
- The Veo REST response-shape audit passed 14 focused Gemini contracts plus CLI help/usage/option-resolution. Reintroducing SDK-normalized `videoBytes`/`mimeType` aliases made provenance fail; retaining raw REST `encodedVideo`/`encoding` restored the published boundary.

#### Shared no-cost verification

The consolidation baseline is `bun run check` plus `bun t --price`. On 2026-08-13 the price runner checked all 165 mapped commands with zero failures and a suite estimate of `1420.395¢`; price mode made no provider call. Targeted registry, reasoning, pricing, resume, report, and provider-adapter contracts supplement that baseline without running the paid suite.

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
- Tiering no longer measures breadth across the three pure rankings and the other weighted rankings. Those surfaces remain available for analysis, but they do not influence tier membership.
- Choosing `qualityCost` makes the 45/10/45 policy explicit; consumers that prefer another objective must use the corresponding ranking rather than reinterpret the tiers.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Generated, always-current HTML from the same builders as JSON and Markdown | Custom renderer maintenance and committed HTML diffs |
| Offline single-file dashboard with no dependencies | No runtime data loading or external charting library |
| Stable, near-equal, explainable quality-cost tiers | No tier-level measure of breadth across pure and alternative weighted rankings |
| One per-group tier order shared by JSON, Markdown, and HTML | No cross-group leaderboard and no absolute-score tier thresholds |

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Keep the eight-ranking registry, ordering rules, and tercile construction shared across STT, OCR, and URL builders | Report maintainers | Implemented in `combined_report_lib.ts` |
| Generate JSON, Markdown, and self-contained HTML from the same category view models | Report maintainers | Implemented in the shared renderer and category builders |
| Validate schema versions, tie-breaks, tier sizes, and rank/composite parity across committed artifacts | Test maintainers | Implemented in `combined-report-weighted-ranking-contracts.test.ts` |
| Regenerate combined reports from committed local benchmark artifacts when source runs change | Benchmark maintainers | Ongoing |
| Preserve exact paid approval, invalid-output exclusion, repair, compaction, and regeneration evidence for every benchmark refresh | Benchmark maintainers | Ongoing |
| Keep live calibration optional unless a compatibility claim cannot be proved from primary documentation and local contracts | Model and benchmark maintainers | Complete — protected by zero-cost plan helper (`audit:ocr-tokens --plan`) requiring explicit user approval before execution |

## Test Plan

1. Run `bun test test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts`.
2. Confirm every ADR-012 repository reference resolves to this file and the ADR index remains contiguous from ADR-001.
3. Run `git diff --check` and `bun run check`.
4. Regenerate combined reports only from committed local artifacts; do not run the full test suite or invoke provider APIs as part of this verification.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — side-effect-free price and resume planning
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — OCR evidence qualification and diagnostics
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — durable model and calibration policy
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — primary-source refresh metadata
- Related ADR: [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md) — dated model changes associated with this evidence
- `.codex/skills/consensus/scripts/shared/combined_report_lib.ts`
- `.codex/skills/consensus/scripts/shared/combined_report_html.ts`
- `.codex/skills/consensus/scripts/stt/build_combined_report.ts`
- `.codex/skills/consensus/scripts/ocr/build_combined_report.ts`
- `.codex/skills/consensus/scripts/url/build_combined_report.ts`
- `test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts`
- `docs/benchmarks/stt/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/ocr/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/url/combined-comparison-report.{json,md,html}`
