# ADR-016: Refresh Current Hosted STT Models

## Status

- **Decision Status:** Proposed
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-03
- **Verification Status:** Pending

## Context

AutoShow's hosted speech-to-text registry is a public CLI and benchmark surface. Accepted model arrays drive provider flags, bare-provider defaults, `--all-stt` expansion, resume identities, artifact directories, pricing, benchmark discovery, help, and service tests. The config fragments under `stt-config/` supply the associated billing rules, file and duration limits, and timing estimates.

A 2026-08-03 curated-link refresh found stale selectors and current batch models across seven existing providers. The refresh made no transcription request. The evidence is summarized in `project/links/stt-model-gap-report-2026-08-03.md`.

This decision intentionally covers only concrete, general-purpose, hosted models compatible with AutoShow's batch transcription lifecycle. It excludes medical and other domain-specific models, streaming and realtime models, dedicated deployments, human transcription, retrieval modes, and moving aliases. Examples excluded by this rule include `nova-3-medical`, Together Nemotron streaming models, Together dedicated Deepgram deployments, Deepgram Flux, Mistral Realtime, Happy Scribe `pro`, and Supadata retrieval-mode expansion.

The active hosted registry contains 18 entries before this work. Completing all phases below will produce 22 entries. Eight new or replacement benchmark targets will add at most 40 outputs across the five committed STT runs, representing approximately 35.93 provider-audio hours before retries.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Refresh providers alphabetically in independently verified phases** | Bounds implementation and paid execution; makes provider-specific failures attributable; preserves a reviewable approval gate | Takes more passes than one registry-wide change | 7 phases; 8 benchmark targets; at most 40 outputs and approximately 35.93 provider-audio hours |
| Refresh every provider in one change and one paid run | Minimizes command repetition | Couples unrelated adapters, pricing decisions, and provider failures; creates a large paid approval | Up to 40 new outputs in one execution gate |
| Update validators only | Small diff | Creates selectors whose request, pricing, or resume behavior may be incorrect | No trustworthy runtime coverage |
| Add every documented STT identifier | Maximizes apparent coverage | Mixes specialized, streaming, dedicated, human, and retrieval products into a batch model selector | Unbounded and architecture-changing |
| Keep the current registry | Preserves current configs | Leaves stale or retired selectors active | No implementation cost; known drift remains |

## Decision

Refresh general-purpose hosted STT models alphabetically by provider. Each phase ends with local/no-cost verification, a no-cost price preflight, explicit approval naming the exact paid provider command and its estimated cost or quota risk, provider-specific benchmark resume, and local report regeneration. Approval for implementation or for one phase never authorizes another paid run.

The provider phases are:

| Phase | Provider and active-model change | Benchmark addition |
|---|---|---:|
| 1 | AssemblyAI: replace `universal-3-pro` with `universal-3-5-pro` and `universal-2` | 10 outputs / approximately 8.98 provider-audio hours |
| 2 | Deepgram: retain `nova-3`; explicitly exclude specialized variants | None; already benchmarked |
| 3 | Gemini: replace `gemini-3-flash-preview` with `gemini-3.6-flash` | 5 outputs / approximately 4.49 provider-audio hours |
| 4 | Gladia: replace `default` with `solaria-1` and `solaria-3` | 10 outputs / approximately 8.98 provider-audio hours |
| 5 | Soniox: replace `stt-async-v4` with `stt-async-v5` | 5 outputs / approximately 4.49 provider-audio hours |
| 6 | Speechmatics: retain `enhanced` and add `melia-1` | 5 outputs / approximately 4.49 provider-audio hours |
| 7 | Together: retain `openai/whisper-large-v3` and add `nvidia/parakeet-tdt-0.6b-v3` | 5 outputs / approximately 4.49 provider-audio hours |

Across all phases, use concrete provider IDs and retain existing selectors only when they remain current and general purpose. Reuse same-provider timing estimates only as explicitly provisional values until an approved calibration exists. Preserve successful historical output identities. If a manifest still needs work from a model removed from the active registry, resume must fail with replacement instructions instead of silently changing the target key.

