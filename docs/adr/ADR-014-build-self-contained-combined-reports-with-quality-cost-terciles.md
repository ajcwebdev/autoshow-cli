# ADR-014: Build Self-Contained Combined Reports with Quality-Cost Terciles

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-16
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

The consensus skill builds combined cross-run benchmark reports for STT, OCR, and URL with `bun scripts/run.ts <stt|ocr|url> build-combined-report <root_dir>`. Each builder emits a machine-readable JSON contract and a Markdown report under `docs/benchmarks/stt/`, `docs/benchmarks/ocr/`, or `docs/benchmarks/url/`.

The original 2026-07-16 decision addressed the presentation of those reports. Three pure rankings and six weighted rankings repeated the same providers across nine tables per group, followed by tier and per-run quality tables. The OCR service group made the limitation especially visible: readers had to scroll between hundreds of rows to relate a provider's quality, speed, cost, composite, and tier. Because combined reports are regenerated whenever a benchmark run is added, a hand-authored dashboard would become stale. Because the benchmark artifacts are committed and commonly opened from a checkout, the readable form also had to work offline from `file://`, without a server, build step, network request, or third-party dependency.

The 2026-07-18 revision changes the tier contract as well as documenting the expanded ranking contract. The reports now expose eight weighted rankings, so each group has eleven ranking surfaces when the three pure rankings are included. The former placement-breadth tier method classified providers by how often they appeared near the top of those surfaces. That measured versatility, but threshold counts could produce uneven tiers and did not give readers one stable quality-cost ordering to follow. The combined-report architecture needs the HTML, Markdown, and JSON forms to express the same deterministic tier membership, rank, and composite without implying a cross-group leaderboard.

Why now: STT, OCR, and URL combined reports now share an expanded ranking contract, so their generated JSON, Markdown, and offline HTML need one deterministic presentation and tiering structure before further benchmark runs are added.

## Options Considered

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

## Verification

1. Run `bun test test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts`.
2. Confirm every ADR-014 repository reference resolves to this file and the ADR index remains contiguous from ADR-001.
3. Run `git diff --check` and `bun run check`.
4. Regenerate combined reports only from committed local artifacts; do not run the full test suite or invoke provider APIs as part of this verification.

## References

- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md) (benchmark-driven pricing surfaces)
- `.codex/skills/consensus/scripts/shared/combined_report_lib.ts`
- `.codex/skills/consensus/scripts/shared/combined_report_html.ts`
- `.codex/skills/consensus/scripts/stt/build_combined_report.ts`
- `.codex/skills/consensus/scripts/ocr/build_combined_report.ts`
- `.codex/skills/consensus/scripts/url/build_combined_report.ts`
- `test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts`
- `docs/benchmarks/stt/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/ocr/combined-comparison-report.{json,md,html}`
- `docs/benchmarks/url/combined-comparison-report.{json,md,html}`
