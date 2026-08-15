# ADR-013: Record the 2026 Hosted-Model Refresh Ledger

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-15
- **Verification Status:** Passed
- **Supersession:** Consolidates per-modality 2026 refresh records into one dated ledger. Durable registry, lifecycle, and capability policy belongs to [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## Context

AutoShow completed a broad 2026 refresh of every hosted model registry. The work updated selectors, provider request shapes, prices, defaults, all-provider expansion, resume identity, historical readers, and capability contracts across write, OCR, STT, TTS, music, image, and video. Active surfaces moved to 22 STT selectors, 111 hosted TTS selectors, 5 music selectors, 34 hosted raster image selectors, and 32 video selectors.

These provider releases represent historical change records rather than durable registry policy. ADR-010 governs registry and lifecycle rules, while ADR-012 governs benchmark evidence and report architecture. This ledger records what changed during the 2026 refresh and why provider-specific adapter branches remain.

Why now: the refresh is complete across all seven hosted command surfaces, requiring one dated home for provider-specific decisions before release history accumulates inside durable policy documents.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **One dated cross-modality refresh ledger separated from durable policy and evidence architecture** | Keeps all 2026 additions, removals, provider constraints, corrections, and final counts discoverable without duplicating policy | Produces a long historical record and requires links to policy/evidence authorities | Consolidates refresh chronologies across 7 hosted command surfaces |
| Keep one live refresh ADR per modality | Keeps provider details in smaller files | Repeats policy and paid-verification rules across multiple documents | Retains multiple dated refresh authorities |
| Put all chronology into the durable policy ADR | Gives one model document | Buries stable lifecycle/capability rules under provider release history | More than 1,000 lines of mixed policy and evidence |
| Preserve only current registry code and delete the decision history | Minimizes documentation | Loses why historical identities, provider branches, and exclusions exist | No audit trail for removed selectors or paid corrections |

## Decision

Maintain a consolidated 2026 hosted-model refresh ledger organized by command modality and provider, documenting additions, replacements, removals, exclusions, compatibility branches, final selector counts, and corrections.

This applies to:

- Dated provider and model changes across write, OCR, STT, TTS, music, image, and video, plus associated adapter branches and historical readers;
- Not durable registry policy (owned by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md));
- Not benchmark execution, paid approvals, or report generation (owned by [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)).

Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

### Write and OCR refresh

#### OpenAI

- Added concrete `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` selectors to write and OCR; duplicate `gpt-5.6` alias was omitted. Structured-output validation includes all three concrete tiers.
- Synchronized Terra rates to `$2/1M` input and `$12/1M` output tokens, and Luna to `$0.20/1M` input and `$1.20/1M` output across write, OCR, and pricing.

#### Anthropic

- Added `claude-fable-5` and `claude-sonnet-5` to write, `claude-fable-5` to OCR, and `claude-opus-5` to write and OCR.
- Excluded invitation-only `claude-mythos-5` to avoid advertising non-GA models.
- Recorded Fable 5's retention/ZDR constraint as provider metadata.

#### xAI Grok

- Added `grok-4.5` to write while retaining its OCR selector. `grok-4.3` remains the cheaper bare write target; write expansion orders 4.3 before 4.5.
- Excluded moving aliases (`grok-4.5-latest`, `grok-build-latest`).
- Set Grok 4.5 price bands to `$2/$0.30/$6` per 1M input/cached-input/output tokens (<=200K input) and `$4/$0.60/$12` (>200K input). Estimates use uncached rates.

#### Google Gemini

- Added `gemini-3.6-flash`, `gemini-3.5-flash`, and `gemini-3.5-flash-lite` to write; added `gemini-3.6-flash` and `gemini-3.5-flash-lite` to OCR (where 3.5 Flash already existed).
- Published Standard rates: `$1.50/$7.50` for Gemini 3.6 Flash, `$1.50/$9.00` for Gemini 3.5 Flash, and `$0.30/$2.50` for Gemini 3.5 Flash-Lite per 1M input/output tokens.
- Excluded `gemini-3-flash-preview` and moving `*-latest` aliases.
- Gemini 3.6/3.5 API transition required no client changes: adapter already used `thinkingConfig.thinkingLevel` for Gemini 3 OCR.
- Retired `gemini-3.1-flash-lite` with replacement guidance to deterministic target `gemini-3.5-flash-lite`; preserved historical `$0.25/$1.50` rates.

