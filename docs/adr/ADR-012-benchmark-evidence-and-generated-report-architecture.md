# ADR-012: Govern Benchmark Evidence and Generated-Report Architecture

## Status

- **Decision Status:** Superseded
- **Date Created:** 2026-07-16
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** The CLI `benchmark` command was removed. This record remains historical for committed `docs/benchmarks/` run data, consensus-skill combined reports, the quality-cost tier contract, paid-approval gates, calibration evidence, and artifact repair/compaction rules. Durable registry, lifecycle, and capability policy belongs to [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md). Dated model changes belong to the 2026 hosted-model refresh reports under `docs/models/`.

## Context

Hosted-model refreshes need an evidence lifecycle distinct from model policy and provider chronology. Primary documentation establishes identity, availability, capabilities, pricing, and limits. Local contracts establish selector, request, response, resume, pricing, and artifact behavior without credentials. `--price` establishes a no-provider execution plan and estimate. A live benchmark or calibration then requires immediate command-specific approval, and its output is trustworthy only after identity, completeness, duration/page/source, usage, artifact, and report checks pass.

The consensus skill builds combined cross-run benchmark reports for STT, OCR, and URL with `bun scripts/run.ts <stt|ocr|url> build-combined-report <root_dir>`. Each builder emits a machine-readable JSON contract and a Markdown report under `docs/benchmarks/stt/`, `docs/benchmarks/ocr/`, or `docs/benchmarks/url/`.

Presentation is constrained by how those artifacts are produced and read. Each group carries eleven ranking surfaces — three pure and eight weighted — so a Markdown-only report repeats the same providers across eleven tables and forces readers to scroll between hundreds of rows to relate one provider's quality, speed, cost, composite, and tier. Combined reports are regenerated whenever a benchmark run is added, so any hand-authored dashboard goes stale. The artifacts are committed and commonly opened from a checkout, so the readable form must work offline from `file://` without a server, build step, network request, or third-party dependency.

Tiering is constrained by the same regeneration requirement. Tier membership must be reproducible identically in the HTML, Markdown, and JSON forms from data the builders already compute, must give readers one stable ordering to follow, and must not imply a cross-group leaderboard.

Why now: STT, OCR, and URL combined reports share an expanded ranking contract, so their generated JSON, Markdown, and offline HTML need one deterministic presentation and tiering structure before further benchmark runs are added.

## Options Considered

### Evidence governance

**Option 1 (selected)**

- **Option:** One benchmark-evidence authority with command-specific paid approval and generated-report ownership
- **Pros:** Keeps source evidence, local proof, price preflight, paid execution, artifact validation, compaction, and regeneration in one auditable lifecycle
- **Cons:** Requires modality refreshes to link here rather than embedding their own benchmark process
- **Quantitative Notes:** Covers write/OCR, STT, TTS, music, image, video, and the STT/OCR/URL combined reports

**Option 2**

- **Option:** Keep benchmark evidence inside each refresh ADR
- **Pros:** Keeps chronology beside model changes
- **Cons:** Repeats approval and regeneration rules and makes cross-modality evidence hard to compare
- **Quantitative Notes:** Previously split across 4 refresh records plus this report record

**Option 3**

- **Option:** Treat a successful provider response as sufficient evidence
- **Pros:** Minimizes validation work
- **Cons:** Can retain collisions, duplicated remote jobs, wrong identity, incomplete outputs, or stale derived reports
- **Quantitative Notes:** The 2026 STT and music runs each exposed exactly such post-response failures

**Option 4**

- **Option:** Skip live evidence entirely
- **Pros:** Avoids cost and quota risk
- **Cons:** Leaves some compatibility, timing, usage, and artifact claims unverified
- **Quantitative Notes:** Appropriate when local contracts are sufficient, not a universal rule

### Report presentation

**Option 1 (selected)**

- **Option:** Generator-emitted, self-contained HTML beside JSON and Markdown
- **Pros:** Regenerates with the source data; works offline; can consolidate ranks, values, and visual encodings; remains deterministic and versionable
- **Cons:** Requires a custom HTML/CSS/JavaScript renderer and adds a committed artifact
- **Quantitative Notes:** 3 sibling artifacts per combined report; 0 runtime dependencies

**Option 2**

- **Option:** Markdown only
- **Pros:** Needs no additional output format and remains easy to diff
- **Cons:** Eleven ranking tables per group still repeat the same providers and make cross-referencing difficult
- **Quantitative Notes:** 1 presentation artifact; 11 ranking surfaces per group

**Option 3**

- **Option:** Hand-authored dashboard
- **Pros:** Allows unconstrained design for the current data
- **Cons:** Goes stale after regeneration
- **Quantitative Notes:** 1 manually maintained dashboard

**Option 4**

- **Option:** Served dashboard that reads JSON at runtime
- **Pros:** Supports richer interaction and runtime data loading
- **Cons:** Requires a server and breaks the offline, self-contained artifact contract
- **Quantitative Notes:** At least 1 runtime service and 1 data request