### Phase 1: AssemblyAI

Phase 1 makes these bounded changes:

- Active AssemblyAI selectors are `universal-3-5-pro` and `universal-2`, in that order. `universal-3-pro` remains readable in historical benchmark and report artifacts but is rejected as a new selection.
- Bare `--provider assemblyai` follows the standard cheapest-model rule and selects `universal-2`. `--all-providers` includes both active models. The flagship model requires an explicit selector.
- The adapter retains its asynchronous upload, create, and poll lifecycle. The create body sends the selected model as the singleton `speech_models: [model]`, enables `speaker_labels`, and includes `speakers_expected` when the user supplies a speaker count.
- Pricing uses diarization-inclusive effective rates of `$0.23/hour` for Universal-3.5 Pro and `$0.17/hour` for Universal-2, checked 2026-08-03. Both use cost multiplier `1`, preserve the existing upload and 10-hour duration limits, and label the reused `188 ms/second` timing estimate provisional.
- Resume accepts completed `universal-3-pro` artifacts as historical results. An incomplete stored `universal-3-pro` target fails before price calculation or provider execution and directs the user to start a new explicit `universal-3-5-pro` or `universal-2` target.
- Curated AssemblyAI links cover both active model pages plus transcript submit and get references.

No public TypeScript type shape changes. Accepted values change for `--assemblyai-stt`, `--provider assemblyai=<model>`, and `--stt assemblyai=<model>`.

### Phase 2: Deepgram

Phase 2 is a no-op model audit. The refreshed Deepgram request schema enumerates `nova-3`, `nova-3-general`, and `nova-3-medical`. AutoShow retains only `nova-3` as the concrete general-purpose family selector. The redundant `nova-3-general` specialization and domain-specific `nova-3-medical` model are explicitly rejected and excluded from all-provider expansion.

The existing pre-recorded adapter remains compatible with `nova-3`; no request, rate, service-test, or benchmark target changes are needed. It continues to request diarization, utterances, punctuation, and smart formatting. The official pricing page still lists pre-recorded Nova-3 Monolingual at `$0.0077/minute` and speaker diarization at `$0.0020/minute`, preserving AutoShow's diarization-inclusive `$0.0097/minute` or `$0.582/hour` estimate; only `pricingCheckedAt` advances to 2026-08-03. Every committed STT benchmark already records `deepgram/nova-3` as succeeded, so Phase 2 adds no outputs, requires no paid provider call, and does not trigger report regeneration.

### Phase 3: Gemini

Phase 3 replaces the retired `gemini-3-flash-preview` STT selector with the concrete `gemini-3.6-flash` model. The existing multimodal GenerateContent and Files API adapter remains in place. Completed historical preview artifacts remain reportable, while unfinished preview targets fail with an explicit `--provider gemini=gemini-3.6-flash` replacement instruction.

Gemini 3.6 Flash Standard pricing is `$1.50/1M` input tokens and `$7.50/1M` output tokens including thinking tokens, checked 2026-08-03. The duration preflight uses the documented 32 audio tokens/second input baseline, producing `$0.1728/hour`; completed requests compute selected-model billing from returned usage metadata. Existing upload handling and limits remain unchanged, cost multiplier remains `1`, and the reused `892 ms/second` timing estimate is provisional.

### Phase 4: Gladia

Phase 4 replaces the non-identifying `default` sentinel with `solaria-1` and `solaria-3`, in that order. Bare `--provider gladia` selects the tied cheapest model `solaria-1`, while all-provider expansion includes both. The asynchronous upload/create/poll adapter now sends the selected model in the create body and preserves diarization plus an optional exact speaker-count hint through a locally testable request builder.

Both models use Gladia's public pre-recorded rate of `$0.61/hour`, checked 2026-08-03. Existing upload and 8,100-second duration limits remain unchanged, cost multiplier remains `1`, and the reused `284 ms/second` timing estimate is provisional. Completed historical `default` artifacts remain reportable, while unfinished targets fail with explicit Solaria replacement selectors.

### Phase 5: Soniox