#### Moonshot Kimi

- Added `kimi-k3` to write and OCR at published `$3.00/$0.30/$15.00` input/cache-hit-input/output rates. Estimates use uncached input.
- Preserved `kimi-k2.6` as the cheaper bare default.
- `kimi-k3` uses always-on reasoning, while `kimi-k2.6` supports disabling thinking via `thinking: { type: "disabled" }`.

#### Additional LLM/OCR audits

- Removed duplicate `mistral-ocr-latest` (identical to `mistral-ocr-4-0`); `mistral-ocr-2512` remains the cheapest Mistral default.
- MiniMax structured-output gate remains negative: `MiniMax-M3` lacks `response_format`/`json_schema` support, retaining the compatibility fallback and schema-guided strategy.

### 2026-08-14 OCR provider-surface expansion

The prioritized OCR expansion implemented P1–P8 entries across Replicate, fal.ai, and DeepInfra. DeepInfra additions were registry-only (`ocr-config/ocr-deepinfra.json`, `ocr-models.ts` validation) using the OpenAI-compatible vision API. Replicate and fal.ai introduced new step-2 OCR services (`ocr-services/replicate-ocr/`, `ocr-services/fal-ocr/`). Token-billed page costs reuse DeepInfra heuristics (~7,981 prompt and ~472 completion tokens per page) provisionally until calibrated.

| Priority | Selector | Provider | Pricing basis | Est. cost per 1k pages | Rationale |
|---|---|---|---|---|---|
| P1 | `datalab-to/ocr` | Replicate (official) | $2 per 1,000 pages, flat page billing | $2.00 | Official page-billed model matching Mistral OCR price point; layout analysis, text detection, and tables in 90 languages. |
| P2 | `datalab-to/marker` | Replicate (official) | $4 per 1,000 pages, pinned `fast` mode | $4.00 | Marker pipeline with markdown/JSON output (~0.18 s/page batched). Pinned `mode=fast` for deterministic pricing. |
| P3 | `google/gemma-3-27b-it` | DeepInfra | $0.08/1M input, $0.16/1M output tokens | ~$0.72 | Low-cost multimodal addition with registry-only implementation. |
| P4 | `mistralai/Mistral-Small-3.2-24B-Instruct-2506` | DeepInfra | $0.075/1M input, $0.20/1M output tokens | ~$0.69 | Solid OCR quality with improved instruction following; registry-only change. |
| P5 | `lucataco/deepseek-ocr` | Replicate (community) | L40S hardware-billed, ~$0.0033 per ~4 s prediction | ~$3.30 (variable) | Document parsing (markdown, tables, LaTeX) with version pinning at dispatch. |
| P6 | `meta-llama/Llama-4-Scout-17B-16E-Instruct` | DeepInfra | $0.10/1M input, $0.30/1M output tokens | ~$0.94 | Multimodal breadth for comparison runs; ranks on cost and model diversity. |
| P7 | `fal-ai/got-ocr/v2` | fal.ai | $0.05 per image | $50.00 | Specialty coverage (formulas, geometry, molecular structures, sheet music); reserved for specialized content. |
| P8 | `fal-ai/florence-2-large/ocr` | fal.ai | $0.00125 per GPU compute second | ~$7.55 (estimated) | Compute-second billing calibrated from 2026-08-14 run (~6.04 s/page estimate); billed duration varies by input. |

Excluded from expansion:

- Replicate `abiruyt/text-extract-ocr`: covered by free local `tesseract` engine.
- Replicate `lucataco/glm-ocr`: duplicates direct GLM `glm-ocr`.
- Replicate `cuuupid/marker`: superseded by official `datalab-to/marker`.
- Replicate `bytedance/dolphin`, `mickeybeurskens/latex-ocr`, `willywongi/donut`, `cjwbw/docentr`, `awilliamson10/meta-nougat`, `cudanexus/ocr-surya`, `pbevan1/llama-3.1-8b-ocr-correction`: low-usage community deployments or single-purpose pre/post-processing tools.
- fal.ai `openrouter/router/vision`: moving router violating fixed-ID policy.
- fal.ai `moondream3-preview/*`: preview endpoints deferred until fixed IDs exist.
- fal.ai `docres`, `docres/dewarp`: image enhancement tools, not OCR.
- DeepInfra partner-hosted Claude/Gemini selectors: duplicates direct providers without price advantages.
- DeepInfra `google/gemma-3-12b-it`, `google/gemma-3-4b-it`: marginal savings with weaker OCR quality than 27B.