### Model tiering

**Option 1 (selected)**

- **Option:** Three contiguous terciles of the `qualityCost` ranking
- **Pros:** Gives every provider one visible order; produces stable, near-equal tier sizes; is simple to reproduce in every output format
- **Cons:** Measures position on one chosen composite rather than breadth across ranking surfaces
- **Quantitative Notes:** 3 tiers; tier sizes differ by at most 1 provider

**Option 2**

- **Option:** Placement breadth across all eleven pure and weighted surfaces
- **Pros:** Rewards providers that place well under several priorities
- **Cons:** Tier sizes depend on placement thresholds; specialized surfaces can change membership; the result has no single rank to explain it
- **Quantitative Notes:** 11 ranking surfaces per group

**Option 3**

- **Option:** Threshold-based quality-cost tiers
- **Pros:** Can attach fixed semantic labels to composite ranges
- **Cons:** Per-run min-max subscores are cohort-relative, so fixed thresholds would imply more absolute meaning than the scores support and could leave tiers sparse or empty
- **Quantitative Notes:** Uses cohort-relative 0–100 subscores

**Option 4**

- **Option:** Terciles from another composite, such as balanced or `costSpeed`
- **Pros:** Retains deterministic, near-equal groups while emphasizing another objective
- **Cons:** Does not express the intended joint emphasis on quality and cost; selecting another objective merely moves the policy choice
- **Quantitative Notes:** 8 available weighted rankings

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
- Dated hosted-model refresh chronology and selector changes (recorded in the 2026 hosted-model refresh reports under `docs/models/`).
- Single-run execution manifests, runtime data fetching, or cross-group overall leaderboards.

### Benchmark evidence lifecycle and paid approval

Every provider/model refresh follows this evidence order:

1. Refresh dated primary-source documentation under [ADR-011](ADR-011-add-refresh-metadata-to-links.md). Do not infer a current model from a moving alias or secondary catalog when primary request, pricing, or capability documentation is available.
2. Update the complete local contract under [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) and the 2026 hosted-model refresh reports under `docs/models/`. Run static checks plus targeted no-network tests.
3. Run the exact no-cost `--price` or `resume --price` command for the intended targets. Price mode must invoke no provider and mutate no manifest or raw artifact under [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).
4. If live evidence is materially necessary, obtain immediate explicit approval naming the exact provider command and the reported cost or quota risk. Approval for implementation, another provider, an earlier phase, a failed attempt, or a preflight never authorizes the paid command. A correction or rerun requires fresh approval.
5. Validate returned identity, provider/model state, source coverage, page/duration counts, attempt/retry data, usage and actual cost, output integrity, and artifact uniqueness. A provider-reported success is not trustworthy when checkpoints, paths, checksums, or normalized outputs prove collision or reuse.
6. Compact only after trustworthy provider results exist. Preserve canonical result envelopes and historical identity, remove regenerable checkpoints, splits, and derived files only after validation, rebuild per-run reports from the compacted artifacts, then regenerate combined JSON, Markdown, and HTML and repository summaries from those same reports.

Published provider billing remains authoritative over an estimate. Recorded provider cost takes precedence over reconstructed historical rates. Benchmark estimates and actuals must name retries, reruns, billing variance, quota effects, and any excluded or invalid outputs.

Paid calibration is not a prerequisite for a compatibility or lifecycle transition when primary documentation and local mocked contracts prove request support. Provisional same-family heuristics remain labeled until qualified evidence exists. One quality/timing sample never changes published rates, and OCR calibration does not automatically become write calibration.

### Self-contained combined-report dashboards

All three combined report builders emit three sibling artifacts:

- `combined-comparison-report.json`, the data contract;
- `combined-comparison-report.md`, the diffable text report; and
- `combined-comparison-report.html`, the primary visual dashboard.

The HTML is generated from the same data as JSON and Markdown, not hand-authored. Each file embeds its report data, CSS, and JavaScript at generation time, with no network or third-party runtime dependencies. The report remains readable when JavaScript is disabled and opens directly from `file://`. The dashboard consolidates the repeated ranking tables into one provider view, a weighted-ranking matrix, tier cards, and a per-run quality heatmap.

### Weighted rankings and quality-cost terciles

Weighted composites use per-run, per-group min-max quality, speed, and cost subscores on a 0-100 scale. Quality is higher-is-better; speed and cost are lower-is-better. Provider subscores are averaged across the runs for which a value is present, and each composite is `w_q*Q + w_s*S + w_c*C`.

The exact weighted-ranking registry is:

**Ranking 1: `strongQuality`**

- **Quality:** 0.80
- **Speed:** 0.10
- **Cost:** 0.10

**Ranking 2: `moderateQuality`**

- **Quality:** 0.60
- **Speed:** 0.20
- **Cost:** 0.20

**Ranking 3: `strongSpeed`**

- **Quality:** 0.10
- **Speed:** 0.80
- **Cost:** 0.10