Phase 5 replaces the aliased `stt-async-v4` selector with the active concrete `stt-async-v5` model. Soniox documents v5 as fully compatible with the existing async API, so the upload/create/poll/transcript adapter remains in place. Its locally testable create request sends the selected model and file identity and enables speaker diarization unless explicitly disabled.

Soniox's token-based public pricing is equivalent to approximately `$0.10/hour` for async file transcription and includes diarization, language identification, and formatting, checked 2026-08-03. Existing 500 MB upload and 18,000-second duration limits remain unchanged, cost multiplier is `1`, and the reused `139 ms/second` timing estimate is provisional. Completed historical `stt-async-v4` artifacts remain reportable, while unfinished targets fail with an explicit `--provider soniox=stt-async-v5` replacement instruction.

### Phase 6: Speechmatics

Phase 6 retains `enhanced` and adds the concrete batch-only `melia-1` model. The batch upload/create/poll lifecycle remains in place, but request construction now uses the current `model` field instead of deprecated `operating_point`. Enhanced sends `language: "auto"`; Melia sends the required `language: "multi"` value for multilingual detection and code-switching. Both requests enable speaker diarization.

Current public batch rates are `$0.40/hour` for Enhanced and `$0.129/hour` for Melia 1 with diarization included, checked 2026-08-03. Existing 1 GB multipart limits remain unchanged, cost multiplier is `1`, and Melia provisionally reuses the Enhanced `218 ms/second` timing estimate. Bare `--provider speechmatics` follows the cheapest-model rule and selects `melia-1`, while all-provider expansion includes both models. Existing Enhanced benchmark artifacts remain valid; Phase 6 adds only five Melia outputs.

## Rationale

- A provider model selector is a runtime promise, so validation, request construction, pricing, help, tests, and resume identity must move together.
- Alphabetical phases keep each paid benchmark gate small and make provider-specific outcomes easy to audit.
- The general-purpose rule prevents a routine model refresh from committing the CLI to domain modes, streaming transports, dedicated endpoints, or non-STT service products.
- Concrete model IDs keep manifests and benchmark comparisons reproducible.
- The cheapest-model rule keeps bare AssemblyAI execution economical while preserving explicit access to the flagship model.
- Refusing to relabel unfinished historical work prevents a new transcript from being stored under an old model identity.

## Consequences

Positive outcomes:

- AssemblyAI, Gemini, Gladia, Soniox, and Speechmatics current general-purpose batch models become selectable with stable identities.
- Price preflight includes diarization and uses current published effective rates.
- Request construction is locally testable without credentials or provider calls.
- Historical completed results remain valid inputs to reports and additive resume.
- Each later provider remains isolated behind its own verification and paid approval gate.

Negative outcomes:

- Explicit configs naming `universal-3-pro` must migrate.
- An incomplete retired-model target cannot be completed in place because doing so would misstate model identity.
- `--all-providers` adds one AssemblyAI and one Gladia paid target while replacing the historical Gemini target.
- Timing estimates remain provisional until separately approved benchmark data exists.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Truthful current selectors and prices | Compatibility with stale explicit model values |
| Reproducible concrete identities | No moving aliases or silent substitutions |
| Small provider-specific approval gates | More phased verification and reporting passes |
| General-purpose batch scope | Specialized, streaming, dedicated, human, and retrieval products remain unavailable |

## Test Plan

Phase 1 local/no-cost verification:

```bash
bun run check
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/providers/provider-selection-contracts/model-flags-and-ordering.test.ts
bun test test/test-cases/validation/providers/assemblyai-rest-contracts.test.ts
bun test test/test-cases/validation/ingest/input-contracts.test.ts
bun test test/test-cases/validation/extract-stt/stt-split-resilience-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/
bun test test/test-cases/price-flag/stt-price.test.ts
git diff --check
```

Do not run `bun run t`, the full test runner, service E2E files, or any hosted transcription command as implementation verification.

The restored Autogen source at `input/2024-04-10-autogen-shownotes-jenn-junod.mp4` is a valid MP4 with duration 4,084.366 seconds. Its path and rounded duration match the manifest's stored 4,084-second duration. No historical checksum exists, so that match is the accepted source verification for this benchmark.