### STT refresh

Standardized STT on 22 active selectors across general-purpose hosted batch models, excluding specialized, realtime, streaming, or moving products (Nova-3 Medical, Deepgram Flux, Mistral Realtime, Together streaming).

| Provider | Active change and retained contract |
|---|---|
| AssemblyAI | Replaced `universal-3-pro` with `universal-3-5-pro` and `universal-2`. Bare selection defaults to cheaper Universal-2 ($0.17/hour); Universal-3.5 Pro ($0.23/hour) is retained in expansion. Async request sends singleton `speech_models`, diarization, and optional speaker count. |
| Deepgram | Retained concrete `nova-3` ($0.582/hour diarization-inclusive); excluded redundant `nova-3-general` and domain-specific `nova-3-medical`. |
| Gemini | Replaced `gemini-3-flash-preview` with `gemini-3.6-flash` on GenerateContent/Files adapter ($1.50/1M input, $7.50/1M output, ~$0.1728/hour baseline). |
| Gladia | Replaced `default` with `solaria-1` (bare default) and `solaria-3` ($0.61/hour). Async request sends model, diarization, and optional speaker count. Segment checkpoint isolation prevents remote job cross-talk. |
| Soniox | Replaced `stt-async-v4` with `stt-async-v5` on compatible async lifecycle (~$0.10/hour). |
| Speechmatics | Retained `enhanced` ($0.40/hour) and added batch-only `melia-1` ($0.129/hour). Request uses `model` parameter; Enhanced sets `language: "auto"`, Melia sets `language: "multi"`. |
| Together | Retained `openai/whisper-large-v3` and added `nvidia/parakeet-tdt-0.6b-v3` ($0.09/hour). Parakeet enforces a 20 MiB chunk cap based on batch execution limits. |

Compacted STT resume prioritizes canonical `result.json` before falling back to `transcription.txt`.

### TTS refresh and catalog narrowing

Standardized hosted TTS on 111 active selectors across 15 hosted providers (plus local Kitten TTS). Moving aliases and unsteerable models were replaced or retired with explicit refusal guidance.

| Provider | 2026 decision and active implementation |
|---|---|
| Speechify | Replaced legacy `simba-english`/`simba-3.0` with `simba-3.2`; added language/voice validation and historical identity handling. |
| Cartesia | Replaced `sonic-3` and moving `sonic-3.5` with fixed `sonic-3.5-2026-05-04`. |
| OpenAI | Replaced moving `gpt-4o-mini-tts` with fixed `gpt-4o-mini-tts-2025-12-15`. Retired `tts-1` and `tts-1-hd` due to lack of instruction steering. Custom voices serialize as `{ id: "voice_…" }`. |
| Deepgram | Expanded from 8 to all 91 documented Aura-2 voice models across seven languages; single-default policy avoids multiplying all-provider runs. Excluded Aura-1 and Flux. |
| ElevenLabs | Retained flagship `eleven_v3`; retired multilingual/flash variants to keep only native-dialogue flagship. |
| Mistral | Retained canonical API ID `voxtral-mini-tts-2603`. |
| Groq | Retained English Orpheus (`canopylabs/orpheus-v1-english`, default voice `abdullah`). Retired narrow Arabic selector. |
| xAI | Kept `grok-tts` product selector; expanded stock voices to 26 documented IDs with `eve` default. |
| Gemini | Kept `gemini-3.1-flash-tts-preview` with 30 prebuilt voices supporting single and two-speaker synthesis. |
| Inworld | Added `realtime-tts-2` ($25/1M chars, API ID `inworld-tts-2`). Removed legacy 1.5 Max/Mini and Flash variants. |
| DeepInfra | Added `ResembleAI/chatterbox-turbo` ($1/1M chars), `XiaomiMiMo/MiMo-V2.5-tts` ($0/1M promo), `XiaomiMiMo/MiMo-V2.5-tts-voicedesign` ($0/1M), `Qwen/Qwen3-TTS` ($20/1M), and `Qwen/Qwen3-TTS-VoiceDesign` ($20/1M). Retired failing `chatterbox-multilingual`. |
| Replicate | Added pinned `jaaari/kokoro-82m` ($0.00022/pred). Removed unmaintained community variants lacking compatible schemas. |
| Fish | Standardized on `s2.1-pro` ($15/1M UTF-8 bytes) as sole synthesis model with native dialogue and timestamps. Exposed `voice-design-1` via `--creation-model` rather than synthesis selector. |