**Ranking 4: `moderateSpeed`**

- **Quality:** 0.20
- **Speed:** 0.60
- **Cost:** 0.20

**Ranking 5: `strongCost`**

- **Quality:** 0.10
- **Speed:** 0.10
- **Cost:** 0.80

**Ranking 6: `moderateCost`**

- **Quality:** 0.20
- **Speed:** 0.20
- **Cost:** 0.60

**Ranking 7: `qualityCost`**

- **Quality:** 0.45
- **Speed:** 0.10
- **Cost:** 0.45

**Ranking 8: `costSpeed`**

- **Quality:** 0.10
- **Speed:** 0.45
- **Cost:** 0.45

All rankings and tiers are computed separately within each provider group. Local, non-diarization, diarization, and other category groups are never combined into a cross-group overall leaderboard.

The tier contract is:

- Method `quality-cost-terciles-v1` slices the `qualityCost` ranking.
- The ranking orders composite descending, then quality subscore descending, then provider key ascending.
- For a group of `n` providers, start each tier with `floor(n / 3)` providers. Assign the first remainder provider to Tier 1 and the second to Tier 2. The resulting sizes differ by at most one: for example, eight providers split 3/3/2 and ten split 4/3/3.
- Tiers are contiguous slices of the ordered `qualityCost` ranking. Every provider appears exactly once; three tier rows are still emitted for an empty or small group.
- JSON, Markdown, and HTML display matching quality-cost ranks and composites from that same tier data.

## Rationale

- Mechanical generation is the only way to keep the visual report current with the JSON and Markdown artifacts after every benchmark update.
- A shared renderer keeps category differences explicit while preventing separate STT, OCR, and URL dashboards from drifting.
- Embedded data, inline assets, and zero dependencies preserve deterministic, offline use from a repository checkout.
- Precomputing ranks and composites once gives all three formats one source of truth; the browser is a presentation layer only.
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

**Trade-off 1**

- **Gain:** Generated, always-current HTML from the same builders as JSON and Markdown
- **Sacrifice:** Custom renderer maintenance and committed HTML diffs

**Trade-off 2**

- **Gain:** Offline single-file dashboard with no dependencies
- **Sacrifice:** No runtime data loading or external charting library

**Trade-off 3**

- **Gain:** Stable, near-equal, explainable quality-cost tiers
- **Sacrifice:** No tier-level measure of breadth across pure and alternative weighted rankings

**Trade-off 4**

- **Gain:** One per-group tier order shared by JSON, Markdown, and HTML
- **Sacrifice:** No cross-group leaderboard and no absolute-score tier thresholds

## Implementation Note

The report architecture ships in `.codex/skills/consensus/scripts/`: shared weight registry, ordering, terciles, and Markdown rendering in `shared/combined_report_lib.ts`; the self-contained dashboard renderer in `shared/combined_report_html.ts`; and STT, OCR, and URL combined-report builders under `stt/`, `ocr/`, and `url/`. Combined-report contracts live in `test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts`. Live calibration remains optional when primary documentation and local contracts already prove compatibility; `bun run audit:ocr-tokens --plan` is the zero-cost OCR planning helper and still requires explicit approval before execution.

Committed run data and generated reports live under `docs/benchmarks/`. Dated selector changes live in the 2026 hosted-model refresh reports under `docs/models/`.

## Test Plan

Run default verification and the local combined-report contract:

```bash
bun run check
bun t --price
git diff --check
bun test test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts
```

1. `bun run check` and `git diff --check` prove the ADR remains well-formed.
2. `bun t --price` proves the no-cost planning surface still runs.
3. The weighted-ranking contract test proves the eight-set registry, ordering and tie-breaks, tercile sizes, and rank/composite parity across committed JSON, Markdown, and HTML artifacts.

Do not regenerate reports from live provider calls, run the full test suite, or invoke paid APIs as part of this verification.

## Follow-up Actions

- [ ] Regenerate combined reports from committed local benchmark artifacts when source runs change — Ongoing
- [ ] Preserve exact paid approval, invalid-output exclusion, repair, compaction, and regeneration evidence for every benchmark refresh — Ongoing

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — side-effect-free price and resume planning
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — OCR evidence qualification and diagnostics
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — durable model and calibration policy
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — primary-source refresh metadata
- Related reports: the 2026 hosted-model refresh reports under `docs/models/`
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) — provider-specific TTS implementation phases and remaining advanced-capability gates
- `.codex/skills/consensus/scripts/shared/combined_report_lib.ts`
- `.codex/skills/consensus/scripts/shared/combined_report_html.ts`
- `.codex/skills/consensus/scripts/stt/build_combined_report.ts`
- `.codex/skills/consensus/scripts/ocr/build_combined_report.ts`
- `.codex/skills/consensus/scripts/url/build_combined_report.ts`
- `test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts`
- `docs/benchmarks/stt/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/ocr/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/url/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/`