After local verification, run this no-cost Phase 1 preflight:

```bash
stt_benchmark_dirs=(
  docs/benchmarks/stt/2026-06-15_14-29-11-559_1-audio
  docs/benchmarks/stt/2026-06-15_14-34-10-342_2023-04-05-jsjam-react-miami-2023-10-minutes
  docs/benchmarks/stt/2026-06-15_14-43-25-724_2022-09-30-widgets-fsjam-40-minutes
  docs/benchmarks/stt/2026-07-16_01-20-11-985_2024-04-10-autogen-shownotes-jenn-junod
  docs/benchmarks/stt/2026-07-16_01-27-21-117_barnum-with-robert-balicki
)

bun autoshow resume "${stt_benchmark_dirs[@]}" \
  --provider assemblyai=universal-3-5-pro \
  --provider assemblyai=universal-2 \
  --provider-concurrency 2 \
  --stt-segment-concurrency 1 \
  --price
```

The expected estimate is approximately `$1.80`, but the command output is authoritative. The corresponding paid run creates at most ten outputs over approximately 8.98 provider-audio hours before retries. It must not run until the user immediately approves the exact same two-model command without `--price` and acknowledges its reported cost or quota risk.

After all target results succeed, locally regenerate all five per-run `reference-comparison-report.{json,md}` pairs, compact provider results, rebuild all five report pairs from the compacted artifacts, refresh `combined-comparison-report.{json,md,html}`, and synchronize `docs/benchmarks/summary.md`. The HTML artifact is the self-contained STT dashboard and must be regenerated from the same completed per-run reports as the combined JSON and Markdown. Preserve the historical `universal-3-pro` artifacts and report rows.

Phase 2 uses the same five-directory array with only the already-benchmarked target:

```bash
bun autoshow resume "${stt_benchmark_dirs[@]}" \
  --provider deepgram=nova-3 \
  --provider-concurrency 1 \
  --stt-segment-concurrency 1 \
  --price
```

The Phase 2 audit completed with five empty estimates and a suite total of `free (0.000¢)`, confirming there is no missing Deepgram benchmark work. Because no target needs execution, there is no corresponding paid command or report regeneration step.

Phase 3 uses the same five-directory array:

```bash
bun autoshow resume "${stt_benchmark_dirs[@]}" \
  --provider gemini=gemini-3.6-flash \
  --provider-concurrency 1 \
  --stt-segment-concurrency 1 \
  --price
```

The authoritative Phase 3 estimate is `77.60¢` for five outputs over approximately 4.49 provider-audio hours. The corresponding command without `--price` requires immediate explicit approval naming Gemini and that estimate.

Phase 4 uses the same five-directory array:

```bash
bun autoshow resume "${stt_benchmark_dirs[@]}" \
  --provider gladia=solaria-1 \
  --provider gladia=solaria-3 \
  --provider-concurrency 2 \
  --stt-segment-concurrency 1 \
  --price
```

The authoritative Phase 4 estimate is `$5.48` for ten outputs over approximately 8.98 provider-audio hours. The corresponding command without `--price` requires immediate explicit approval naming both Gladia models and that estimate.

Phase 5 uses the same five-directory array:

```bash
bun autoshow resume "${stt_benchmark_dirs[@]}" \
  --provider soniox=stt-async-v5 \
  --provider-concurrency 1 \
  --stt-segment-concurrency 1 \
  --price
```

The authoritative Phase 5 estimate is `44.91¢` for five outputs over approximately 4.49 provider-audio hours. The corresponding command without `--price` requires immediate explicit approval naming Soniox v5 and that estimate.

Phase 6 uses the same five-directory array for the new model only:

```bash
bun autoshow resume "${stt_benchmark_dirs[@]}" \
  --provider speechmatics=melia-1 \
  --provider-concurrency 1 \
  --stt-segment-concurrency 1 \
  --price
```

The authoritative Phase 6 estimate is `57.93¢` for five outputs over approximately 4.49 provider-audio hours. The corresponding command without `--price` requires immediate explicit approval naming Speechmatics Melia 1 and that estimate.