#### Refused / do not reimplement

These twelve selectors are permanently retired. Direct selection fails with replacement guidance.

| Refused selector | Replacement | Why not come back |
|---|---|---|
| `fish/fish-speech-1.5` | `s2.1-pro` | Superseded generation; absent from official API |
| `fish/s1` | `s2.1-pro` | Previous-generation parenthesis-tag model |
| `fish/s2-pro` | `s2.1-pro` | Previous S2 generation replaced by production default |
| `fish/voice-design-1` | `s2.1-pro` | Voice Design creation endpoint, not a synthesis selector |
| `elevenlabs/eleven_multilingual_v2` | `eleven_v3` | Superseded by native-dialogue flagship |
| `elevenlabs/eleven_flash_v2_5` | `eleven_v3` | Latency sibling of retired generation |
| `inworld/realtime-tts-2-flash` | `realtime-tts-2` | Latency sibling rejecting `--tts-instructions` |
| `speechify/simba-3.0` | `simba-3.2` | Superseded by current Speechify default |
| `deepinfra/ResembleAI/chatterbox-multilingual` | `ResembleAI/chatterbox-turbo` | Unreliable upstream HTTP 500 errors |
| `openai/tts-1` | `gpt-4o-mini-tts-2025-12-15` | Classic model rejecting instruction steering |
| `openai/tts-1-hd` | `gpt-4o-mini-tts-2025-12-15` | Classic model rejecting instruction steering |
| `groq/canopylabs/orpheus-arabic-saudi` | `canopylabs/orpheus-v1-english` | Narrow 200-character WAV-only model without vocal directions |

### Music refresh

Standardized active music generation on 5 selectors across 3 hosted providers.

- Added ElevenLabs `music_v2` while retaining `music_v1` during transition. Output formats resolve automatically (`mp3_44100_128` for v1, `mp3_48000_192` for v2).
- Replaced MiniMax `music-2.6` with `music-3.0` on prompt/lyrics/instrumental lifecycle. Historical readers preserve 2.6 rate ($0.15/track + $0.01 for lyrics).
- Retained Gemini `lyria-3-clip-preview` and `lyria-3-pro-preview` with per-track pricing.
- Excluded streaming Lyria RealTime, cover generation, and reference-audio products.
- Music resume promotes outputs to provider/model filenames before merging metadata to avoid artifact collisions.

### Image refresh

Standardized hosted raster image generation on 34 selectors across 6 providers, removing 7 outdated selectors.

| Provider | 2026 decision and implementation |
|---|---|
| Gemini | Replaced `gemini-3.1-flash-image-preview` with `gemini-3.1-flash-lite-image` (default), `gemini-3.1-flash-image`, and `gemini-3-pro-image`. Added model-specific pricing, dimensions, and historical reader. |
| Reve | Removed direct Reve provider and `latest`/`reve-create@20250915` selectors ahead of the 2026-08-14 API sunset; historical results retain direct-Reve identities. |
| Recraft | Removed four SVG/vector selectors; hosted generation standardized on raster-only output. |
| BFL | Added fixed `flux-2-klein-4b` and `flux-2-klein-9b` endpoints; excluded moving previews. |
| Replicate | Added `bytedance/seedream-5-pro`, Ideogram v4 (Turbo/Balanced/Quality), and Pruna ERNIE Image (Standard/Turbo with version pinning). |
| fal.ai | Added `fal-ai/hidream-o1-image`, `microsoft/mai-image-2.5`, `microsoft/mai-image-2.5-pro`, `alibaba/qwen-image-3`, and `reve/2.1` with queue/poll lifecycle and mode routing. |

### Video refresh

Standardized hosted video generation on 32 selectors across 7 providers.

- Replicate: replaced `alibaba/happyhorse-1.0` with 1.1; added Kling v3 Video, Kling v3 Omni, PixVerse V6, and Runway Aleph 2.
- xAI: added `grok-imagine-video-1.5` with per-second/resolution pricing; retained `grok-imagine-video` for edit/extend operations.
- fal.ai: added `minimax/h3` and `fal-ai/pixverse/c1` with explicit mode routing (text/image/reference), native audio, and duration/aspect validation.
- Retained: LTX 2.3 Fast/Pro, Seedance 2.0/2.0 Fast, Wan 2.7 T2V, Veo 3.1 Lite, Ray 3.2. Excluded unreleased Meta Muse, unavailable SkyReels V4, realtime Helios, and interactive stream tools.
- MiniMax: retained direct 01-series selectors (`T2V-01` 19¢ bare default).
- Veo: standardized on raw REST response boundary (`response.generateVideoResponse.generatedSamples[0].video`, `encodedVideo`), removing deprecated SDK wrapper types.

## API / Type Impact

- Write and OCR unions accept concrete 2026 OpenAI, Anthropic, Grok, Gemini, and Kimi identifiers.
- Active selector counts: 22 STT, 111 hosted TTS, 5 music, 34 hosted raster image, and 32 video selectors.
- Removed selectors are excluded from active CLI help, configuration defaults, and expansion lists, while remaining parseable in historical manifests and pricing readers.

## Rationale

- A consolidated dated ledger preserves refresh history without burdening durable policy documents with provider release notes.
- Recording specific exclusions and rejected aliases prevents future catalog sweeps from reintroducing incompatible endpoints.
- Documenting compatibility branches (Veo REST shapes, Gladia segment checkpoints, ElevenLabs audio formats) explains essential adapter logic that model tables alone cannot capture.

## Consequences

Positive outcomes:

- Provides a single audit trail for all 2026 hosted-model changes while maintaining clean separation from ADR-010 and ADR-012.
- Captures removed model identifiers, successor paths, and retired pricing for manifest continuity.
- Establishes clear baseline selector counts across all seven hosted modalities.

Negative outcomes:

- Provider snapshots age over time and require re-verification during subsequent refresh cycles.
- Temporary preview names and product aliases must be maintained in the ledger where upstream providers lack fixed version IDs.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Consolidated 2026 provider chronology | Maintains a large dated document |
| Clean separation from durable policy and benchmark evidence | Requires cross-referencing ADR-010 and ADR-012 for policy/evidence rules |
| Preserved historical identity and adapter context | Historical adapter branches remain in codebase |

## Implementation Note

All 2026 refresh phases are implemented across active model registries, provider adapters, pricing metadata, help documentation, resume handlers, and local test contracts. Advanced multi-track capabilities remain governed by [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md), while benchmark run artifacts and report generation remain governed by [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Record future large hosted-model refreshes in a new dated ledger section while preserving ADR-010 policy | Model registry maintainers | Ongoing guardrail |
| Recheck deferred specialized, streaming, realtime, cover, and reference-audio products via separate architecture ADRs | Domain maintainers | Deferred |
| Promote provisional OCR token-billed heuristics and Florence compute-second estimates through approved ADR-012 calibration | OCR maintainers | Deferred pending paid calibration approval |

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify active selector counts and removed-selector rejection across all seven modalities.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state and resume identity
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — Shared model consumers
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — Provider-lane scheduling
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — Curated primary-source refreshes
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Related ADR: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) — Character voice and multi-speaker architecture
- Related ADR: [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md) — Soundscape and added TTS provider implementation phases
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- Provider adapters: `src/cli/commands/process-steps/step-2-extract/`, `src/cli/commands/process-steps/step-3-write/`, `src/cli/commands/process-steps/step-4-tts/`, `src/cli/commands/process-steps/step-5-image/`, `src/cli/commands/process-steps/step-6-video/`, `src/cli/commands/process-steps/step-7-music/`
- Resume handlers: `src/cli/commands/setup-and-utilities/resume/`
- Historical cost reconstruction: `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- Primary-source snapshots: `src/cli/commands/setup-and-utilities/links/model-links/`
- STT benchmark artifacts: `docs/benchmarks/stt/`
- Music benchmark artifacts: `docs/benchmarks/music/`