Phase 7 uses the same five-directory array for the new model only:

```bash
bun autoshow resume "${stt_benchmark_dirs[@]}" \
  --provider together=nvidia/parakeet-tdt-0.6b-v3 \
  --provider-concurrency 1 \
  --stt-segment-concurrency 1 \
  --price
```

The authoritative Phase 7 estimate is `40.42¢` for five outputs over approximately 4.49 provider-audio hours. The corresponding command without `--price` requires immediate explicit approval naming Together Parakeet and that estimate.

## Implementation Note

Phase 1 implementation and local verification are complete as of 2026-08-03. Registry, adapter request builder, pricing, help, documentation, service-test discovery, and retired-model resume-guard changes are implemented. `bun run check`, the targeted local test matrix in this record, and `git diff --check` pass. The curated AssemblyAI refresh fetched four URLs with two new and two unchanged sources, zero failures, and 74,187 `o200k_base` tokens.

The five-directory no-cost preflight completed successfully and estimated `$1.80` for the ten AssemblyAI targets. Its per-directory totals were `0.662¢`, `6.667¢`, `26.923¢`, `45.382¢`, and `100.000¢`. The approved paid run produced all ten AssemblyAI outputs; report regeneration remains pending completion of the remaining providers.

Phase 2's Deepgram no-op audit is implemented and locally verified. The curated refresh fetched three sources with one new pricing source, two unchanged request and feature sources, zero failures, and 13,972 `o200k_base` tokens. Both specialized names are covered by rejection tests, `nova-3` remains the sole all-provider expansion, the unchanged effective rate is reverified as of 2026-08-03, and all five existing benchmark states are succeeded. The five-directory resume preflight produced five empty estimates and a free suite total, so no paid execution or report regeneration is required for this phase.

Phase 3's Gemini implementation is complete. The registry, service discovery, help, documentation, price contracts, selected-model usage billing, curated links, and retired-target guard now use `gemini-3.6-flash`. The curated refresh fetched four sources with three new and one unchanged, zero failures, and 26,702 `o200k_base` tokens. The approved paid run produced all five Gemini outputs; the 40-minute source recovered after transient 503 responses. Report regeneration remains pending completion of the remaining providers.

Phase 4's Gladia implementation is complete. The registry, service discovery, help, documentation, price contracts, request-body builder, curated links, and retired-target guard now use `solaria-1` and `solaria-3`. The curated refresh fetched nine sources with one new and eight unchanged, zero failures, and 15,340 `o200k_base` tokens. The approved paid run produced eight trustworthy outputs. On the split 150-minute source, a shared async checkpoint caused segments 2 through 5 to reuse segment 1's remote job for both models; those two marked-success results are invalid. Split execution now isolates every segment's provider checkpoint. A clean two-model rerun of that source and report regeneration remain pending explicit approval.

Phase 5's Soniox implementation is complete. The registry, service discovery, help, documentation, price contracts, request-body builder, curated links, and retired-target guard now use `stt-async-v5`. The curated refresh fetched six sources with three new and three unchanged, zero failures, and 19,101 `o200k_base` tokens. The approved paid run produced all five Soniox outputs; report regeneration remains pending completion of the remaining providers.

Phase 6's Speechmatics implementation is complete. The registry, service discovery, help, documentation, pricing, and service-test discovery now retain `enhanced` and add `melia-1`. The first paid attempt exposed that Melia requires `language: "multi"`; the request builder and local contract were corrected after all five creates were rejected before job creation. The curated refresh fetched 17 sources with two new and 15 unchanged, zero failures, and 25,438 `o200k_base` tokens. The no-cost five-directory preflight estimated `57.93¢`; a corrected paid retry and report regeneration remain pending explicit approval and five successful outputs.

Phase 7's Together implementation is complete. The registry, service discovery, help, documentation, pricing, and service-test discovery now retain `openai/whisper-large-v3` and add `nvidia/parakeet-tdt-0.6b-v3`. Both use the existing multipart batch transcription lifecycle and request verbose segment timestamps. The request-field builder retains an optional decoding prompt only for Whisper and omits it for Parakeet, which Together documents as ignoring prompts. Current public pricing is `$0.0015/audio minute`, equivalent to `$0.09/hour`, for each model. Live Parakeet benchmarking rejected a 103 MB multipart request despite the published 500 MB batch limit and succeeded after adaptive splitting, so its operational split cap is conservatively set to 20 MiB. The reused Whisper timing estimate remains provisional.

The curated refresh fetched seven sources with two new and five unchanged, zero failures, and 11,072 `o200k_base` tokens. The approved paid run produced all five Parakeet outputs; the 150-minute source recovered through adaptive splitting after its initial 103 MB multipart request was rejected. All seven implementation phases are complete. Across the refresh, 33 of 40 planned outputs are currently trustworthy, five corrected Melia outputs and two clean long-source Gladia outputs remain, and ADR acceptance remains gated on that explicitly approved rerun plus synchronized per-run reports, combined JSON and Markdown, the self-contained HTML dashboard, and the repository benchmark summary.

The 33 trustworthy results were compacted and promoted into all five per-run reference-report pairs while preserving historical rows whose original provider results had already been cleaned. Per-run reports now record audio duration and observed realtime throughput; the combined JSON, Markdown, self-contained HTML dashboard, and repository benchmark summary promote the same timing, cost, and quality evidence. The combined dashboard currently aggregates 25 historical/current provider identities across five runs. The two invalid long-source Gladia results were removed and marked failed/missing, all five Melia errors remain recorded in manifests without dangling artifact paths, and 117 transient provider files totaling 513,133,527 bytes were deleted. Exactly 33 compacted `providers/*/result.json` files remain, with zero non-result files under the five provider trees. Reports must be regenerated once more after the corrected seven-output rerun before acceptance.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Complete Phase 1 local verification and curated-link refresh | STT maintainers | Complete |
| Run the Phase 1 no-cost preflight and record its authoritative estimate | Benchmark maintainers | Complete; `$1.80` |
| Regenerate all five per-run report pairs after compaction, combined STT JSON/Markdown/HTML dashboard, and repository benchmark summary | Benchmark maintainers | Current 33 trustworthy results promoted and transient files removed; final refresh pending corrected seven-output rerun |
| Audit Deepgram under the general-purpose rule | STT maintainers | Phase 2 complete; no paid or report work required |
| Regenerate reports for completed Gemini 3.6 Flash outputs | Benchmark maintainers | Five outputs succeeded |
| Obtain explicit approval and cleanly rerun the two invalid long-source Gladia outputs | Benchmark maintainers | Pending approval; estimated `$3.05` |
| Regenerate reports for completed Soniox v5 outputs | Benchmark maintainers | Five outputs succeeded |
| Obtain explicit approval and run the corrected Phase 6 Speechmatics Melia 1 retry | Benchmark maintainers | Pending approval; estimate `57.93¢` |
| Regenerate reports for completed Together Parakeet outputs | Benchmark maintainers | Five outputs succeeded |
| Evaluate deAPI and OpenAI STT as separate provider integrations | STT maintainers | Deferred; outside this refresh |
| Design streaming and dedicated-endpoint support before exposing transport-specific models | STT maintainers | Deferred; separate architecture decision |

## References

- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-011](ADR-011-refresh-current-hosted-llm-and-ocr-models.md)
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md)
- Related ADR: [ADR-013](ADR-013-add-refresh-metadata-to-links.md)
- `project/links/stt-model-gap-report-2026-08-03.md`
- `project/links/assembly-stt-links.md`
- `project/links/deepgram-stt-links.md`
- `project/links/gemini-stt-links.md`
- `project/links/gladia-stt-links.md`
- `project/links/soniox-stt-links.md`
- `project/links/speechmatics-stt-links.md`
- `src/cli/commands/setup-and-utilities/models/stt-models.ts`
- `src/cli/commands/setup-and-utilities/models/stt-config/stt-assemblyai.json`
- `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/assemblyai/run-assemblyai-stt.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-deepgram/run-deepgram-stt.ts`
- `src/cli/commands/setup-and-utilities/resume/extract/stt-resume.ts`
